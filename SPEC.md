# Functional Specification — LARP Sign-On Form

Status: living document, updated 2026-09-08 for the Apps Script backend
migration and a shared-secret hardening pass. This describes what the code
*does* — for what's actually deployed right now vs. just built and tested,
see `DESIGN.md` §10.
Scope: what the system does and the rules it follows. For *how it's built and why*, see `DESIGN.md`.

## 1. Purpose

A Polish-language sign-up form for a LARP (live-action role-play) festival. A player
who has never read the programme rates what themes they enjoy, flags their personal
triggers, and the form ranks every larp in every timeslot by computed fit — so they
can pick their top choices per slot without prior knowledge of the games.

## 2. User flow

1. **Kto się zapisuje** — nickname (required) + optional email.
2. **Preferencje** — rate every `preferenceTags` entry on a 5-point scale, −2..+2:
   `Nie znoszę / Raczej nie / Obojętne / Lubię / Uwielbiam`. Defaults to 0 (neutral).
3. **Triggery** — tick any number of triggers from `larps.json → triggers` that
   affect the player (yes/no, no severity).
4. **Sloty** — for each of the 4 timeslots (fixed in `larps.json`), larps are listed
   under "Pozostałe" sorted by descending match %. The player adds up to **4 per
   slot** into a "Twoje wybory" tray, where order is priority (drag via ▲/▼,
   remove via ✕). Adding/removing re-sorts the remaining list live.
5. **Prywatność i zgoda** — GDPR notice (controller, purpose, retention, storage
   location) rendered from `config.js`, plus a required consent checkbox.
6. Submit — see §6.

Changing any preference rating or trigger checkbox live-recomputes match % and
re-sorts every slot (`change` listener on the form, §5).

## 3. Data model (`larps.json`)

```jsonc
{
  "preferenceTags": [{ "id": "scifi", "label": "Science fiction" }, ...],
  "triggers": ["Przemoc i brutalność", ...],
  "timeslots": [
    {
      "id": "pt_wieczor", "name": "Piątek wieczór", "time": "18:00–22:00 (4h)",
      "larps": [
        { "name": "La Candela", "players": 20,
          "tags": ["rytual", "emocje", "cialo"],
          "triggers": ["Bliski kontakt fizyczny"] }
      ]
    }
  ]
}
```

- `preferenceTags[].id` is the join key used by `larps[].tags`.
- `triggers` is a flat string catalogue; `larps[].triggers` values must match a
  string in it verbatim (no id indirection).
- `larps[].players` (headcount / capacity) is captured but **not currently used**
  by any matching, sorting, or limit logic — see `DESIGN.md` §6 (Known gaps).
- Currently 4 timeslots, each with a fixed hand-authored larp list. The file's
  `_note` field flags that tags/triggers are an early, partly-inferred draft
  pending GM confirmation — treat content (not schema) as provisional.

## 4. Matching algorithm

**Match % (`likeliness`)**: for a larp with tag set `T`, average the player's
ratings for `T` (0 if unrated tag, though the UI defaults every rating to 0
anyway), then rescale that average from `[-2, +2]` to `[0, 100]`:

```
pct = round( ((avg_rating + 2) / 4) * 100 )
```

A larp with no tags scores a flat 50 (neutral). Label bands:
`≥80 Świetnie pasuje · ≥60 Pasuje · ≥40 Może być · <40 Raczej nie dla Ciebie`.

**Dislike warning**: any tag on the larp that the player rated **exactly −2**
("Nie znoszę") is surfaced as a "👎 Możesz nie polubić: …" note, separate from
match %. Deliberately narrowed to −2 only (not −1) per commit `8c06ee6` — a
mild dislike (−1) already drags the average down and isn't worth a standalone
warning.

**Trigger conflicts**: any trigger on the larp that the player has ticked is
shown inline on every card, bolded, red, prefixed `⚠`, both in "Twoje wybory"
and "Pozostałe". This is a safety flag, computed independently of match %.

**Sort order**: within a slot, un-picked larps ("Pozostałe") are sorted purely
by descending match %. Picked larps ("Twoje wybory") keep the player's manual
priority order, not match %.

## 5. Selection rules

