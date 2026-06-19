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
import io
import json
import mimetypes
import os
import re
import shutil
import subprocess
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


HOME = Path.home()
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REFERENCE_COLLECTION = (
    HOME / "Downloads" / "Reference_Genomes_Collected_2026-06-19"
)
DEFAULT_REFERENCE_MANIFEST = DEFAULT_REFERENCE_COLLECTION / "reference_genome_collection_manifest.tsv"
DEFAULT_REFERENCE_FILES = DEFAULT_REFERENCE_COLLECTION / "files"
DEFAULT_JOB_ROOT = HOME / "Downloads" / "Wahj_NGS_Jobs"
REFERENCE_EXTENSIONS = (".fa", ".fasta", ".fna", ".fas", ".fa.gz", ".fasta.gz", ".fna.gz")
ANNOTATION_EXTENSIONS = (".gff3", ".gff", ".gtf")
MAX_FORM_FIELD_BYTES = 1024 * 1024
MULTIPART_READ_SIZE = 1024 * 1024
STATIC_EXTENSIONS = {
    ".css",
    ".gif",
    ".html",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".json",
    ".png",
    ".svg",
    ".txt",
    ".webp",
    ".woff",
    ".woff2",
}
ORGANISM_RULES = [
    {
        "id": "homo-sapiens",
        "speciesName": "Homo sapiens",
        "referenceName": "GRCh38 complete genome",
        "match": ["homo sapiens", "homo_sapiens_assembly38", "grch38"],
        "prefer": ["homo_sapiens_assembly38.fasta", "grch38_gatk", "assembly38.fasta"],
        "exclude": ["_chr", "chr20", "chr22", "chrx", "complete cds", " gene,"],
    },
    {
        "id": "escherichia-coli",
        "speciesName": "Escherichia coli",
        "referenceName": "complete bacterial genome",
        "match": ["escherichia coli", "ecoli"],
        "prefer": ["ecoli_o157h7_sakai", "sakai", "nc_002695", "mg1655", "nc_000913"],
        "exclude": ["cds_from_genomic", "[gbkey=cds]", "protein_id="],
    },
    {
        "id": "klebsiella-pneumoniae",
        "speciesName": "Klebsiella pneumoniae",
        "referenceName": "complete bacterial genome",
        "match": ["klebsiella pneumoniae", "kp_mgh78578"],
        "prefer": ["kp_mgh78578", "mgh 78578", "nc_009648"],
        "exclude": ["cds_from_genomic", "[gbkey=cds]", "protein_id="],
    },
    {
        "id": "helicobacter-pylori",
        "speciesName": "Helicobacter pylori",
        "referenceName": "complete bacterial genome",
        "match": ["helicobacter pylori", "hpylori"],
        "prefer": ["hpylori_26695", "26695", "ae000511"],
        "exclude": ["cds_from_genomic", "[gbkey=cds]", "protein_id="],
    },
    {
        "id": "phoenix-dactylifera",
        "speciesName": "Phoenix dactylifera",
        "referenceName": "date palm genome assembly",
        "match": ["phoenix dactylifera", "phoenix_ref", "palm"],
        "prefer": ["phoenix_ref.fasta", "barhee", "chromosome"],
        "exclude": ["cds_from_genomic", "[gbkey=cds]", "protein_id="],
    },
    {
        "id": "newcastle-disease-virus",
        "speciesName": "Newcastle disease virus",
        "referenceName": "complete viral genome",
        "match": ["newcastle disease virus", "ndv_ref", "ulster/67"],
        "prefer": ["ndv_ref.fasta", "nc_075404", "complete genome"],
        "exclude": ["cds_from_genomic", "[gbkey=cds]", "protein_id="],
    },
    {
        "id": "cucumber-mosaic-virus",
        "speciesName": "Cucumber mosaic virus",
        "referenceName": "complete viral genome",
        "match": ["cucumber mosaic virus", "cmv_ref", "cmv"],
        "prefer": ["cmv_ref.fasta", "nc_002034", "complete sequence"],
        "exclude": ["cds_from_genomic", "[gbkey=cds]", "protein_id="],
    },
    {
        "id": "agaricus-bisporus",
        "speciesName": "Agaricus bisporus",
        "referenceName": "genome assembly",
        "match": ["agaricus bisporus", "agabi", "asm827154"],
        "prefer": ["gcf_000300575", "h97", "genomic.fna"],
        "exclude": ["cds_from_genomic", "[gbkey=cds]", "protein_id="],
    },
    {
        "id": "gardnerella-vaginalis",
        "speciesName": "Gardnerella vaginalis",
        "referenceName": "genome assembly",
        "match": ["gardnerella vaginalis", "ugent 25.49"],
        "prefer": ["gcf_003397605", "genomic.fna"],
        "exclude": ["cds_from_genomic", "[gbkey=cds]", "protein_id="],
    },
]


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
    handler.send_header("Access-Control-Allow-Private-Network", "true")
    handler.end_headers()
    handler.wfile.write(body)


