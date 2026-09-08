# Spec — Zero-terminal, free submission backend for LARP sign-on

Status: ready for agent
Source: synthesized from a `/grill-me` design-interview session (2026-09-08)

## Problem Statement

`signon` is a Polish-language LARP sign-on form: a static frontend on GitHub
Pages, backed by a Cloudflare Worker that commits submissions as JSON files
into a private GitHub repo. This was an initial spike, and the person who
built it wants other LARP organisers to be able to fork it and run their own
copy of the same form for their own event.

Today that's not realistic for a non-technical organiser. Standing up the
backend means installing Node, installing and logging into the Wrangler CLI,
running several CLI commands (`wrangler deploy`, `wrangler secret put`),
copying a printed URL back into a config file, and redeploying — six-odd
manual steps, all assuming comfort with a terminal, plus trusting/signing up
for a cloud platform (Cloudflare) most organisers have never used. There is
also no way for the organiser who *does* deploy it to review what's been
submitted beyond opening raw JSON files one at a time in a private repo.

## Solution

Replace the Cloudflare Worker with a **Google Apps Script Web App** as the
submission relay. It's deployable end-to-end through web-UI clicks only
(script.google.com + GitHub's own web UI, no terminal, no CLI), runs on a
Google account almost every organiser already has (so it isn't "yet another
platform" to evaluate and trust), and is free at LARP-festival submission
volume with no billing account required.

The parts of the current design that already work stay exactly as they are:
GitHub Pages hosting, the private-GitHub-repo-as-datastore model (git history
as the audit trail, deleting a file as the GDPR erasure mechanism), the
client-side matching algorithm, and the consent-gated submission flow. Only
the relay component — the thing that holds a write credential and forwards a
validated submission — changes, and it changes implementation, not contract
intent.

Documentation is rewritten as a numbered, plain-language walkthrough that
assumes no prior familiarity with Apps Script, GitHub tokens, or private
repos, and explicitly calls out the one unavoidable rough edge: Google's
"unverified app" authorization warning during first deploy, which is
expected and harmless here but reads as alarming if you don't know that going
in.

Two things raised during the design session are deliberately **not** part of
this spec: a results-review/admin UI, and a shared multi-tenant backend with
invite-code registration (proposed as a fallback if per-organiser self-hosting
turns out to be too much friction in practice). Both are recorded under Out
of Scope / Further Notes so they aren't lost, but neither is built here.

## User Stories

1. As an event organiser forking this repo, I want to set up the submission
   backend without installing or running anything on a command line, so that
   I'm not blocked by unfamiliar developer tooling.
2. As an event organiser, I want the backend to run on a platform I likely
   already have an account with, so that I don't have to evaluate and trust a
   brand-new cloud vendor just to receive form submissions.
3. As an event organiser, I want the whole setup to be free at my event's
   actual scale (dozens to low hundreds of submissions), so that I don't need
   to provide billing information or worry about surprise costs.
4. As an event organiser, I want my participants' submitted data to keep
   landing in a private GitHub repo I own and control, so that I retain the
   existing GDPR properties: git history as audit trail, deleting a file as
   erasure.
5. As an event organiser, I want a clear, numbered, plain-language setup
   guide that doesn't assume prior familiarity with Apps Script, GitHub
   tokens, or private repos, so that I can complete setup unaided.
6. As an event organiser, I want to be warned in advance about Google's
   "unverified app" authorization prompt during setup, so that I don't
   abandon setup thinking something is broken or unsafe.
7. As a LARP participant, I want to submit my sign-on answers without needing
   a Google or GitHub account myself, so that submitting stays exactly as
   frictionless as it is today.
8. As a LARP participant, I want my submission to be accepted with the same
   validation and the same payload shape as today, so that switching the
   backend doesn't change my experience of using the form.
9. As an event organiser, I want the backend to reject any submission that
   doesn't carry explicit consent, exactly as today, so that the GDPR lawful
   basis keeps being enforced server-side, not just in the browser.
10. As an event organiser (the repo owner/admin), I want to remain the only
    party who can access collected results, so that participant data is never
    exposed publicly.
11. As an event organiser, I want the GDPR privacy notice to name every party
    that processes participant data — including Google, now that submissions
    transit through Apps Script — so that the disclosure stays accurate.
12. As an event organiser, I want to keep testing the form locally with no
    backend configured, exactly as today (an empty `submitEndpoint` triggers
    a JSON download instead of a network call), so that I can preview/develop
    without deploying anything.
13. As a future maintainer, I want the Apps Script backend's request-building
    logic separated from its network I/O, so the core logic (consent check,
    payload shaping, target filename construction) is testable without a live
    deployment or live GitHub API calls.
14. As a future maintainer, I want `app.js`'s response-handling logic
    separated from the actual `fetch()` call, so the success/error branching
    is testable without a live backend.
15. As an event organiser, I want a documented, considered fallback plan (a
    single backend I personally operate, other organisers onboarding via
    single-use invite codes) available in case self-hosting proves too much
    friction in practice, so there's a real next step instead of starting
    from scratch if that happens.
16. As an event organiser, I want the future results-review/casting-support
    tooling to have an obvious, low-effort home — scripts run locally against
    a clone of the already-private submissions repo — so that phase-2 work
    isn't blocked on building admin hosting or authentication first.
17. As an event organiser editing the Apps Script backend later, I want the
    documentation to call out that a code change requires creating a new
    deployment version to take effect, so an edit that "doesn't seem to work"
    isn't mistaken for a bug.
18. As an event organiser, I want the README's deploy instructions to state
    exactly which repo settings/menu/button to use at each step (not just
    "deploy it"), so a non-technical reader can follow it without guessing.

## Implementation Decisions

- **Backend replacement**: `worker.js` and `wrangler.toml` are removed and
  replaced by a Google Apps Script project implementing the same intent as
  today's Worker contract (validate consent, commit the submission as a
  timestamped JSON file to the configured private repo via GitHub's Contents
  API, using a fine-grained PAT).
- **Auth/secret storage**: the GitHub PAT is stored in the Apps Script
  project's Script Properties (set via the Apps Script web UI, not committed
  to code), read via the properties service at request time — mirrors how
  the Worker held `GH_TOKEN` as an encrypted secret today.
