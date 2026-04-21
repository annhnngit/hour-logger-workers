# hour-logger-workers

Standalone Cloudflare Worker that handles `GET /api/log` and `POST /api/log` for the Hour Logger app.

Deploy this if you prefer a pure Worker (with a `*.workers.dev` URL) instead of using the Pages Function bundled with the frontend.

## Setup

### Secrets

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
# paste the full contents of your service account JSON key

npx wrangler secret put SPREADSHEET_ID
# paste your Google Sheet ID
```

Or add them in the Cloudflare dashboard under **Workers → your worker → Settings → Variables**.

### Local dev

Create `.dev.vars` (never commit):

```ini
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
SPREADSHEET_ID=your_spreadsheet_id
```

Then:

```bash
npm install
npm run dev
```

### Deploy

```bash
npm run deploy
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/log` | Returns last 10 rows (newest first) as `{ rows: [[...], ...] }` |
| POST | `/api/log` | Appends a row. Body: `{ date, start, finish, duration, client, note }` |

## Note

If using Cloudflare Pages for the frontend, you do **not** need this Worker — the `functions/api/log.js` in the Pages repo handles the same logic as a Pages Function. Use this repo only if you want to run the API as a standalone Worker.