def write_redirect(handler: BaseHTTPRequestHandler, location: str) -> None:
    handler.send_response(302)
    handler.send_header("Location", location)
    handler.send_header("Content-Length", "0")
    handler.end_headers()


def write_static_file(handler: BaseHTTPRequestHandler, path: Path) -> None:
    body = path.read_bytes()
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    handler.send_response(200)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


def resolve_static_path(request_path: str) -> Path | None:
    if request_path == "/favicon.ico":
        return PROJECT_ROOT / "assets" / "wahj-logo.png"
    if request_path in {"/", "/local-ngs-workbench/"}:
        return PROJECT_ROOT / "local-ngs-workbench" / "index.html"
    decoded = unquote(request_path).lstrip("/")
    if not decoded:
        return None
    candidate = (PROJECT_ROOT / decoded).resolve()
    try:
        candidate.relative_to(PROJECT_ROOT.resolve())
    except ValueError:
        return None
    if not candidate.is_file():
        return None
    if candidate.suffix.lower() not in STATIC_EXTENSIONS:
        return None
    return candidate


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


def reference_text(reference: dict) -> str:
    return " ".join(
        str(reference.get(key, ""))
        for key in ["label", "header", "fileName", "path", "kind"]
    ).lower()


def is_partial_or_derived_reference(reference: dict) -> bool:
    text = reference_text(reference)
    file_name = str(reference.get("fileName", "")).lower()
    label = str(reference.get("label", "")).lower()
    bad_terms = [
        "cds_from_genomic",
        "transcripts.fa",
        "protein.faa",
        "complete cds",
        "[gbkey=cds]",
        "protein_id=",
        "gene=",
        "hbb",
        "tlr3",
        "il1b",
        "card8",
        "drd4",
        "faah",
    ]
    if any(term in text for term in bad_terms):
        return True
    if file_name == "homo_sapiens_assembly38.fasta":
        return False
    if re.search(r"chr[0-9xy]+[:_ -]", text) or re.search(r"\bchr[0-9xy]+\b", label):
        return True
    if re.search(r"\b[0-9]+:[0-9]+-[0-9]+", text):
        return True
    if file_name in {"20.fa.gz", "22_20-21m.fa"}:
        return True
    return False


def reference_completeness_score(reference: dict) -> int:
    text = reference_text(reference)
    if is_partial_or_derived_reference(reference):
        return -1000
    score = 0
    if "complete genome" in text:
        score += 90
    if "complete sequence" in text:
        score += 80
    if "whole genome shotgun sequence" in text:
        score += 65
    if "genomic.fna" in text or "genomic.fna.gz" in text:
        score += 45
    if "homo_sapiens_assembly38.fasta" in text:
        score += 100
    if "phoenix_ref.fasta" in text or "cmv_ref.fasta" in text or "ndv_ref.fasta" in text:
        score += 90
    if reference.get("bwaIndexReady"):
        score += 25
    if reference.get("faiReady"):
        score += 8
    if reference.get("annotationPath"):
        score += 6
    size = int(reference.get("sizeBytes") or 0)
    if size > 3_000_000_000:
        score += 25
    elif size > 500_000_000:
        score += 18
    elif size > 1_000_000:
        score += 8
    return score