- **Response contract changes, and this is a real behavior change, not just
  an implementation detail**: Apps Script Web Apps cannot return custom HTTP
  status codes — every response comes back as HTTP 200. The current
  405/400/422/502 status-code contract (`SPEC.md` §7) cannot be preserved
  as-is. The new contract: the response body is always JSON,
  `{ ok: true, path }` on success or `{ ok: false, error }` on any failure
  (bad JSON, missing consent, GitHub API failure) — callers must branch on
  the `ok` field, not the HTTP status.
- **Client change (`app.js`)**: the submit request's `Content-Type` changes
  from `application/json` to `text/plain;charset=utf-8` (Apps Script Web Apps
  don't support custom CORS response headers, so a JSON content type triggers
  a failing preflight; `text/plain` avoids the preflight). The JSON payload
  itself is unchanged — it's sent as a string body under the new content
  type. The success/error branch in the submit handler changes from reading
  `response.ok`/`response.status` to reading the parsed body's `ok` field per
  the point above.
- **Request-building/response-handling seam**: on the backend, the pure
  transform — given the raw request body, produce either the GitHub commit
  payload (path, base64 content, commit message) or a structured rejection —
  is a separate function from the actual `UrlFetchApp` network call and
  `PropertiesService` read. On the frontend, the pure branch — given a parsed
  response body, decide success-UI vs. error-UI and what message to show — is
  separated from the `fetch()` call itself. This is the one seam this spec
  introduces; both are plain functions taking data in and returning data out,
  no network or Apps Script globals inside them.
- **Filename/commit convention unchanged**: submissions still land at
  `submissions/<ISO-timestamp-with-dashes>-<6-char-random>.json` in the
  private repo, same as today (`SPEC.md` §7) — only which runtime constructs
  and sends that commit changes.
- **`config.js` / GDPR disclosure**: `processorNote` gains a line naming
  Google (Apps Script) as an additional data processor, alongside the
  existing GitHub Inc. disclosure — the data transits through Google's
  infrastructure for the duration of one request even though nothing is
  persisted there.
