# Sequence Analysis Backend Deployment

Use this guide after updating the Apps Script code in `backend/google-apps-script/`.

## Deploy steps

1. Open the existing Google Apps Script project used by the site.
2. Replace or update the files from:
   - `/Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide/backend/google-apps-script/`
3. In Apps Script, open **Project Settings** or **Script Properties**.
4. Add these Script Properties:
   - `NCBI_CONTACT_EMAIL`
   - `NCBI_TOOL_NAME`
5. Deploy the script as a Web App:
   - Execute as: `Me`
   - Access: `Anyone`
6. Copy the deployed Web App URL.
7. Put that URL into [config.js](</Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide/config.js>) as `sequenceAnalysisApiUrl`.
8. Keep `sequenceAnalysisDemoEnabled` available so the teaching page still works when live BLAST is not needed.

## Test order

1. Test `taxonomySearch` with a safe organism name such as `Bacillus pumilus`.
2. Test `blastSubmit` with a short teaching sequence that is safe for public NCBI submission.
3. Wait before polling for status.
4. Test `blastStatus`.
5. Test `blastResult`.

## Required cautions

- NCBI receives submitted sequences during live BLAST use.
- Do not submit confidential, clinical, or unpublished sensitive sequences.
- This page is for teaching and research training, not diagnosis.
- Respect NCBI public-service limits and avoid repeated rapid submissions.

## Configuration summary

- `sequenceAnalysisApiUrl` must point to the deployed Apps Script Web App.
- `sequenceAnalysisDemoEnabled` can remain `true` even after live deployment.
- `NCBI_CONTACT_EMAIL` must be set or BLAST submission will return a setup error.
- `NCBI_TOOL_NAME` should identify the Wahj teaching tool in NCBI requests.