- Max **4 picks per slot** (`MAX_PICKS`), independent per slot.
- A larp already picked in a slot cannot be re-added; disabled `+ Dodaj` once
  the slot tray hits 4.
- Reordering is via ▲/▼ (swap with neighbor); ✕ removes and reflows.
- No cross-slot exclusivity — a player may pick larps that would clock-conflict
  outside this tool; the sign-on has no concept of "you can only attend one
  slot's worth of larps across the whole festival" beyond the per-slot cap.

## 6. Validation & submission

**Client-side validation** (`validate()`, blocks submit until satisfied):
- Nickname non-empty.
- Consent checkbox checked.
No validation requires *any* slot picks, ratings, or triggers — an all-neutral,
all-empty submission is technically valid as long as name + consent are present.

**Submission payload** (`schemaVersion: 2`):

```jsonc
{
  "meta": { "event", "submittedAt" /* ISO */, "schemaVersion": 2 },
  "identity": { "name", "email" },
  "consent": { "given": true, "timestamp" /* ISO */ },
  "preferences": { "<tagId>": -2..2, ... },       // every tag, defaults included
  "triggers": ["<trigger string>", ...],           // only the ticked ones
  "choices": {
    "<slotId>": [
      {
        "priority": 1,                             // 1-based, matches tray order
        "name": "<larp name>",
        "likeliness": 83,                           // match % at submit time
        "triggerConflicts": ["<trigger string>", ...],
        "dislikes": ["<tag label>", ...]             // -2-rated tags on this larp
      }
    ]
  }
}
```

**Two delivery paths**, chosen by whether `config.js → submitEndpoint` is set:
- **Set**: `POST` an **envelope** — `{ secret, submission }`, where
  `submission` is the payload above and `secret` is `config.js`'s
  `submitSecret` — as the JSON-stringified body, with
  `Content-Type: text/plain;charset=utf-8` (not `application/json` — see §7
  for why), to the endpoint (the Apps Script Web App). The response is always
  HTTP 200; success/failure comes from the parsed body's `ok` field
  (`interpretSubmitOutcome()` in `submit-outcome.js`). On `ok: false`, an
  unparseable response, or a network failure, the submit button is
  re-enabled and an error is shown with a suggestion to use "Pobierz moje
  odpowiedzi" instead. On `ok: true`, the form is replaced with a thank-you
  message.
- **Empty** (local/dev): "Wyślij zgłoszenie" immediately downloads the payload
  as a `.json` file instead of posting anywhere — the documented no-backend
  testing mode (`README.md` §1).

"Pobierz moje odpowiedzi" (download) is always available regardless of
`submitEndpoint`, independent of submit — lets a player keep/backup their
answers or hand-deliver the file if the network path fails.

