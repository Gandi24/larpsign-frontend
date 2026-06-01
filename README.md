# Zapisy na larpy (LARP sign-on)

A static, **Polish-language** sign-up form that guides players to the larps they'll
enjoy — even if they never read the programme. The flow is three steps:

1. **Preferencje** — rate ~16 theme tags on a −2…+2 scale (Nie znoszę → Uwielbiam).
2. **Triggery** — tick the ones that affect you (yes/no).
3. **Sloty** — in each of the 4 timeslots, the larps are auto-ranked by a computed
   **dopasowanie %** (from your ratings) and show a **bold trigger list** (yours
   flagged in red). Click up to 4 per slot, in priority order.

The frontend is hosted on **GitHub Pages**; submissions are stored in a **private
GitHub repo** via a small **Cloudflare Worker**. It is **GDPR-aware**: explicit
opt-in consent, a privacy notice (controller, purpose, retention, storage), and an
erasure contact.

```
Browser (GitHub Pages)  ──POST──▶  Cloudflare Worker  ──commit──▶  private repo
   config.js / app.js               worker.js (holds token)         submissions/*.json
```

## Why not commit straight from the browser?

A GitHub write-token in client-side JS is readable by anyone who visits the page,
and GitHub auto-revokes tokens it finds in repos. The Worker keeps the token
server-side as an encrypted secret. The browser only ever talks to the Worker.

## Files

| File            | What it is                                              |
|-----------------|--------------------------------------------------------|
| `index.html`    | Page shell (Polish) + consent gate                     |
| `styles.css`    | Styling                                                |
| `larps.json`    | **Edit this** — preference tags, triggers, and the 4 timeslots with their larps |
| `config.js`     | **Edit this** — event name, organiser, retention, endpoint URL |
| `app.js`        | Form engine (ratings, triggers, slot matching, submit/download) |
| `worker.js`     | Cloudflare Worker submission backend                   |
| `wrangler.toml` | Worker deploy config                                   |

## 1. Try it locally (no backend)

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

With `submitEndpoint` empty in `config.js`, **Wyślij zgłoszenie** downloads the
answers as a `.json` file instead of sending them — handy for testing.

## 2. Deploy the frontend to GitHub Pages

1. Push this folder to a **public** repo (e.g. `larp-signon`).
2. Repo → **Settings → Pages** → Source: `main` / root → Save.
3. Your form is at `https://<you>.github.io/larp-signon/`.

> Note: `config.js` and `larps.json` are public. That's fine — they contain no
> secrets and no participant data.

## 3. Deploy the submission backend

1. Create a **private** repo for the data, e.g. `larp-submissions`.
2. Create a **fine-grained personal access token**
   (GitHub → Settings → Developer settings → Fine-grained tokens):
   - **Repository access:** only `larp-submissions`
   - **Permissions:** Contents → **Read and write** (nothing else)
   - Short expiry is fine; rotate after the event.
3. Edit `worker.js`: set `GH_OWNER`, `GH_REPO`, and (after step 5) `ALLOWED_ORIGIN`.
4. Deploy:
   ```bash
   npm i -g wrangler
   wrangler login
   wrangler deploy
   wrangler secret put GH_TOKEN     # paste the token from step 2
   ```
5. Copy the printed `https://larp-signon.<you>.workers.dev` URL into
   `config.js` → `submitEndpoint`, then redeploy Pages (commit + push).
6. Lock it down: set `ALLOWED_ORIGIN` in `worker.js` to your Pages URL and
   `wrangler deploy` again.

Submissions land as files under `submissions/` in your private repo.

## Editing the data — `larps.json`

Everything content-related lives here; no code changes needed.

- `preferenceTags` — `[{ id, label }]`. Each becomes one −2…+2 rating row. The `id`
  is what larps reference in their `tags`.
- `triggers` — `[string]`. Each becomes one yes/no checkbox.
- `timeslots` — `[{ id, name, time, larps: [...] }]`. Each larp has
  `name`, `players`, `tags` (ids from `preferenceTags`), and `triggers` (strings
  from `triggers`).

**How dopasowanie % is computed:** the average of the player's ratings for that
larp's `tags`, rescaled from [−2, +2] to [0, 100]. No ratings yet → 50% (neutral).
Larps in a slot are sorted by this, so the best matches float to the top.

> The tags/triggers per larp are an **early, partly inventive draft** inferred from
> titles/authors/format. Have each GM confirm their own larp's `tags` and `triggers`.

## What a submission contains

```jsonc
{
  "meta": { "event", "submittedAt", "schemaVersion": 2 },
  "identity": { "name", "email" },
  "consent": { "given": true, "timestamp" },
  "preferences": { "scifi": 2, "romans": -2, ... },   // tag id -> rating
  "triggers": ["Izolacja i osamotnienie", ...],        // the player's triggers
  "choices": {                                          // per timeslot, ordered
    "nd_rano": [
      { "priority": 1, "name", "likeliness": 83, "triggerConflicts": [...] }
    ]
  }
}
```

`triggerConflicts` lists the player's triggers that the chosen larp contains — a
flag for the casting crew.

## GDPR notes for the organiser

- **Consent** is recorded with each submission (`consent.given` + timestamp).
- **Retention:** delete the files when you said you would (`config.js → retention`).
  Deleting the file from the private repo removes the data.
- **Erasure requests** come to `controller.email`; find the person's file and
  delete it (and any local copies/exports).
- **Minimise:** the form already asks only nick + optional e-mail plus preferences.
- Keep the submissions repo **private** and limit who has access.
