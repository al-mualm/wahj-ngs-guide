# Wahj Molecular Biology Learning Hub

This project is a static educational website for Wahj Al-DNA. It currently includes:

- a learning hub homepage
- an English Next-Generation Sequencing guide
- an Arabic NGS guide
- a Real-Time PCR teaching page with a gene expression calculator
- a Sanger Sequence Analysis & BLAST Alignment page for teaching sequence cleaning, taxonomy lookup, and BLAST interpretation

## Project contents

- `index.html` — learning hub homepage
- `styles.css` — shared layout and component styling
- `script.js` — shared navigation, reader counter, reveal effects, and comments logic
- `config.js` — site configuration, including backend URLs and feature flags
- `ngs/index.html` — English NGS guide
- `ar/index.html` — Arabic NGS guide
- `real-time-pcr/index.html` — Real-Time PCR guide
- `pcr-calculator.js` — qPCR expression calculator logic
- `sequence-analysis/index.html` — Sanger sequence analysis page
- `sequence-analysis/sequence-analysis.css` — page-specific sequence-analysis styling
- `sequence-analysis/sequence-analysis.js` — sequence cleaning, demo mode, taxonomy, and BLAST workflow UI
- `assets/` — logos and SVG teaching diagrams
- `backend/google-apps-script/` — Google Apps Script backend used for the reader counter, comments, and Sequence Analysis API actions
- `docs/` — project notes and backend deployment documentation

## Branding notes

The design uses Wahj public branding cues:

- scientific and educational identity
- training, qualification, and research-oriented presentation
- professional blue and red molecular branding

## How to open locally

Option 1:

1. Open [index.html](</Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide/index.html>) in a modern browser.

Option 2:

1. In Terminal, go to the project folder:
   `cd "/Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide"`
2. Start a simple local server:
   `python3 -m http.server 8000`
3. Open:
   `http://localhost:8000`

## Live features

The site includes live backend-supported features:

- anonymous reader counter
- professional comments
- Sequence Analysis actions for:
  - `taxonomySearch`
  - `blastSubmit`
  - `blastStatus`
  - `blastResult`

The reader counter and comments continue to work with the existing Google Apps Script deployment. The Sequence Analysis live BLAST workflow requires that the Apps Script code in `backend/google-apps-script/` be deployed with the new actions.

## Sequence Analysis notes

The Sanger Sequence Analysis page supports:

- FASTA-aware sequence cleaning
- reverse complement generation
- sequence length and ambiguity review
- NCBI Taxonomy candidate lookup
- BLAST submission and status/result retrieval through Apps Script
- a demo mode for teaching when the backend is unavailable

Important:

- When students use live BLAST, submitted sequences are sent to public NCBI services.
- Do not submit confidential, clinical, human-identifiable, or unpublished sensitive sequences.
- The page is for teaching and research training, not diagnosis.

## Apps Script deployment

For the Sequence Analysis backend deployment steps, see:

- [docs/sequence-analysis-backend-deploy.md](</Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide/docs/sequence-analysis-backend-deploy.md>)

The required Script Properties are:

- `NCBI_CONTACT_EMAIL`
- `NCBI_TOOL_NAME`

The site configuration values in `config.js` used by the Sequence Analysis page are:

- `sequenceAnalysisApiUrl`
- `sequenceAnalysisDemoEnabled`

## Notes

- The core teaching pages are static and can be browsed locally.
- The BLAST demo mode works without live NCBI access.
- The live BLAST workflow depends on the Apps Script deployment and NCBI availability.
