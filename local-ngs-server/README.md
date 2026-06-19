# Wahj Local NGS Server

This is the local Mac backend for the Wahj NGS website. It runs on the MacBook
instead of a rented server.

## Start

```bash
cd "/Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide-local-ngs"
python3 local-ngs-server/server.py
```

Default URL:

```text
http://127.0.0.1:8787
```

Open the workbench here after the server starts:

```text
http://127.0.0.1:8787/local-ngs-workbench/
```

The GitHub Pages copy is useful for navigation and publishing, but some
browsers block a public HTTPS page from calling a local loopback server. The
local workbench URL is served by the same Python process as the analysis API.

## What it does now

- reads the centralized reference manifest in `~/Downloads/Reference_Genomes_Collected_2026-06-19`
- serves the local workbench page from `http://127.0.0.1:8787/local-ngs-workbench/`
- exposes only curated complete-genome organism choices to the website
- creates local analysis jobs under `~/Downloads/Wahj_NGS_Jobs`
- accepts FASTQ paths already present on the Mac
- automatically selects `fastp`, thread count, complete reference genome, BWA indexing, and `bwa mem`
- auto-detects Read 2 when common paired-end names are used and Read 2 is left blank
- runs `samtools sort/index`
- reports `samtools flagstat`, `samtools stats`, genome structure from `.fai`, and annotation feature counts when GFF/GTF is found

## Why FASTQ paths, not browser upload?

Large FASTQ files should not be pushed through the browser into the same Mac.
For a local server, the fastest and safest method is to paste local FASTQ paths
into the website. The backend reads them directly from disk.

## Important

The server binds to `127.0.0.1` by default, so it is local-only. Do not bind it
to `0.0.0.0` on a public network without adding authentication and storage
limits.