## 7. Backend contract (Google Apps Script Web App, `Code.gs` in the
   [`larpsign-backend`](https://github.com/Gandi24/larpsign-backend) repo)

- `POST` only, handled by `doPost(e)`. Apps Script Web Apps cannot return
  custom HTTP status codes — **every response is HTTP 200**, regardless of
  outcome; the body's `ok` field carries success/failure instead
  (`{ ok: true, path }` or `{ ok: false, error }`).
- Body must parse as JSON → else `{ ok: false, error: "invalid_json" }`.
- Body must be the envelope `{ secret, submission }` with `secret` matching
  the `SUBMIT_SECRET` Script Property exactly → else
  `{ ok: false, error: "unauthorized" }`. Fails **closed**: an unconfigured
  `SUBMIT_SECRET` rejects every request, it does not admit them. This check
  runs before `submission` is inspected at all, and `secret` is discarded
  afterward — it never appears in what gets committed to GitHub. See
  `larpsign-backend`'s README ("Shared secret") for what this protects
  against and what it deliberately doesn't.
- `submission.consent.given === true` → else
  `{ ok: false, error: "consent_required" }`. This is the **only**
  server-side content validation of `submission`; name/preferences/choices
  are not re-checked.
- Request validation and payload-shaping is the pure function
  `buildSubmissionRequest(rawBody, deps)` — given the raw body plus injected
  time/randomness/base64-encoding/expected-secret, it returns either a
  rejection or the exact GitHub Contents API request to send (built from
  `submission` only). It has no Apps Script globals in it, so it's covered by
  `larpsign-backend`'s own `tests/build-submission-request.test.js` without a
  live deployment.
- On success: commits the payload as
  `submissions/<ISO-timestamp-with-dashes>-<6-char-random>.json` to a
  configured **private** GitHub repo via the Contents API, using a
  server-held fine-grained PAT (`GH_TOKEN`, an Apps Script Script Property —
  never in code). Content is base64-encoded with an explicit UTF-8 charset
  (`Utilities.base64Encode(str, Utilities.Charset.UTF_8)`), since submissions
  routinely contain Polish diacritics. Returns `{ ok: true, path }`.
- On GitHub API failure: `{ ok: false, error: "github_write_failed", detail }`
  (detail is GitHub's raw response body — not sanitized before returning to
  the client), still as HTTP 200.
- CORS: Apps Script Web Apps don't support custom CORS response headers at
  all, which is *why* the client sends `text/plain` instead of
  `application/json` (§6) — there is no `ALLOWED_ORIGIN`-style origin lockdown
  available on this backend. The shared-secret check above is what stands in
  for it (see `DESIGN.md` §7, "no origin restriction is possible" and
  "shared secret").
- No rate limiting, no dedup, no idempotency key — a correctly-secreted
  resubmission still creates a new
  file every time (see `DESIGN.md` §7).

## 8. GDPR / privacy requirements

- **Lawful basis**: explicit opt-in consent, checkbox required, timestamped
  and stored with every submission.
- **Transparency**: privacy notice rendered from `config.js.controller` /
  `retention` / `processorNote` before consent; a `<details>` block explains
  data-subject rights (access, rectification, erasure) in Polish.
- **Data minimization**: only nickname is mandatory; email optional; no other
  PII collected.
- **Storage location disclosure**: `processorNote` names Google LLC (USA, the
  Apps Script relay — data transits but is not persisted there) and GitHub
  Inc. (USA, the actual storage) as processors — must stay accurate if either
  backend changes.
- **Retention**: organiser-defined free text (`config.js.retention`); *enforced
  manually* — deleting the JSON file in the private repo is the deletion
  mechanism, there is no automated expiry job.
- **Erasure**: routed to `controller.email`, shown in the footer; manual
  process (organiser finds and deletes the file(s) for that person).
- **Public files contain no secrets**: `config.js` and `larps.json` are served
  publicly via GitHub Pages and must never carry tokens or participant data —
  only `larpsign-backend`'s `Code.gs`'s `GH_TOKEN` (an Apps Script Script
  Property) touches write credentials.

## 9. Non-functional requirements

- **No build step**: plain HTML/CSS/JS, static-hostable as-is (GitHub Pages).
  `npm test` (§ below) runs only during development and ships nothing to the
  site — `package.json` carries no dependencies.
- **No backend required to test**: empty `submitEndpoint` degrades gracefully
  to file download (§6).
- **No terminal required to deploy**: both the frontend (fork + GitHub Pages
  settings, this repo) and the backend (`larpsign-backend`'s `Code.gs` pasted
  into script.google.com) are set up entirely through web UIs — see
  `README.md` §3 here and `larpsign-backend`'s own README.
- **Automated tests, narrowly scoped**: `npm test` in each repo (Node's
  built-in test runner, no dependencies) covers `interpretSubmitOutcome()`
  (`submit-outcome.js`, here) and `buildSubmissionRequest()` (`Code.gs`, in
  `larpsign-backend`) — the two pure functions on either side of the submit
  contract (§7). Both repos run this via `.github/workflows/test.yml` on
  every push/PR. Nothing else in the project has automated coverage; see
  `DESIGN.md` §7 (including why deploy itself is deliberately not automated).
- **Responsive**: single-column layout collapses preference rows to stacked
  on ≤560px.
- **Status messaging**: `#status` is `aria-live="polite"` region for
  submit/error feedback.
- **XSS safety**: all dynamic content interpolated into `innerHTML` is passed
  through `esc()` (HTML-entity escaping) — applies to larp names, tag labels,
  trigger strings, and config strings sourced from JSON/config files.
