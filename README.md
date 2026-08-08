# Attendance System — Next.js

This is a Next.js (App Router + TypeScript) port of the original Flask +
Google Sheets attendance system. It keeps the same data model (Google
Sheets as the database: `Users`, `Attendance`, `Devices`, `Leaves`), the
same features, and — importantly — the same **password hash format**, so
your existing spreadsheet and employee logins keep working with zero
migration.

## Feature parity with the Flask app

- Employee login, device-binding (one trusted browser per account)
- Check-in / check-out with automatic working-hours calculation
- Employee dashboard: 30-day history, leave requests
- Admin panel: live stats, today's attendance, user management
  (add / change password / toggle admin / activate-deactivate / reset
  device), CSV user import, attendance-by-date editing, per-user
  attendance history with CSV & DOCX export
- Leave request approval workflow
- **Analytics dashboard** (`/admin/analytics`): attendance trend over
  time, department comparison (attendance rate & avg daily hours), and
  punctuality (on-time vs late, overall and by department), switchable
  between 7/30/90-day windows

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

### `SECRET_KEY`
Any long random string, used to sign the login session cookie.

### Google Sheets access
Unlike the Flask app (which used `gspread` and could open a spreadsheet by
*name* via the Drive API), this app opens the spreadsheet directly by
**ID**, which is the standard/lightweight approach for Node:

1. Open (or create) your Google Sheet in the browser and copy the ID out
   of its URL: `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
   → put it in `GOOGLE_SHEET_ID`.
2. Reuse the same service account / `credentials.json` your Flask app
   used. Either:
   - Set `GOOGLE_CREDENTIALS_JSON` to the full JSON key file contents
     (one line), **or**
   - Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY`
     separately (copy the `private_key` field, keep the `\n` sequences
     literal — the app un-escapes them for you).
3. **Share the spreadsheet with the service account's email address**
   (found in the JSON key as `client_email`) as an **Editor**, if you
   haven't already — this is required for the app to read/write it.

If the sheet is empty, the app will create the `Users`, `Attendance`,
`Devices`, and `Leaves` tabs automatically on first run, including a
default `admin` / `admin123` account — exactly like the Flask app did.

### Timezone
`TIMEZONE` controls check-in/out timestamps (e.g. `Asia/Karachi`).

### Analytics (optional)
`EXPECTED_START_TIME` (default `09:00:00`) and `EXPECTED_GRACE_MINUTES`
(default `15`) control what the Analytics page's punctuality chart counts
as "on time" — a check-in at or before start time + grace period.

## 3. Run

```bash
npm run dev      # development
npm run build && npm run start   # production
```

This app is intended to run as a **persistent Node.js server**
(`next start`), not as short-lived serverless/edge functions — the
in-memory cache and the users-sheet write lock (ported from the Flask
app's `TTLCache` / `threading.Lock`) assume a single long-running process,
matching the original Flask app's own assumptions.

## Architecture notes / what changed from Flask

| Flask | Next.js |
|---|---|
| Flask-Login session cookie | Signed JWT cookie (`src/lib/session.ts`) |
| `flash()` / `get_flashed_messages()` | Short-lived cookie + `<FlashBanner />` client component |
| Jinja templates | React Server Components (`src/app/**/page.tsx`) |
| Form `POST` routes | Next.js Server Actions (`src/lib/actions.ts`) |
| `gspread` + `oauth2client` | `google-spreadsheet` + `google-auth-library` |
| Werkzeug `generate_password_hash` | Re-implemented in `src/lib/password.ts` (same `pbkdf2:sha256` format — hashes are cross-compatible) |
| `python-docx` export | `docx` npm package (`src/app/api/admin/user/[username]/export-docx`) |
| `@login_required` / `@admin_required` | `middleware.ts` (route guard) + `requireUser()`/`requireAdmin()` (defense-in-depth inside Server Actions) |
| Bootstrap 5 / Bootstrap Icons / DataTables (CDN) | Same CDN assets, loaded in `src/app/layout.tsx` |

## Security notes

- Rotate `SECRET_KEY` — don't reuse the one from the old Flask `.env`.
- Treat your Google service account JSON key the same way you did before:
  keep it out of version control (`.env.local` is already gitignored).
