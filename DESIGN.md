# Design Document — LARP Sign-On Form

Status: living document, updated 2026-09-08: Apps Script backend migration,
split into two repos, then a shared-secret hardening pass. **See §10 for
exactly what is and isn't deployed right now** — code-complete and tested,
not yet live for a real event.
Scope: architecture, component responsibilities, and the reasoning behind
choices — the *why* behind `SPEC.md`'s *what*. Update both together when
behavior changes.

**This is one of two repos.** This one (`larpsign-frontend`) is the static
site. The submission backend lives in a separate repo,
[`larpsign-backend`](https://github.com/Gandi24/larpsign-backend), so it can
be forked/versioned independently — this document covers the whole system's
architecture (both repos), since the two are meaningless without each other,
but code changes to the backend happen over there, not here.

## 1. Architecture overview

```
larpsign-frontend (GitHub Pages, static)      larpsign-backend repo      Private GitHub repo
┌─────────────────────────────┐               ┌────────────────────┐    ┌───────────────────┐
│ index.html (shell + consent)│               │ Code.gs             │    │ submissions/*.json │
│ config.js  (public config)  │──POST text/──▶│ holds GH_TOKEN      │─PUT▶│ (audit trail via   │
│ larps.json (content/data)   │  plain (JSON  │ (Script Property)   │commit│  git history)     │
│ app.js     (all logic)      │  string body) │ always HTTP 200,    │     └───────────────────┘
│ submit-outcome.js (pure)    │               │ ok:true/false body  │
│ styles.css                  │               └─────────────────────┘
└─────────────────────────────┘
```

Three deploy targets (two repos, three destinations), two trust boundaries:
- **Frontend** (`larpsign-frontend`) is 100% static and public — no secrets,
  no server-side logic, hostable on GitHub Pages with zero build step.
- **Backend** (`larpsign-backend`'s `Code.gs`) is a single Google Apps Script
  Web App whose only job is to hold a write-scoped GitHub token server-side
  and forward validated submissions as commits. It has no database, no auth
  of its own, no admin API.
- **Storage** is a third, separate private GitHub repo each organiser creates
  for themselves — not part of either codebase, just an empty repo submissions
  get committed into.

This is a two-tier system deliberately kept as thin as possible: the "database"
*is* a private git repo, and "browsing submissions" means browsing that repo
(or `git log` / GitHub's file UI). There is currently no reviewer/admin tool
beyond that (see §7's extension point for where that will hook in).

## 2. Why a relay in between (not a direct browser→GitHub write)

A GitHub write-token embedded in client JS is readable by any visitor and
GitHub's secret-scanning auto-revokes tokens it finds published in a repo.
Apps Script is the minimal server needed to keep that token off the client
while adding as little else as possible. This is the load-bearing security
boundary of the whole system — see `README.md` "Why not commit straight from
the browser?".

Corollary: `config.js` and `larps.json` are *intentionally* public. They hold
no PII and no secrets, so they don't need the relay in front of them — only
fetched directly by the browser at load time.

**Why Apps Script instead of Cloudflare Workers** (the original choice, used
until this migration): Workers required Wrangler CLI, Node, and a Cloudflare
account — real setup friction for a non-technical organiser, and an
unfamiliar platform to sign up for and trust. Apps Script deploys entirely
through script.google.com's web UI (no terminal, ever) on a Google account
almost every organiser already has, and is free at this project's scale. The
trade-off is real, not free: Apps Script Web Apps cannot return custom HTTP
status codes (every response comes back as 200), and can't set custom CORS
response headers (forcing the `text/plain` content-type workaround in
`app.js`) — both handled explicitly in the request/response contract below,
rather than papered over.

## 3. The request/response contract (why it looks the way it does)

Two Apps Script constraints shape this contract, not preference:

- **No custom CORS headers** → the client sends `Content-Type:
  text/plain;charset=utf-8` instead of `application/json`, which avoids the
  browser's CORS preflight (`OPTIONS`) that Apps Script can't answer
  correctly. The body is still the JSON payload as a string; the server
  parses it itself.
- **No custom HTTP status codes** → every response is HTTP 200, so
  success/failure is carried in the body as `{ ok: true, path }` or
  `{ ok: false, error }`. `interpretSubmitOutcome()` (`submit-outcome.js`) is
  the client-side function that reads this field; `buildSubmissionRequest()`
  (`Code.gs`, in the `larpsign-backend` repo) is the server-side function that
  produces it. Both
  are pure — no `fetch`/DOM on the client side, no Apps Script globals on the
  server side — which is what makes them unit-testable (§7, "automated
  tests").

## 4. Why "commit JSON files to a private repo" instead of a real database

- Zero infrastructure to run or pay for beyond the relay (already free-tier
  scale for a single festival's submission volume).
- Git history *is* the audit log — every submission's exact content and time
  is preservable/diffable without extra tooling.
- Deletion for GDPR erasure is a single file delete + commit — matches the
  README's documented erasure process exactly.
- Access control piggybacks on GitHub repo permissions — no separate auth
  system to build or secure.

Trade-off accepted: no query/filter/dedup capability, no concurrent-write
safety beyond GitHub's own API semantics, and reading submissions means
opening files by hand (fine at festival scale — dozens to low hundreds of
entries — not fine at meetup-registration-app scale).

## 5. Why the matching algorithm runs client-side

`likeliness()` and `dislikesFor()` run entirely in `app.js`, recomputed on
every `change` event, *before* any submission happens. Reasons:

- Instant feedback loop: a player expects re-sorting the instant they touch a
  rating slider, no round-trip.
- Nothing about the algorithm is secret — it's a simple average-then-rescale
  over public data (`larps.json`), so there is no reason to hide it
  server-side.
- It keeps the relay dumb (§2) — the backend never needs to know about tags,
  triggers, or matching logic, only "is this a valid consented submission?"

The computed `likeliness`/`dislikes`/`triggerConflicts` *are* re-embedded into
the submission payload at submit time (`collect()`), so the organiser sees a
frozen snapshot of what the player saw, not just raw preference numbers they'd
have to recompute themselves.

## 6. State management in `app.js`

- `data` — the fetched `larps.json`, loaded once at `init()`, treated as
  read-only for the session.
- `selections` — `{ slotId: [larpName, ...] }`, the only mutable app state,
  holding picks in priority order (array position = priority). This is the
  single source of truth for the "Twoje wybory" tray.
- Ratings and triggers are **not** mirrored into JS state — they're read
  live from the DOM (`getRatings()`, `getTriggers()`) whenever needed. This
  means the DOM *is* the source of truth for those two, and `selections` is
  the only thing kept outside it.
- Render pattern: any state change calls the relevant `render*()` function,
  which does a full `innerHTML` replace of its container (no diffing, no
  virtual DOM, no component framework). At this data volume (4 slots, ~30
  larps, 16 tags, 16 triggers) full re-render is cheap enough that this is a
  reasonable, low-complexity choice rather than a limitation to fix.
- `larpByName(slot, name)` — larps are looked up **by name string**, not id.
  This is a latent footgun: two larps with the same name in the same slot
  would collide in `selections`. Fine today (all names are unique per slot in
  `larps.json`), but if that invariant is ever violated, picks/removal would
  silently misbehave. Worth an `id` field if the content set grows or is
  edited by non-engineers.
- `submit-outcome.js` deliberately sits *outside* this state entirely — it's
  a pure function of a parsed response body, loaded as its own `<script>` tag
  before `app.js` so it can be `require()`d directly by Node tests without
  pulling in `window`/`document` (see §7).

## 7. Known gaps / deliberately deferred

These are absent by omission, not oversight — flagging them so a future
session doesn't have to rediscover them by reading code:

- **No capacity enforcement.** `larps.json → larps[].players` (headcount) is
  parsed but never used. Nothing stops more players from prioritizing a larp
  than it has seats; that reconciliation is implicitly left to the organiser
  doing manual casting from the submitted priority lists.
- **No cross-slot conflict detection.** Nothing ties timeslots to real wall-clock
  overlap or warns about anything beyond the 4-slot structure already defined.
- **No dedup / resubmission handling.** The backend writes a new timestamped
  file per POST; a player submitting twice (e.g. after a network error retry)
  produces two files. No "upsert by identity" concept exists.
- **No rate limiting.** A correctly-secreted request (see below) still isn't
  rate-limited — repeated valid-looking POSTs all succeed. Acceptable for a
  low-traffic festival form; would need real hardening (e.g. Turnstile) for a
  more exposed deployment.
- **No origin restriction is possible, and it wouldn't have meant what it
  looked like anyway.** The old Worker's `ALLOWED_ORIGIN` lockdown has no
  Apps Script equivalent — a Web App deployed with "Access: Everyone" accepts
  requests from any origin, and Apps Script doesn't offer a way to restrict
  that. Worth being precise about what this actually cost: CORS is a
  browser-enforced rule about which page's JS may *read a response*, never a
  server-side access control — `ALLOWED_ORIGIN` never stopped a direct `curl`
  either. It's a real regression in one specific way, though: because the
  frontend sends `text/plain` to dodge Apps Script's CORS limitation (§3),
  the browser treats it as a "simple request" and skips the preflight
  entirely — meaning *any* third-party website could embed hidden JS that
  silently POSTs to this endpoint from an unsuspecting visitor's browser, no
  read of the frontend's source required. The shared secret below exists
  specifically to close that gap (a blind cross-site POST won't know the
  secret), on top of the unlisted-URL mitigation both backends always relied
  on.
- **Shared secret (`SUBMIT_SECRET` / `config.js`'s `submitSecret`) — a
  deterrent, not real security, and documented as such.** Every request body
  is now an envelope `{ secret, submission }`; the backend rejects anything
  whose `secret` doesn't match before looking at `submission` at all (fails
  *closed* if `SUBMIT_SECRET` isn't configured, not open). Because
  `config.js` is a public file served as-is by GitHub Pages, this secret is
  trivially readable by anyone who opens it — it does **not** stop a
  determined actor who reads the frontend's source, only the CSRF-style blind
  POST above and casual/automated scanning. This trade-off was a deliberate,
  informed choice for this project's actual shape: a short-lived,
  per-festival deployment where "stops opportunistic abuse without adding a
  captcha/verification service" was judged worth it over real bot protection
  (e.g. reCAPTCHA/Turnstile, verified server-side) — which remains the
  documented next step (see the rate-limiting bullet above) if a deployment
  ever needs more than this.
- **Automated tests exist, narrowly.** `npm test` in each repo covers one pure
  function each (`interpretSubmitOutcome` here, `buildSubmissionRequest` in
  `larpsign-backend`'s `Code.gs`) — extracted specifically because the Apps
  Script migration added real branching logic (consent/JSON validation,
  error-code mapping), matching this doc's own earlier-stated trigger for
  adding tests. Everything else (rendering, matching, slot selection, the
  actual live deploy) remains manually verified. Both repos run `npm test` on
  every push/PR via `.github/workflows/test.yml` — see the note below on why
  CI stops there.
- **GitHub Actions deliberately doesn't automate the Apps Script deploy
  itself.** Investigated and rejected: Google's `clasp` CLI can push code to
  an *existing* Apps Script deployment non-interactively once credentials
  exist, but obtaining those credentials requires an interactive browser
  login — and Google has actively disabled the headless variant of that flow
  that used to work. Service-account auth (which can run headlessly) only
  works for Google Workspace accounts with an admin, not the personal Gmail
  accounts individual organisers actually have. A Web App's "Execute as" /
  "Who has access" settings also can only be set for the first time through
  script.google.com's own UI. Net result: there is no way to provision a
  stranger's brand-new Apps Script Web App without *someone* touching either
  a terminal or script.google.com's UI at least once — automating it would
  either not work reliably or would reintroduce the terminal requirement this
  migration specifically eliminated. CI's job is limited to keeping the pure
  functions correct; deploy stays the manual walkthrough in each repo's
  README.
- **No admin/reviewing UI.** Organisers read submissions as raw JSON files in
  the private repo. Because that repo is already private and admin-only,
  `git clone` access to it already *is* the authorization check — the
  intended next tool is a script living in that same private repo, run
  locally against the cloned `submissions/` files, not a hosted viewer. No
  new hosting or auth system is needed for a first version of this.
- **Shared multi-tenant backend — considered, not built.** If per-organiser
  self-hosting (the model this document describes) turns out to be too much
  setup friction in practice, the considered fallback is a single backend the
  original maintainer personally operates, with other organisers onboarding
  via a single-use, cryptographically random (UUIDv4) invite code — redeemed
  atomically, sent as a POST body field (never a URL), over HTTPS, optionally
  time-boxed. This was deliberately not pursued now: it trades away
  per-organiser data ownership questions (does each organiser's data still
  land in their own repo, or centralize under repos the maintainer controls?)
  and meaningfully increases the maintainer's GDPR processor/controller
  responsibility across every event using it. Recorded here so a future
  session doesn't have to rediscover this reasoning from scratch.
- **Content accuracy.** `larps.json._note` flags that per-larp `tags`/
  `triggers` are an early, partly-inferred draft (from titles/authors/format),
  not GM-confirmed. Matching quality is only as good as this data — treat low
  match-confidence content as a data-entry task, not a code task.

## 8. Extension points (where to make common changes)

| Change | Where |
|---|---|
| Add/edit larps, timeslots, tags, triggers | `larps.json` only |
| Event name, retention text, controller contact, endpoint URL | `config.js` only |
| Change match % formula or scale bands | `likeliness()` / `likeLabel()` in `app.js` |
| Change max picks per slot | `MAX_PICKS` in `app.js` |
| Change submission schema | `collect()` in `app.js` **and** update `SPEC.md` §6 + bump `schemaVersion` |
| Change storage backend or add validation | `Code.gs` in the `larpsign-backend` repo |
| Change the submit request/response contract | keep `submit-outcome.js` here and `buildSubmissionRequest()` in `larpsign-backend`'s `Code.gs` in sync — see §3, and update both repos |
| Add a results-review/casting tool | a script reading the cloned private submissions repo locally — see §7 |
| Visual restyle | `styles.css` (CSS custom properties in `:root` drive the palette) |

## 9. Relationship to `SPEC.md`

`SPEC.md` is the contract (data shapes, algorithm, validation rules, GDPR
requirements) — treat it as the reference when unsure what the *correct*
behavior is. This file is the reasoning behind that contract and the map of
what's deliberately not built yet. When you change behavior, update `SPEC.md`;
when you change *why* something is structured a certain way, update this file.

## 10. Current deployment status (read this first when resuming)

**Code is complete and tested. Nothing is actually deployed for a real event
yet.** Concretely, as of the last session:

- Both repos exist, are public, and are pushed to `main`:
  [`larpsign-frontend`](https://github.com/Gandi24/larpsign-frontend) (this
  repo — renamed in place from the original `signon`, git history intact) and
  [`larpsign-backend`](https://github.com/Gandi24/larpsign-backend) (new).
- CI is green on both (`.github/workflows/test.yml`, `npm test` — 5 tests
  here, 8 in `larpsign-backend`).
- GitHub Pages is live and serving this repo's `main`/root at
  `https://gandi24.github.io/larpsign-frontend/`.
- **But**: `config.js`'s `submitEndpoint` and `submitSecret` are both still
  `""` — nobody has created a real Apps Script Web App yet. The live site
  today only exercises the local-download fallback path (§6, "Empty
  (local/dev)"), not real submission. `larpsign-backend`'s `Code.gs` still has
  its placeholder `GH_OWNER = "your-github-username"` / `GH_REPO =
  "larp-submissions"` — nobody has created a real private submissions repo,
  minted a PAT, or run through `larpsign-backend`'s deploy walkthrough
  against a live Google account either.
- To make it real for an actual event: follow `larpsign-backend`'s README
  top to bottom (private submissions repo → fine-grained PAT → paste `Code.gs`
  into script.google.com → `GH_TOKEN` + `SUBMIT_SECRET` Script Properties →
  deploy → authorize), then paste the resulting URL and secret into this
  repo's `config.js`, commit, push.
- `larps.json`'s per-larp `tags`/`triggers` are still the early, partly-
  inferred draft flagged in its own `_note` (§7) — not yet confirmed by any
  GM, because there's no real event's programme loaded in yet either.
- Still purely documented, not built (§7): the results-review/casting tool,
  and the shared multi-tenant backend with UUID invite codes (the considered
  fallback if per-organiser self-hosting proves too much friction).