def reference_rule_score(reference: dict, rule: dict) -> int:
    text = reference_text(reference)
    if any(term in text for term in rule.get("exclude", [])):
        return -1000
    if not any(term in text for term in rule.get("match", [])):
        return -1000
    score = reference_completeness_score(reference)
    for index, term in enumerate(rule.get("prefer", [])):
        if term in text:
            score += 60 - min(index, 20)
    return score


def recommended_threads(reference: dict) -> int:
    cpu_count = os.cpu_count() or 4
    size = int(reference.get("sizeBytes") or 0)
    if size > 1_000_000_000:
        return max(1, min(cpu_count, 8))
    if size > 100_000_000:
        return max(1, min(cpu_count, 6))
    return max(1, min(cpu_count, 4))


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
        self.organisms: dict[str, dict] = {}
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
        self.organisms = self._build_organisms()

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

    def _build_organisms(self) -> dict[str, dict]:
        organisms: dict[str, dict] = {}
        for rule in ORGANISM_RULES:
            scored = [
                (reference_rule_score(reference, rule), reference)
                for reference in self.references.values()
            ]
            scored = [(score, reference) for score, reference in scored if score > 0]
            if not scored:
                continue
            score, reference = sorted(
                scored,
                key=lambda item: (
                    item[0],
                    bool(item[1].get("bwaIndexReady")),
                    int(item[1].get("sizeBytes") or 0),
                ),
                reverse=True,
            )[0]
            threads = recommended_threads(reference)
            organisms[rule["id"]] = {
                "id": rule["id"],
                "organismId": rule["id"],
                "label": rule["speciesName"],
                "speciesName": rule["speciesName"],
                "referenceName": rule["referenceName"],
                "referenceId": reference["id"],
                "referenceLabel": reference["label"],
                "referenceFileName": reference["fileName"],
                "path": reference["path"],
                "sizeBytes": reference["sizeBytes"],
                "kind": reference["kind"],
                "bwaIndexReady": reference["bwaIndexReady"],
                "faiReady": reference["faiReady"],
                "annotationPath": reference["annotationPath"],
                "analysisDefaults": {
                    "qualityControl": "fastp when available",
                    "aligner": "bwa mem",
                    "postAlignment": "samtools sort, index, flagstat, stats",
                    "threads": threads,
                },
                "selectionScore": score,
            }
        return dict(sorted(organisms.items(), key=lambda item: item[1]["label"].lower()))

    def list_organisms(self) -> list[dict]:
        return list(self.organisms.values())

    def get_organism(self, organism_id: str) -> dict | None:
        return self.organisms.get(organism_id)

    def get_selected_reference(self, selection_id: str) -> tuple[dict | None, dict | None]:
        organism = self.get_organism(selection_id)
        if organism:
            reference = self.get(organism["referenceId"])
            if reference:
                reference = dict(reference)
                reference["organismId"] = organism["id"]
                reference["organismName"] = organism["speciesName"]
                reference["referenceName"] = organism["referenceName"]
                return reference, organism
        reference = self.get(selection_id)
        return reference, None


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


def ensure_bwa_index(reference_path: Path, commands: list[dict]) -> bool:
    if has_bwa_index(reference_path):
        return True
    if not command_exists("bwa"):
        return False
    result = run_command(["bwa", "index", str(reference_path)])
    commands.append(result)
    return result["returncode"] == 0 and has_bwa_index(reference_path)


def infer_read2_path(read1: Path) -> Path | None:
    name = read1.name
    replacements = [
        ("_R1_", "_R2_"),
        ("_R1.", "_R2."),
        ("_R1.fastq", "_R2.fastq"),
        ("_R1.fq", "_R2.fq"),
        ("_1.fastq", "_2.fastq"),
        ("_1.fq", "_2.fq"),
        ("-R1-", "-R2-"),
        ("-R1.", "-R2."),
        (".R1.", ".R2."),
    ]
    for before, after in replacements:
        if before in name:
            candidate = read1.with_name(name.replace(before, after, 1))
            if candidate.exists():
                return candidate
    return None


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


def normalize_input_path(value: object) -> str:
    text = str(value or "").strip()
    while len(text) >= 2 and text[0] == text[-1] and text[0] in {"'", '"'}:
        text = text[1:-1].strip()
    return text


