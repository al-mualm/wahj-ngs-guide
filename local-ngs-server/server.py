#!/usr/bin/env python3
"""Local Wahj NGS analysis server.

This server is intentionally local-only by default. It lets the static website
running in a browser submit analysis jobs to the Mac without renting a server.
Large FASTQ files are passed by local filesystem path rather than uploaded
through the browser.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


HOME = Path.home()
DEFAULT_REFERENCE_COLLECTION = (
    HOME / "Downloads" / "Reference_Genomes_Collected_2026-06-19"
)
DEFAULT_REFERENCE_MANIFEST = DEFAULT_REFERENCE_COLLECTION / "reference_genome_collection_manifest.tsv"
DEFAULT_REFERENCE_FILES = DEFAULT_REFERENCE_COLLECTION / "files"
DEFAULT_JOB_ROOT = HOME / "Downloads" / "Wahj_NGS_Jobs"
REFERENCE_EXTENSIONS = (".fa", ".fasta", ".fna", ".fas", ".fa.gz", ".fasta.gz", ".fna.gz")
ANNOTATION_EXTENSIONS = (".gff3", ".gff", ".gtf")


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def slugify(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    return value.strip("-")[:80] or "reference"


def short_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:10]


def read_json(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    return json.loads(raw.decode("utf-8"))


def write_json(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, indent=2, sort_keys=True).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(body)


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def run_command(command: list[str], cwd: Path | None = None) -> dict:
    started = time.time()
    process = subprocess.run(
        command,
        cwd=str(cwd) if cwd else None,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return {
        "command": command,
        "returncode": process.returncode,
        "stdout": process.stdout,
        "stderr": process.stderr,
        "elapsedSeconds": round(time.time() - started, 3),
    }


def parse_fasta_header(path: Path) -> str:
    opener = open
    if path.name.lower().endswith(".gz"):
        import gzip

        opener = gzip.open
    try:
        with opener(path, "rt", errors="replace") as handle:
            for line in handle:
                if line.startswith(">"):
                    return line.strip()[:260]
    except Exception:
        return ""
    return ""


def label_from_header_or_name(path: Path, header: str) -> str:
    if header:
        text = header[1:] if header.startswith(">") else header
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) > 95:
            text = text[:92] + "..."
        return text
    return path.name


def guess_reference_kind(path: Path, header: str) -> str:
    combined = f"{path} {header}".lower()
    if "homo sapiens" in combined or "grch38" in combined or "assembly38" in combined:
        return "human"
    if "phoenix dactylifera" in combined or "palm" in combined:
        return "date_palm"
    if "escherichia coli" in combined or "ecoli" in combined:
        return "bacteria"
    if "klebsiella" in combined:
        return "bacteria"
    if "helicobacter pylori" in combined or "hpylori" in combined:
        return "bacteria"
    if "salmonella" in combined:
        return "bacteria"
    if "virus" in combined or "cmv" in combined or "ndv" in combined:
        return "virus"
    if "agaricus" in combined:
        return "fungus"
    return "genome"


def has_bwa_index(reference_path: Path) -> bool:
    return all(reference_path.with_suffix(reference_path.suffix + suffix).exists() for suffix in [".bwt", ".pac", ".ann", ".amb", ".sa"])


def find_annotation(reference_path: Path) -> Path | None:
    candidates: list[Path] = []
    parent = reference_path.parent
    for ext in ANNOTATION_EXTENSIONS:
        candidates.extend(parent.glob(f"*{ext}"))
    for child_name in ["annotation", "annotations", "ncbi_dataset", "data"]:
        child = parent / child_name
        if child.exists():
            for ext in ANNOTATION_EXTENSIONS:
                candidates.extend(child.rglob(f"*{ext}"))
    candidates = [path for path in candidates if path.is_file()]
    if not candidates:
        # Search one level higher for references where FASTA and annotation are
        # siblings under a project-level reference folder.
        root = parent.parent
        for ext in ANNOTATION_EXTENSIONS:
            candidates.extend(root.glob(f"*{ext}"))
            candidates.extend(root.glob(f"*/*{ext}"))
    candidates = [path for path in candidates if path.is_file()]
    if not candidates:
        return None

    def rank(path: Path) -> tuple[int, int]:
        name = path.name.lower()
        if name.endswith(".gff3") or name.endswith(".gff"):
            primary = 0
        elif name.endswith(".gtf"):
            primary = 1
        else:
            primary = 2
        return (primary, path.stat().st_size)

    return sorted(candidates, key=rank)[0]


class ReferenceCatalog:
    def __init__(self, manifest: Path, files_root: Path):
        self.manifest = manifest
        self.files_root = files_root
        self.references: dict[str, dict] = {}
        self.reload()

    def reload(self) -> None:
        references: dict[str, dict] = {}
        if self.manifest.exists():
            with self.manifest.open(newline="") as handle:
                reader = csv.DictReader(handle, delimiter="\t")
                for row in reader:
                    if row.get("category") != "sequence_fasta":
                        continue
                    collected = Path(row.get("collected_path") or "")
                    source = Path(row.get("path") or "")
                    path = collected if collected.exists() else source
                    if not path.exists():
                        continue
                    if not path.name.lower().endswith(REFERENCE_EXTENSIONS):
                        continue
                    self._add_reference(references, path, row.get("first_header_or_note", ""))
        else:
            for path in self.files_root.rglob("*"):
                if path.is_file() and path.name.lower().endswith(REFERENCE_EXTENSIONS):
                    self._add_reference(references, path, "")
        self.references = dict(sorted(references.items(), key=lambda item: item[1]["label"].lower()))

    def _add_reference(self, references: dict[str, dict], path: Path, header: str) -> None:
        header = header or parse_fasta_header(path)
        label = label_from_header_or_name(path, header)
        reference_id = f"{slugify(path.stem)}-{short_hash(str(path))}"
        annotation = find_annotation(path)
        references[reference_id] = {
            "id": reference_id,
            "label": label,
            "fileName": path.name,
            "path": str(path),
            "sizeBytes": path.stat().st_size,
            "kind": guess_reference_kind(path, header),
            "header": header,
            "bwaIndexReady": has_bwa_index(path),
            "faiReady": Path(str(path) + ".fai").exists(),
            "annotationPath": str(annotation) if annotation else "",
        }

    def list(self) -> list[dict]:
        return list(self.references.values())

    def get(self, reference_id: str) -> dict | None:
        return self.references.get(reference_id)


class JobStore:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()

    def create_job_dir(self) -> Path:
        job_id = f"job-{time.strftime('%Y%m%d-%H%M%S')}-{short_hash(str(time.time()))}"
        job_dir = self.root / job_id
        job_dir.mkdir(parents=True, exist_ok=False)
        return job_dir

    def write_status(self, job_dir: Path, status: dict) -> None:
        with self.lock:
            status["updatedAt"] = now_iso()
            (job_dir / "status.json").write_text(json.dumps(status, indent=2, sort_keys=True))

    def read_status(self, job_id: str) -> dict | None:
        status_path = self.root / job_id / "status.json"
        if not status_path.exists():
            return None
        return json.loads(status_path.read_text())


def ensure_fai(reference_path: Path, commands: list[dict]) -> Path | None:
    fai = Path(str(reference_path) + ".fai")
    if fai.exists():
        return fai
    if not command_exists("samtools"):
        return None
    result = run_command(["samtools", "faidx", str(reference_path)])
    commands.append(result)
    return fai if result["returncode"] == 0 and fai.exists() else None


def genome_structure_from_fai(fai_path: Path | None) -> dict:
    if not fai_path or not fai_path.exists():
        return {}
    lengths = []
    contigs = []
    with fai_path.open() as handle:
        for line in handle:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 2:
                name = parts[0]
                length = int(parts[1])
                lengths.append(length)
                contigs.append({"name": name, "length": length})
    if not lengths:
        return {}
    total = sum(lengths)
    running = 0
    n50 = 0
    for length in sorted(lengths, reverse=True):
        running += length
        if running >= total / 2:
            n50 = length
            break
    return {
        "contigCount": len(lengths),
        "totalBases": total,
        "n50": n50,
        "largestContig": max(lengths),
        "smallestContig": min(lengths),
        "firstContigs": contigs[:30],
    }


def annotation_summary(annotation_path: str) -> dict:
    if not annotation_path:
        return {}
    path = Path(annotation_path)
    if not path.exists():
        return {}
    feature_counts: dict[str, int] = {}
    total_rows = 0
    try:
        with path.open(errors="replace") as handle:
            for line in handle:
                if not line.strip() or line.startswith("#"):
                    continue
                parts = line.rstrip("\n").split("\t")
                if len(parts) < 3:
                    continue
                total_rows += 1
                feature = parts[2].lower()
                feature_counts[feature] = feature_counts.get(feature, 0) + 1
    except Exception as exc:
        return {"annotationPath": str(path), "error": str(exc)}
    return {
        "annotationPath": str(path),
        "featureRows": total_rows,
        "featureCounts": dict(sorted(feature_counts.items(), key=lambda item: (-item[1], item[0]))),
        "geneCount": feature_counts.get("gene", 0),
        "cdsCount": feature_counts.get("cds", 0),
        "exonCount": feature_counts.get("exon", 0),
    }


def parse_flagstat_text(text: str) -> dict:
    summary = {}
    for line in text.splitlines():
        match = re.match(r"^(\d+) \+ (\d+) (.+)$", line.strip())
        if not match:
            continue
        passed = int(match.group(1))
        failed = int(match.group(2))
        label = match.group(3).split(" (")[0].strip().replace(" ", "_").replace("'", "")
        summary[label] = {"passed": passed, "failed": failed}
    return summary


def parse_samtools_stats(text: str) -> dict:
    summary = {}
    for line in text.splitlines():
        if not line.startswith("SN\t"):
            continue
        parts = line.rstrip("\n").split("\t")
        if len(parts) >= 3:
            key = parts[1].rstrip(":")
            value = parts[2]
            summary[key] = value
    return summary


def run_alignment_pipeline(job_dir: Path, payload: dict, reference: dict, store: JobStore) -> None:
    job_id = job_dir.name
    commands: list[dict] = []
    status = {
        "jobId": job_id,
        "state": "running",
        "createdAt": now_iso(),
        "reference": reference,
        "read1Path": payload.get("read1Path", ""),
        "read2Path": payload.get("read2Path", ""),
        "steps": [],
        "reportPath": str(job_dir / "report.json"),
    }
    store.write_status(job_dir, status)

    try:
        threads = str(max(1, min(int(payload.get("threads") or 4), os.cpu_count() or 4)))
        read1 = Path(str(payload.get("read1Path") or "")).expanduser()
        read2_raw = str(payload.get("read2Path") or "").strip()
        read2 = Path(read2_raw).expanduser() if read2_raw else None
        reference_path = Path(reference["path"])

        if not read1.exists():
            raise FileNotFoundError(f"Read 1 file does not exist: {read1}")
        if read2 and not read2.exists():
            raise FileNotFoundError(f"Read 2 file does not exist: {read2}")
        if not reference_path.exists():
            raise FileNotFoundError(f"Reference file does not exist: {reference_path}")

        fai = ensure_fai(reference_path, commands)
        genome_structure = genome_structure_from_fai(fai)
        annotation = annotation_summary(reference.get("annotationPath", ""))

        trimmed_1 = read1
        trimmed_2 = read2
        fastp_json = job_dir / "fastp.json"
        fastp_html = job_dir / "fastp.html"
        if payload.get("runFastp", True) and command_exists("fastp"):
            status["steps"].append({"name": "fastp", "state": "running"})
            store.write_status(job_dir, status)
            trimmed_1 = job_dir / "trimmed_R1.fastq.gz"
            fastp_command = [
                "fastp",
                "-i",
                str(read1),
                "-o",
                str(trimmed_1),
                "--json",
                str(fastp_json),
                "--html",
                str(fastp_html),
                "--thread",
                threads,
            ]
            if read2:
                trimmed_2 = job_dir / "trimmed_R2.fastq.gz"
                fastp_command.extend(["-I", str(read2), "-O", str(trimmed_2)])
            result = run_command(fastp_command, cwd=job_dir)
            commands.append(result)
            if result["returncode"] != 0:
                raise RuntimeError("fastp failed. See command log in report.json.")
            status["steps"][-1]["state"] = "done"
            store.write_status(job_dir, status)

        if not command_exists("bwa"):
            raise RuntimeError("bwa is not installed or not in PATH.")
        if not command_exists("samtools"):
            raise RuntimeError("samtools is not installed or not in PATH.")
        if not has_bwa_index(reference_path):
            raise RuntimeError(
                f"BWA index not found beside reference: {reference_path}. "
                "Build it with: bwa index <reference.fasta>"
            )

        status["steps"].append({"name": "bwa_mem_alignment", "state": "running"})
        store.write_status(job_dir, status)
        bam_path = job_dir / "aligned.sorted.bam"
        bwa_command = ["bwa", "mem", "-t", threads, str(reference_path), str(trimmed_1)]
        if trimmed_2:
            bwa_command.append(str(trimmed_2))
        sort_command = ["samtools", "sort", "-@", threads, "-o", str(bam_path), "-"]
        started = time.time()
        bwa_proc = subprocess.Popen(bwa_command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=False)
        sort_proc = subprocess.Popen(sort_command, stdin=bwa_proc.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        assert bwa_proc.stdout is not None
        bwa_proc.stdout.close()
        sort_stdout, sort_stderr = sort_proc.communicate()
        bwa_stderr = bwa_proc.stderr.read().decode("utf-8", errors="replace") if bwa_proc.stderr else ""
        bwa_return = bwa_proc.wait()
        commands.append(
            {
                "command": bwa_command,
                "returncode": bwa_return,
                "stdout": "",
                "stderr": bwa_stderr,
                "elapsedSeconds": round(time.time() - started, 3),
            }
        )
        commands.append(
            {
                "command": sort_command,
                "returncode": sort_proc.returncode,
                "stdout": sort_stdout.decode("utf-8", errors="replace") if sort_stdout else "",
                "stderr": sort_stderr.decode("utf-8", errors="replace") if sort_stderr else "",
                "elapsedSeconds": round(time.time() - started, 3),
            }
        )
        if bwa_return != 0 or sort_proc.returncode != 0:
            raise RuntimeError("Alignment or BAM sorting failed. See command log in report.json.")
        status["steps"][-1]["state"] = "done"
        store.write_status(job_dir, status)

        status["steps"].append({"name": "samtools_index_and_stats", "state": "running"})
        store.write_status(job_dir, status)
        commands.append(run_command(["samtools", "index", str(bam_path)], cwd=job_dir))
        flagstat = run_command(["samtools", "flagstat", str(bam_path)], cwd=job_dir)
        stats = run_command(["samtools", "stats", str(bam_path)], cwd=job_dir)
        commands.extend([flagstat, stats])
        if flagstat["returncode"] != 0 or stats["returncode"] != 0:
            raise RuntimeError("samtools statistics failed. See command log in report.json.")
        status["steps"][-1]["state"] = "done"

        report = {
            "jobId": job_id,
            "completedAt": now_iso(),
            "reference": reference,
            "inputs": {
                "read1Path": str(read1),
                "read2Path": str(read2) if read2 else "",
                "trimmedRead1Path": str(trimmed_1),
                "trimmedRead2Path": str(trimmed_2) if trimmed_2 else "",
            },
            "outputs": {
                "jobDirectory": str(job_dir),
                "bam": str(bam_path),
                "bamIndex": str(Path(str(bam_path) + ".bai")),
                "fastpJson": str(fastp_json) if fastp_json.exists() else "",
                "fastpHtml": str(fastp_html) if fastp_html.exists() else "",
            },
            "genomeStructure": genome_structure,
            "annotationSummary": annotation,
            "alignmentSummary": {
                "flagstat": parse_flagstat_text(flagstat["stdout"]),
                "samtoolsStats": parse_samtools_stats(stats["stdout"]),
            },
            "commands": commands,
        }
        (job_dir / "report.json").write_text(json.dumps(report, indent=2, sort_keys=True))
        status["state"] = "completed"
        status["completedAt"] = now_iso()
        status["outputs"] = report["outputs"]
        store.write_status(job_dir, status)
    except Exception as exc:
        error_report = {
            "jobId": job_id,
            "failedAt": now_iso(),
            "error": str(exc),
            "traceback": traceback.format_exc(),
            "commands": commands,
        }
        (job_dir / "report.json").write_text(json.dumps(error_report, indent=2, sort_keys=True))
        status["state"] = "failed"
        status["error"] = str(exc)
        store.write_status(job_dir, status)


def build_handler(catalog: ReferenceCatalog, store: JobStore):
    class Handler(BaseHTTPRequestHandler):
        server_version = "WahjLocalNGS/0.1"

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/api/health":
                write_json(
                    self,
                    200,
                    {
                        "ok": True,
                        "service": "Wahj Local NGS Server",
                        "time": now_iso(),
                        "jobRoot": str(store.root),
                        "referenceCount": len(catalog.list()),
                        "tools": {
                            "bwa": command_exists("bwa"),
                            "samtools": command_exists("samtools"),
                            "fastp": command_exists("fastp"),
                            "minimap2": command_exists("minimap2"),
                            "multiqc": command_exists("multiqc"),
                        },
                    },
                )
                return
            if parsed.path == "/api/references":
                catalog.reload()
                write_json(self, 200, {"references": catalog.list()})
                return
            if parsed.path.startswith("/api/jobs/"):
                job_id = parsed.path.split("/")[-1]
                if job_id == "jobs":
                    write_json(self, 404, {"error": "Missing job id."})
                    return
                status = store.read_status(job_id)
                if not status:
                    write_json(self, 404, {"error": "Job not found."})
                    return
                query = parse_qs(parsed.query)
                if query.get("report") == ["1"]:
                    report_path = store.root / job_id / "report.json"
                    if report_path.exists():
                        write_json(self, 200, json.loads(report_path.read_text()))
                        return
                write_json(self, 200, status)
                return
            write_json(self, 404, {"error": "Not found."})

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/api/jobs":
                try:
                    payload = read_json(self)
                    reference_id = str(payload.get("referenceId") or "")
                    reference = catalog.get(reference_id)
                    if not reference:
                        write_json(self, 400, {"error": "Unknown referenceId."})
                        return
                    job_dir = store.create_job_dir()
                    status = {
                        "jobId": job_dir.name,
                        "state": "queued",
                        "createdAt": now_iso(),
                        "reference": reference,
                        "reportPath": str(job_dir / "report.json"),
                    }
                    store.write_status(job_dir, status)
                    thread = threading.Thread(
                        target=run_alignment_pipeline,
                        args=(job_dir, payload, reference, store),
                        daemon=True,
                    )
                    thread.start()
                    write_json(self, 202, status)
                except Exception as exc:
                    write_json(self, 500, {"error": str(exc), "traceback": traceback.format_exc()})
                return
            write_json(self, 404, {"error": "Not found."})

        def log_message(self, fmt: str, *args) -> None:
            print(f"[{now_iso()}] {self.address_string()} {fmt % args}")

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Wahj local NGS analysis server.")
    parser.add_argument("--host", default=os.environ.get("WAHJ_NGS_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("WAHJ_NGS_PORT", "8787")))
    parser.add_argument(
        "--reference-manifest",
        type=Path,
        default=Path(os.environ.get("WAHJ_REFERENCE_MANIFEST", DEFAULT_REFERENCE_MANIFEST)),
    )
    parser.add_argument(
        "--reference-files",
        type=Path,
        default=Path(os.environ.get("WAHJ_REFERENCE_FILES", DEFAULT_REFERENCE_FILES)),
    )
    parser.add_argument(
        "--job-root",
        type=Path,
        default=Path(os.environ.get("WAHJ_NGS_JOB_ROOT", DEFAULT_JOB_ROOT)),
    )
    args = parser.parse_args()

    catalog = ReferenceCatalog(args.reference_manifest, args.reference_files)
    store = JobStore(args.job_root)
    handler = build_handler(catalog, store)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Wahj Local NGS Server running at http://{args.host}:{args.port}")
    print(f"References: {len(catalog.list())}")
    print(f"Jobs: {store.root}")
    server.serve_forever()


if __name__ == "__main__":
    main()
