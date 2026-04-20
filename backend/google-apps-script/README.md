# Google Apps Script Backend

This script connects the public GitHub Pages site to the Google Sheet used for visitor registration and counting.

## Spreadsheet

- Google Sheet: `Wahj NGS Guide Visitors`
- URL: `https://docs.google.com/spreadsheets/d/1bF4CgbdG_0K34i9yM9gZl3yweLBwli_XLeARUMeJqFo/edit`

## What the script does

- accepts visitor registrations from the site
- appends each submission to the `Registrations` sheet
- marks repeated phone numbers as repeat registrations
- returns a stored visitor count based on unique phone numbers

## Manual deployment steps

1. Open [script.google.com](https://script.google.com/).
2. Create a new standalone Apps Script project.
3. Replace the default code with the contents of `Code.gs`.
4. Replace the project manifest with `appsscript.json`.
5. Save the project.
6. Click `Deploy` -> `New deployment`.
7. Choose type `Web app`.
8. Set:
   - Execute as: `Me`
   - Who has access: `Anyone`
9. Deploy and copy the web app URL.
10. Paste that web app URL into `config.js` as `registrationApiUrl`.

## After deployment

Once the `registrationApiUrl` is filled in and pushed to GitHub Pages, the site will:

- ask every new visitor for name, phone number, affiliation, and language
- store the submission in Google Sheets
- display the stored unique registered visitor count in the footer