def sanitize_upload_filename(filename: str) -> str:
    name = Path(filename or "uploaded.fastq").name.strip()
    name = re.sub(r"[^A-Za-z0-9._ +()-]+", "_", name)
    name = name.strip(" .")[:180]
    return name or "uploaded.fastq"


def parse_content_disposition(value: str) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for part in value.split(";"):
        part = part.strip()
        if "=" not in part:
            parsed.setdefault("type", part.lower())
            continue
        key, raw = part.split("=", 1)
        key = key.strip().lower()
        raw = raw.strip()
        if len(raw) >= 2 and raw[0] == raw[-1] == '"':
            raw = raw[1:-1]
        parsed[key] = raw
    return parsed


def boundary_from_content_type(content_type: str) -> bytes:
    match = re.search(r"boundary=(?:\"([^\"]+)\"|([^;]+))", content_type)
    if not match:
        raise ValueError("Missing multipart boundary.")
    boundary = (match.group(1) or match.group(2)).strip()
    if not boundary:
        raise ValueError("Empty multipart boundary.")
    return f"--{boundary}".encode("utf-8")


def read_multipart_headers(handler: BaseHTTPRequestHandler) -> dict[str, str]:
    headers: dict[str, str] = {}
    while True:
        line = handler.rfile.readline(64 * 1024)
        if line in {b"\r\n", b"\n", b""}:
            return headers
        text = line.decode("utf-8", errors="replace").strip()
        if ":" not in text:
            continue
        key, value = text.split(":", 1)
        headers[key.strip().lower()] = value.strip()


def stream_multipart_part(
    handler: BaseHTTPRequestHandler,
    boundary: bytes,
    sink,
    max_bytes: int | None = None,
) -> tuple[bytes, int]:
    previous: bytes | None = None
    written = 0
    while True:
        line = handler.rfile.readline(MULTIPART_READ_SIZE)
        if line == b"":
            raise EOFError("Unexpected end of multipart upload.")
        if line.startswith(boundary):
            if previous is not None:
                if previous.endswith(b"\r\n"):
                    previous = previous[:-2]
                elif previous.endswith(b"\n"):
                    previous = previous[:-1]
                if previous:
                    sink.write(previous)
                    written += len(previous)
            return line, written
        if previous is not None:
            sink.write(previous)
            written += len(previous)
            if max_bytes is not None and written > max_bytes:
                raise ValueError("Multipart form field is too large.")
        previous = line


def read_multipart_upload(
    handler: BaseHTTPRequestHandler,
    upload_dir: Path,
) -> tuple[dict[str, str], dict[str, Path]]:
    content_type = handler.headers.get("Content-Type", "")
    boundary = boundary_from_content_type(content_type)
    final_boundary = boundary + b"--"
    first_line = handler.rfile.readline(MULTIPART_READ_SIZE)
    if not first_line.startswith(boundary):
        raise ValueError("Invalid multipart upload.")

    fields: dict[str, str] = {}
    files: dict[str, Path] = {}
    boundary_line = first_line
    while boundary_line and not boundary_line.startswith(final_boundary):
        headers = read_multipart_headers(handler)
        if not headers:
            break
        disposition = parse_content_disposition(headers.get("content-disposition", ""))
        field_name = disposition.get("name", "")
        filename = disposition.get("filename", "")
        if filename:
            safe_name = sanitize_upload_filename(filename)
            target = upload_dir / safe_name
            counter = 1
            while target.exists():
                target = upload_dir / f"{target.stem}-{counter}{target.suffix}"
                counter += 1
            with target.open("wb") as handle:
                boundary_line, _ = stream_multipart_part(handler, boundary, handle)
            files[field_name] = target
        else:
            buffer = io.BytesIO()
            boundary_line, _ = stream_multipart_part(
                handler,
                boundary,
                buffer,
                max_bytes=MAX_FORM_FIELD_BYTES,
            )
            fields[field_name] = buffer.getvalue().decode("utf-8", errors="replace")
    return fields, files


