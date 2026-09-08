# Zapisy na larpy (LARP sign-on)

A static, **Polish-language** sign-up form that guides players to the larps they'll
enjoy — even if they never read the programme. The flow is three steps:

1. **Preferencje** — rate ~16 theme tags on a −2…+2 scale (Nie znoszę → Uwielbiam).
2. **Triggery** — tick the ones that affect you (yes/no).
3. **Sloty** — in each of the 4 timeslots, the larps are auto-ranked by a computed
   **dopasowanie %** (from your ratings) and show a **bold trigger list** (yours
   flagged in red). Click up to 4 per slot, in priority order.

This repo is the **frontend only** — 100% static, hosted on **GitHub Pages**.
Submissions are stored in a **private GitHub repo** via a small **Google Apps
Script Web App**, which lives in a separate repo:
[**larpsign-backend**](https://github.com/Gandi24/larpsign-backend). Setting
the whole thing up — both repos — takes **no terminal, no CLI, and no new
unfamiliar platform**: everything is clicking through GitHub's and Google's
own web UIs, and both are free at festival scale. It is **GDPR-aware**:
explicit opt-in consent, a privacy notice (controller, purpose, retention,
storage), and an erasure contact.

```
larpsign-frontend (this repo, GitHub Pages)   larpsign-backend repo          Private GitHub repo
┌─────────────────────────────┐               ┌────────────────────┐        ┌───────────────────┐
│ index.html (shell + consent)│               │ Code.gs             │        │ submissions/*.json │
│ config.js  (public config)  │──POST text/──▶│ (deployed as an     │──PUT──▶│ (audit trail via   │
│ larps.json (content/data)   │  plain (JSON  │  Apps Script Web    │ commit │  git history)      │
│ app.js / submit-outcome.js  │  string body) │  App; holds token)  │        └───────────────────┘
│ styles.css                  │               └─────────────────────┘
└─────────────────────────────┘
```

## Why not commit straight from the browser?

A GitHub write-token in client-side JS is readable by anyone who visits the page,
and GitHub auto-revokes tokens it finds in repos. Apps Script keeps the token
server-side, in a Script Property, never in code. The browser only ever talks to
the Apps Script Web App — see
[larpsign-backend](https://github.com/Gandi24/larpsign-backend) for that side.

## Files

| File                        | What it is                                              |
|-----------------------------|--------------------------------------------------------|
| `index.html`                | Page shell (Polish) + consent gate                     |
| `styles.css`                | Styling                                                |
| `larps.json`                | **Edit this** — preference tags, triggers, and the 4 timeslots with their larps |
| `config.js`                 | **Edit this** — event name, organiser, retention, endpoint URL, shared secret |
| `app.js`                    | Form engine (ratings, triggers, slot matching, submit/download) |
| `submit-outcome.js`         | Pure "what does this response mean to the player" logic, shared with `tests/` |
| `tests/`                    | Node tests for `submit-outcome.js` (`npm test`) — nothing else in this repo is tested |

The Apps Script backend (`Code.gs`) and its own tests live in the separate
[larpsign-backend](https://github.com/Gandi24/larpsign-backend) repo, not here.

## 1. Try it locally (no backend)

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

With `submitEndpoint` empty in `config.js`, **Wyślij zgłoszenie** downloads the
answers as a `.json` file instead of sending them — handy for testing.

## 2. Deploy the frontend to GitHub Pages

1. Fork this repo (or use it as a template) — e.g. into `<you>/larpsign-frontend`.
2. Repo → **Settings → Pages** → Source: `main` / root → Save.
3. Your form is at `https://<you>.github.io/larpsign-frontend/`.

> Note: `config.js` and `larps.json` are public — that's fine for the event
> data and settings, but see the caveat on `submitSecret` in step 3: it's a
> *deterrent*, not a real secret, precisely because this file is public.

## 3. Deploy the submission backend

The backend is a separate repo, deployed separately:
[**larpsign-backend**](https://github.com/Gandi24/larpsign-backend). Fork it
and follow its README — no terminal needed there either, same "click through
web UIs" story, about five minutes. It ends with a Web App URL and a shared
secret you made up.

Once you have both, paste them into **this** repo's `config.js` →
`submitEndpoint` and `submitSecret` (must match `larpsign-backend`'s
`SUBMIT_SECRET` exactly), then commit + push so Pages redeploys. Submissions
will then land as files under `submissions/` in the private repo you set up
while following larpsign-backend's instructions.

`submitSecret` is **not real security** — `config.js` is a public file, so
anyone can read it. It only deters casual/automated abuse of the endpoint;
see larpsign-backend's README ("Shared secret") for exactly what it does and
doesn't protect against, and why that's still worth doing for a short-lived
festival form.

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

## Running the tests

Node's built-in test runner, no dependencies to install:

```bash
npm test
```

This covers `interpretSubmitOutcome()` in `submit-outcome.js` — the client
side of the submit contract. The server side (`buildSubmissionRequest()`) has
its own tests in the [larpsign-backend](https://github.com/Gandi24/larpsign-backend)
repo. Everything else in this project is still verified manually (open it in
a browser), matching how the rest of the codebase works. CI
(`.github/workflows/test.yml`) runs `npm test` on every push and PR.