- **Setup documentation**: `README.md`'s backend deploy section is rewritten
  as a numbered walkthrough covering: forking the frontend repo, creating a
  private submissions repo, creating a fine-grained PAT scoped to just that
  repo, creating the Apps Script project and pasting in the provided code,
  storing the PAT in Script Properties, deploying as a Web App (execute as
  owner, access "Everyone"), the expected "unverified app" authorization
  prompt (named explicitly, with reassurance it's expected), copying the
  deployment URL into `config.js`, and committing. No terminal commands
  appear anywhere in this section. A short note covers that future edits to
  the Apps Script code require creating a new deployment version.
- **`DESIGN.md` / `SPEC.md` updates**: both are updated to describe the Apps
  Script backend in place of the Worker (architecture diagram, backend
  contract section, "why a relay is needed" reasoning updated for the new
  platform's specific constraints — e.g. the no-custom-status-code
  limitation). `DESIGN.md`'s known-gaps section gains two new entries: the
  documented-but-not-built shared-backend/invite-code fallback plan, and the
  local-clone-and-script extension point for future results-review tooling.

## Testing Decisions

- Only the two pure functions identified above (backend request-builder,
  frontend response-handler) get automated tests — this matches the
  project's own documented convention (`DESIGN.md` §6: "if `app.js`'s
  matching logic grows more branches... consider extracting pure functions
  into a testable module") rather than introducing broad new test
  infrastructure.
- A good test here asserts on inputs/outputs only — e.g. "given this raw
  request body, the builder returns this exact commit payload" or "given a
  missing-consent body, it returns the rejection shape, not a thrown
  exception" — never asserts on internal call sequencing or mocks
  `UrlFetchApp`/`fetch` (there's nothing to test there once I/O is factored
  out of these functions).
- Use Node's built-in test runner (`node:test` + `assert`) — no new
  dependency, no build step, consistent with the project's "no build step,
  plain HTML/CSS/JS" non-functional requirement (`SPEC.md` §9), since tests
  run only during development and never ship to the static site.
- There is no existing test in this repo to follow as prior art (`DESIGN.md`
  §6: "No automated tests... Verification today is manual"); this spec
  establishes the first ones, scoped narrowly to the two new pure functions.
- Everything else (the Apps Script deployment itself, the actual GitHub
  Contents API call, the end-to-end submit flow) stays verified manually via
  local preview + a real test deploy, matching how the rest of the project is
  already verified.

## Out of Scope

- A results-review/admin dashboard or viewer of any kind. Access to results
  remains "clone the private repo," exactly as today — no new UI, no new
  auth mechanism, no password gate. (Explicitly deferred; see Further Notes.)
- Any matching/casting-assignment algorithm beyond what `app.js` already
  computes client-side.
- The shared multi-tenant backend / single-use invite-code registration
  fallback. Documented as a considered next step, not implemented.
- Any change to hosting (stays GitHub Pages), to the sign-on UX/flow, to
  `larps.json`'s schema, or to the client-side matching algorithm.
- Automated CI (no pipeline is being added to run the new tests
  automatically — they're run locally for now, matching the project's
  current "no CI" state).
- Rate limiting, dedup/idempotency, or abuse protection on the new backend —
  these were already-known gaps in the Worker (`DESIGN.md` §6) and carry over
  unchanged; not addressed by this migration.

## Further Notes

- **Fallback plan, recorded for later, not built now**: if per-organiser
  self-hosting turns out to be too much friction in practice, the considered
  next step is a single backend the original maintainer personally operates,
  with other organisers onboarding via a single-use, cryptographically random
  (UUIDv4) invite code, redeemed atomically, sent as a POST body field (never
  a URL query string), over HTTPS, optionally time-boxed. This trades away
  per-organiser data ownership/isolation questions that would need their own
  design pass (does each organiser's data still land in their own repo, or
  does it centralize under repos the maintainer controls?) and meaningfully
  increases the maintainer's GDPR processor/controller responsibility across
  every event using it — flagged here so a future session doesn't have to
  rediscover this reasoning from scratch.
- **Future results-review extension point**: because the submissions repo is
  already private and admin-only, `git clone` access to it already *is* the
  authorization check. Future casting/matching tooling can live as a script
  in that same private repo, run locally against the cloned `submissions/`
  files — no hosting, no password, no new auth system needed for a first
  version.
- **GitHub Pages / private-repo nuance worth keeping documented**: a private
  repo's visibility only protects the repo itself; it does not make a GitHub
  Pages *site* private (Pages access control is an Enterprise-only feature).
  This is why the architecture keeps two separate repos — a public one for
  the Pages-hosted frontend (no secrets, no PII) and a private one purely as
  an API-accessed datastore, never Pages-enabled.
