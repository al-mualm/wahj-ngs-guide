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

## What it does now

- reads the centralized reference manifest in `~/Downloads/Reference_Genomes_Collected_2026-06-19`
- exposes references to the website
- creates local analysis jobs under `~/Downloads/Wahj_NGS_Jobs`
- accepts FASTQ paths already present on the Mac
- runs `fastp` when available
- runs `bwa mem` + `samtools sort/index` when a BWA index exists beside the selected reference
- reports `samtools flagstat`, `samtools stats`, genome structure from `.fai`, and annotation feature counts when GFF/GTF is found

## Why FASTQ paths, not browser upload?

Large FASTQ files should not be pushed through the browser into the same Mac.
For a local server, the fastest and safest method is to paste local FASTQ paths
into the website. The backend reads them directly from disk.

## Important

The server binds to `127.0.0.1` by default, so it is local-only. Do not bind it
to `0.0.0.0` on a public network without adding authentication and storage
limits.
