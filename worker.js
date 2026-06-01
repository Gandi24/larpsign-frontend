// ---------------------------------------------------------------------------
// Cloudflare Worker — the secure submission backend.
//
// It receives a JSON submission from the static site and commits it as a file
// to a PRIVATE GitHub repo. The GitHub token NEVER touches the browser; it
// lives here as an encrypted Worker secret.
//
// Deploy:
//   1. npm i -g wrangler && wrangler login
//   2. wrangler deploy
//   3. wrangler secret put GH_TOKEN     (paste a fine-grained PAT — see README)
//   4. Set the vars below (or move them to wrangler.toml [vars]).
//   5. Put the resulting *.workers.dev URL into config.js -> submitEndpoint.
// ---------------------------------------------------------------------------

const GH_OWNER = "your-github-username";   // owner of the submissions repo
const GH_REPO = "larp-submissions";        // a PRIVATE repo you created
const GH_BRANCH = "main";

// Lock this down to your Pages origin once deployed, e.g.
// "https://your-username.github.io". Use "*" only while testing.
const ALLOWED_ORIGIN = "*";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return json({ error: "Method not allowed" }, 405, cors);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    // Minimal server-side guard: consent must be present.
    if (!payload || !payload.consent || payload.consent.given !== true)
      return json({ error: "Consent is required" }, 422, cors);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `submissions/${stamp}-${rand}.json`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));

    const ghRes = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "larp-signon-worker",
        },
        body: JSON.stringify({
          message: `Sign-on: ${stamp}`,
          content,
          branch: GH_BRANCH,
        }),
      }
    );

    if (!ghRes.ok) {
      const detail = await ghRes.text();
      return json({ error: "Storage failed", detail }, 502, cors);
    }
    return json({ ok: true, path }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
