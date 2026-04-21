const SHEET_RANGE = "Sheet1!A:F";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

// ── OAuth2 helpers ──────────────────────────────────────────────────────────

async function getAccessToken(serviceAccountJson) {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: SCOPES,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = encode(header);
  const claimB64 = encode(claim);
  const signingInput = `${headerB64}.${claimB64}`;

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const sigBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const msg = await tokenRes.text();
    throw new Error(`OAuth token error: ${msg}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

// ── CORS ─────────────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
    }

    if (url.pathname !== "/api/log") {
      return new Response("Not found", { status: 404 });
    }

    try {
      const token = await getAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const spreadsheetId = env.SPREADSHEET_ID;

      if (request.method === "GET") {
        const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
          SHEET_RANGE
        )}?majorDimension=ROWS`;

        const res = await fetch(sheetsUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const msg = await res.text();
          return new Response(`Sheets GET error: ${msg}`, { status: 502 });
        }

        const data = await res.json();
        const allRows = data.values || [];
        const dataRows = allRows.slice(1);
        const recent = dataRows.slice(-10).reverse();

        return Response.json({ rows: recent }, { headers: corsHeaders(allowedOrigin) });
      }

      if (request.method === "POST") {
        const body = await request.json();
        const { date, start, finish, duration, client, note } = body;

        if (!date || !start || !finish) {
          return new Response("Missing required fields", { status: 400 });
        }

        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
          SHEET_RANGE
        )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

        const res = await fetch(appendUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [[date, start, finish, duration ?? "", client ?? "", note ?? ""]],
          }),
        });

        if (!res.ok) {
          const msg = await res.text();
          return new Response(`Sheets append error: ${msg}`, { status: 502 });
        }

        return Response.json({ ok: true }, { headers: corsHeaders(allowedOrigin) });
      }

      return new Response("Method not allowed", { status: 405 });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  },
};
