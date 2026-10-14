# Dilipoint LeadBase

A shared lead management MVP built with Next.js, Firebase Admin/Cloud Firestore, and ExcelJS.

## Requirements

- Node.js 20.9 or newer
- A Firebase project with Cloud Firestore enabled
- A Firebase service account for the server-side app

## Connect Firebase

1. Create or select a Firebase project and create its Cloud Firestore database.
2. In Firebase Console, create a service account with Firestore access and generate a private key.
3. Copy `.env.example` to `.env.local` and fill in the project ID, service account email, and private key.
4. Keep `.env.local` private. Never use `NEXT_PUBLIC_` for service account credentials or commit the private key.

The server uses Firebase Admin, so these credentials stay on the server. The Admin SDK bypasses Firestore Security Rules; restrict and protect the deployed app and service account accordingly.

The app writes lead documents to `leads` and uses `leadPhoneIndex` as an atomic uniqueness index. Firestore transactions create/update both together, which prevents two simultaneous submissions from claiming the same normalized WhatsApp number. Firestore creates these collections on first write; no SQL setup or manual indexes are required.

You can also provide `FIREBASE_SERVICE_ACCOUNT_JSON` as a single-line JSON environment variable, or use Google Application Default Credentials by setting `FIREBASE_PROJECT_ID` in an environment that supplies ADC.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production build and server:

```bash
npm run build
npm start
```

Every user should use the same deployed app and Firebase project to share the same leads. Accounts and user attribution are not included in this MVP.

## Features

- Dashboard totals, live search, flexible sorting, and paginated Cold Leads and Prospects lists.
- Server-side validation and transactional duplicate checks in Firestore.
- Convert/revert status on the same lead while retaining the original add date.
- Edit and confirmed deletion.
- Formatted `.xlsx` downloads for all records in each status, independent of pagination.
