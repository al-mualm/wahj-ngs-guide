# Wahj NGS Guide

This project is a polished static educational webpage about Next-Generation Sequencing (NGS) for beginners in molecular biology and bioinformatics.

## Project contents

- `index.html` — the main webpage
- `styles.css` — visual design, layout, and responsive styling
- `script.js` — navigation, glossary filtering, registration gate, and visitor count logic
- `config.js` — site configuration, including the Google Apps Script endpoint URL
- `assets/wahj-logo.png` — transparent Wahj logo used in the page
- `assets/wahj-logo-white-bg.png` — alternate logo copy
- `backend/google-apps-script/` — backend files for storing registrations in Google Sheets

## Branding notes

The design uses public-facing Wahj branding cues from the Wahj website:

- scientific and educational identity
- training, qualification, and research-oriented messaging
- professional blue and red logo colors with a clean academic presentation

## How to open locally

Option 1:

1. Open `/Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide/index.html` in any modern web browser.

Option 2:

1. In Terminal, go to the project folder:
   `cd "/Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide"`
2. Start a simple local server:
   `python3 -m http.server 8000`
3. Open:
   `http://localhost:8000`

## Notes

- The site is fully static and designed to work offline after the files are copied together.
- No heavy framework is required.
- All major diagrams are built with HTML, CSS, and SVG so there is no dependency on external graphic libraries.

## Registration and visitor count

The site now includes:

- a first-screen registration gate for name, phone number, affiliation, and preferred language
- bilingual entry labels in English and Arabic
- a footer counter for unique registered visitors

The recommended storage path is Google Sheets through Google Apps Script.

- Spreadsheet already created:
  `https://docs.google.com/spreadsheets/d/1bF4CgbdG_0K34i9yM9gZl3yweLBwli_XLeARUMeJqFo/edit`
- Backend template:
  `/Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide/backend/google-apps-script`

To make the public site save live registrations:

1. Deploy the Apps Script backend from `backend/google-apps-script/`.
2. Paste the deployed web app URL into `config.js` as `registrationApiUrl`.
3. Push the updated site to GitHub Pages again.