def run_alignment_pipeline(job_dir: Path, payload: dict, reference: dict, store: JobStore) -> None:
    job_id = job_dir.name
    read1_value = normalize_input_path(payload.get("read1Path"))
    read2_value = normalize_input_path(payload.get("read2Path"))
    commands: list[dict] = []
    status = {
        "jobId": job_id,
        "state": "running",
        "createdAt": now_iso(),
        "organism": reference.get("organismName", ""),
        "reference": reference,
        "read1Path": read1_value,
        "read2Path": read2_value,
        "steps": [],
        "reportPath": str(job_dir / "report.json"),
    }
    store.write_status(job_dir, status)

    try:
        requested_threads = payload.get("threads")
        if requested_threads:
            thread_count = max(1, min(int(requested_threads), os.cpu_count() or 4))
        else:
            thread_count = recommended_threads(reference)
        threads = str(thread_count)
        read1 = Path(read1_value).expanduser()
        read2 = Path(read2_value).expanduser() if read2_value else None
        reference_path = Path(reference["path"])

        if not read1.exists():
            raise FileNotFoundError(f"Read 1 file does not exist: {read1}")
        if read2 and not read2.exists():
            raise FileNotFoundError(f"Read 2 file does not exist: {read2}")
        read2_auto_detected = False
        if not read2:
            inferred_read2 = infer_read2_path(read1)
            if inferred_read2:
                read2 = inferred_read2
                read2_auto_detected = True
        if not reference_path.exists():
            raise FileNotFoundError(f"Reference file does not exist: {reference_path}")

        status["read2Path"] = str(read2) if read2 else ""
        status["read2AutoDetected"] = read2_auto_detected
        status["analysisPreset"] = {
            "qualityControl": "fastp" if command_exists("fastp") else "skipped; fastp not installed",
            "aligner": "bwa mem",
            "postAlignment": "samtools sort, index, flagstat, stats",
            "threads": thread_count,
        }
        store.write_status(job_dir, status)

        fai = ensure_fai(reference_path, commands)
        genome_structure = genome_structure_from_fai(fai)
        annotation = annotation_summary(reference.get("annotationPath", ""))

        trimmed_1 = read1
        trimmed_2 = read2
        fastp_json = job_dir / "fastp.json"
        fastp_html = job_dir / "fastp.html"
        run_fastp = payload.get("runFastp")
        run_fastp = command_exists("fastp") if run_fastp is None else bool(run_fastp)
        if run_fastp and command_exists("fastp"):
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
            status["steps"].append({"name": "bwa_index", "state": "running"})
            store.write_status(job_dir, status)
        if not ensure_bwa_index(reference_path, commands):
            raise RuntimeError(
                f"BWA index could not be created beside reference: {reference_path}. "
                "Check disk space and reference file permissions."
            )
        if status["steps"] and status["steps"][-1]["name"] == "bwa_index":
            status["steps"][-1]["state"] = "done"
            store.write_status(job_dir, status)

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
            "organism": reference.get("organismName", ""),
            "reference": reference,
            "inputs": {
                "read1Path": str(read1),
                "read2Path": str(read2) if read2 else "",
                "read2AutoDetected": read2_auto_detected,
                "trimmedRead1Path": str(trimmed_1),
                "trimmedRead2Path": str(trimmed_2) if trimmed_2 else "",
            },
            "analysisPreset": status["analysisPreset"],
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


