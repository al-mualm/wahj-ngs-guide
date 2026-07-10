# Firebase Account Setup

The static site account pages are connected to the Firebase project `wahj-ngs-guide`.

## Recommended Behavior

- Registration is required before visitors can use the lectures and tools.
- Registration is required before visitors can use the lectures and tools.
- Email verification is required before using an address for future email updates.
- Reading history stores page URL, page title, section ID, scroll position, language, and timestamp.
- Any local browser history from before sign-in syncs to Firestore after the user creates an account.
- Firestore is the main account database. Google Sheets should be used only for exported or synced
  contact lists, not as the secure account database.

## Current Firebase Settings

- Project name: `Wahj NGS Guide`
- Project ID: `wahj-ngs-guide`
- Web app nickname: `wahj-ngs-guide`
- Authentication provider: Email/Password enabled
- Authorized domains: `localhost`, `wahj-ngs-guide.firebaseapp.com`, `al-mualm.github.io`
- Firestore database: `(default)`
- Firestore location: `me-central2 (Dammam)`
- Firestore mode: Production mode
- Firestore rules: published from `firebase/firestore.rules`

You do not need Firebase Hosting right now because the site already uses GitHub Pages.

## If You Need To Recreate This Later

1. Create a separate Firebase project for Wahj Al-DNA.
2. Go to **Build > Authentication**.
3. Click **Get started**.
4. Open **Sign-in method** and enable **Email/Password**.
5. In **Authentication > Settings > Authorized domains**, make sure these are allowed:
    - `al-mualm.github.io`
    - `localhost` for local testing
6. Go to **Build > Firestore Database**.
7. Create a Firestore database in **Production mode**.
8. Choose a database location close to the main audience.
9. Open **Rules** and paste the contents of `firebase/firestore.rules`, then publish.
10. Open **Project settings > General > Your apps**.
11. Add a **Web app** and copy its Firebase config.
12. Paste those values into `config.js` and set `firebase.enabled` to `true`.

## Config Example

Only paste the public web config values from Firebase. Do not paste service-account JSON or private
keys into this repository.

```js
firebase: {
  enabled: true,
  apiKey: "YOUR_PUBLIC_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "OPTIONAL_MEASUREMENT_ID"
}
```

## Google Sheets

Do not send names and emails through the current public JSONP visit-counter endpoint. Query-string
requests are acceptable for anonymous counters, but they are not a good path for personal
information.

Recommended flow:

1. Store profiles and history in Firestore.
2. Export verified, opted-in users from Firestore to Google Sheets later.
3. If automatic sync is needed, add a Firebase Cloud Function or trusted server process that writes
   only verified, opted-in contacts to the Sheet.

Suggested Sheet columns:

```text
uid | full_name | email | role | country | institution | email_opt_in | email_verified | created_at | last_seen_at | last_seen_page
```
