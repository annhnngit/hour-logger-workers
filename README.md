# hour-logger-workers

Cloudflare Worker API for the Hour Logger app. Handles `GET /api/log` and `POST /api/log`, authenticates with a Google service account, and reads/writes a Google Sheet.

The frontend (`hour-logger` repo) calls this Worker via the `VITE_API_URL` environment variable set in Cloudflare Pages.

## Secrets

Add these in the Cloudflare dashboard under **Workers → your worker → Settings → Variables**, or via CLI:

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
# paste the full contents of your service account JSON key

npx wrangler secret put SPREADSHEET_ID
# paste your Google Sheet ID (from the sheet URL)

npx wrangler secret put ALLOWED_ORIGIN
# paste your Pages URL, e.g. https://hour-logger.pages.dev
```

## Local dev

Create `.dev.vars` (never commit this file):

```ini
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
SPREADSHEET_ID=your_spreadsheet_id
ALLOWED_ORIGIN=http://localhost:5173
```

Then:

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

After deploying, copy the Worker URL (e.g. `https://hour-logger-workers.your-subdomain.workers.dev`) and set it as `VITE_API_URL` in the **hour-logger Pages** environment variables.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/log` | Returns last 10 rows (newest first) as `{ rows: [[...], ...] }` |
| POST | `/api/log` | Appends a row. Body: `{ date, start, finish, duration, client, note }` |