def create_uploaded_job(
    handler: BaseHTTPRequestHandler,
    catalog: ReferenceCatalog,
    store: JobStore,
) -> None:
    job_dir = store.create_job_dir()
    upload_dir = job_dir / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    status = {
        "jobId": job_dir.name,
        "state": "uploading",
        "createdAt": now_iso(),
        "steps": [{"name": "upload_fastq", "state": "running"}],
        "reportPath": str(job_dir / "report.json"),
    }
    store.write_status(job_dir, status)

    try:
        fields, files = read_multipart_upload(handler, upload_dir)
        selection_id = str(fields.get("organismId") or fields.get("referenceId") or "")
        reference, organism = catalog.get_selected_reference(selection_id)
        if not reference:
            raise ValueError("Unknown organism.")

        read1_path = files.get("read1File") or files.get("read1")
        read2_path = files.get("read2File") or files.get("read2")
        if not read1_path:
            raise ValueError("Upload a Read 1 FASTQ file.")

        payload = {
            "organismId": selection_id,
            "organismName": organism["speciesName"] if organism else "",
            "read1Path": str(read1_path),
            "read2Path": str(read2_path) if read2_path else "",
            "inputMode": "upload",
        }
        status.update(
            {
                "state": "queued",
                "organism": reference.get("organismName", ""),
                "reference": reference,
                "read1Path": str(read1_path),
                "read2Path": str(read2_path) if read2_path else "",
                "steps": [{"name": "upload_fastq", "state": "done"}],
                "uploads": {
                    "read1File": read1_path.name,
                    "read2File": read2_path.name if read2_path else "",
                    "uploadDirectory": str(upload_dir),
                },
            }
        )
        store.write_status(job_dir, status)
        thread = threading.Thread(
            target=run_alignment_pipeline,
            args=(job_dir, payload, reference, store),
            daemon=True,
        )
        thread.start()
        write_json(handler, 202, status)
    except Exception as exc:
        status["state"] = "failed"
        status["error"] = str(exc)
        status["steps"] = [{"name": "upload_fastq", "state": "failed"}]
        store.write_status(job_dir, status)
        (job_dir / "report.json").write_text(
            json.dumps(
                {
                    "jobId": job_dir.name,
                    "failedAt": now_iso(),
                    "error": str(exc),
                    "traceback": traceback.format_exc(),
                },
                indent=2,
                sort_keys=True,
            )
        )
        write_json(handler, 400, {"error": str(exc), "jobId": job_dir.name})


def build_handler(catalog: ReferenceCatalog, store: JobStore):
    class Handler(BaseHTTPRequestHandler):
        server_version = "WahjLocalNGS/0.1"

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Vary", "Access-Control-Request-Private-Network")
            self.end_headers()

        def do_HEAD(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/local-ngs-workbench":
                self.send_response(302)
                self.send_header("Location", "/local-ngs-workbench/")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            static_path = resolve_static_path(parsed.path)
            if static_path:
                content_type = mimetypes.guess_type(static_path.name)[0] or "application/octet-stream"
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(static_path.stat().st_size))
                self.send_header("Cache-Control", "no-store")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                return
            write_json(self, 404, {"error": "Not found."})

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/local-ngs-workbench":
                write_redirect(self, "/local-ngs-workbench/")
                return
            if parsed.path == "/api/health":
                write_json(
                    self,
                    200,
                    {
                        "ok": True,
                        "service": "Wahj Local NGS Server",
                        "time": now_iso(),
                        "jobRoot": str(store.root),
                        "organismCount": len(catalog.list_organisms()),
                        "rawReferenceCount": len(catalog.list()),
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
                organisms = catalog.list_organisms()
                write_json(
                    self,
                    200,
                    {
                        "organisms": organisms,
                        "references": organisms,
                        "rawReferenceCount": len(catalog.list()),
                    },
                )
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
            static_path = resolve_static_path(parsed.path)
            if static_path:
                write_static_file(self, static_path)
                return
            write_json(self, 404, {"error": "Not found."})

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/api/jobs/upload":
                create_uploaded_job(self, catalog, store)
                return
            if parsed.path == "/api/jobs":
                try:
                    payload = read_json(self)
                    selection_id = str(payload.get("organismId") or payload.get("referenceId") or "")
                    reference, organism = catalog.get_selected_reference(selection_id)
                    if not reference:
                        write_json(self, 400, {"error": "Unknown organism."})
                        return
                    if organism:
                        payload["organismId"] = organism["id"]
                        payload["organismName"] = organism["speciesName"]
                    job_dir = store.create_job_dir()
                    status = {
                        "jobId": job_dir.name,
                        "state": "queued",
                        "createdAt": now_iso(),
                        "organism": reference.get("organismName", ""),
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
    print(f"Organisms: {len(catalog.list_organisms())}")
    print(f"Raw references: {len(catalog.list())}")
    print(f"Jobs: {store.root}")
    server.serve_forever()


if __name__ == "__main__":
    main()
