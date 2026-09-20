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

**The −2..+2 rating buttons show a face icon, not the number.** `faceIcon(v)`
draws a two-dot-eyes-plus-one-mouth-curve SVG where the mouth's control point
is a direct function of `v` (frown "∩" for negative, smile "◡" for positive,
flat at 0) — one small function generates all 5 positions, not five hand-drawn
icons. Unselected buttons also get a faint diverging red/green background tint
(`segTint(v)`, using the page's existing `--danger`/`--ok` colors at low
alpha) so the row reads left-to-right as dislike→like before a player reads
any label. This is a deliberately *bipolar* red-green use, unlike the match-%
bars' single-hue ramp (§ bar color decision) — it's safe here because each of
the 5 positions is also distinguished by shape (a different mouth curve) and
fixed left-to-right order, not by color alone, so it doesn't have the
color-only-encoding problem a continuous red-green gradient would. The tint is
applied via a `--tint` custom property set inline per button, consumed by
`.seg span { background: var(--tint, #fff); }`, specifically so it can't
out-specificity `.seg input:checked + span { background: var(--accent); }` —
setting `background` directly inline would have.

## 6. State management in `app.js`

- `data` — the fetched `larps.json`, loaded once at `init()`, treated as
  read-only for the session.
- `selections` — `{ slotId: [{ name, ticketTier }, ...] }`, the only mutable
  app state, holding picks in priority order (array position = priority).
  This is the single source of truth for the "Twoje wybory" tray. `validate()`
  checks each pick's `ticketTier` by DOM position (`.ticket-select` elements
  in tray order), not by re-querying with the larp name as a selector value —
  deliberately, since larp names can contain characters (parens, quotes) that
  would need escaping in an attribute selector otherwise.
- Ratings and triggers are **not** mirrored into JS state — they're read
  live from the DOM (`getRatings()`, `getTriggers()`) whenever needed. This
  means the DOM *is* the source of truth for those two, and `selections` is
  the only thing kept outside it.
- Render pattern: any state change calls the relevant `render*()` function,
  which does a full `innerHTML` replace of its container (no diffing, no
  virtual DOM, no component framework). At this data volume (4 slots, 26
  larps, 32 tags, 77 triggers across 11 groups) full re-render is cheap
  enough that this is a reasonable, low-complexity choice rather than a
  limitation to fix.
- `larpByName(slot, name)` — larps are looked up **by name string**, not id.
  This is a latent footgun: two larps with the same name in the same slot
  would collide in `selections`. Fine today (all names are unique per slot in
  `larps.json`), but if that invariant is ever violated, picks/removal would
  silently misbehave. Worth an `id` field if the content set grows or is
  edited by non-engineers.
- `touched` (a `Set` of field ids) and `submitAttempted` (a bool) — the state
  behind "don't shame an empty required field before the player has reached
  it." The form has `novalidate`, so the browser's own validation bubbles
  never appear; `fieldMessage()`/`setFieldError()` render the same information
  as an inline `<p class="field-error">` instead, deliberately, because a
  native bubble can't be middle-ground-styled to match the rest of the page
  and disappears on its own timing, not the page's. A field only starts
  showing a live error after its first `blur` (text/date/tel) or `change`
  (checkbox groups, ticket `<select>`s) — checked against `touched`, not
  against whether the field is currently empty — so tabbing through the form
  without typing anything doesn't light up in red immediately behind the
  cursor. `validate()` (run on submit) treats every field as touched at once,
  which is also what flips `submitAttempted`, so any later slot-list
  re-render (add/remove/reorder) knows to keep re-showing ticket errors via
  `revalidateTickets()` instead of going silent just because the DOM under it
  was rebuilt.
- `submit-outcome.js` deliberately sits *outside* this state entirely — it's
  a pure function of a parsed response body, loaded as its own `<script>` tag
  before `app.js` so it can be `require()`d directly by Node tests without
  pulling in `window`/`document` (see §7).
- `storage` (a `localStorage` handle, or `null` if unavailable) backs the
  draft-autosave feature (`SPEC.md` §6a). It's probed once (`draftStorage()`)
  rather than assumed present, because `localStorage` throws synchronously in
  private-browsing contexts in some browsers — a thrown probe just means
  autosave silently does nothing, never a broken page. Deliberately **not**
  a manual "Save" button: a button is exactly the thing someone forgets to
  click right before an accidental tab close, so every `input`/`change` on
  the form schedules a debounced (~600ms) write instead, plus an explicit
  `scheduleSave()` call after `onSlotAction` (button clicks on the tray don't
  fire `input`/`change` on the form the way a text field or checkbox does).
  Consent checkboxes are excluded from the saved/restored shape on purpose —
  a returning player re-confirms consent rather than inheriting it silently.
  The visible feedback is a single small fixed badge (`#draft-badge`, top-right,
  hidden until a draft exists) rather than a page-width bar: the first version
  of this was a sticky top banner with a "Zacznij od nowa" reset button, but
  that read as more prominent than the feature warranted for something this
  low-stakes, and a manual reset control wasn't wanted at all — the draft
  already clears itself on successful submit, which is the only "reset" this
  needs.

## 7. Known gaps / deliberately deferred

These are absent by omission, not oversight — flagging them so a future
session doesn't have to rediscover them by reading code:

- **Privacy notice content is deliberately copied from Krak-ON's own
  published sources, not independently worded — and went through two rounds
  of correction as a closer source turned up each time.** Earlier drafts used
  `controller.name` = the full 3-organiser list from the regulamin's §1
  ("who runs the festival") and a made-up `retention` value ("do 60 dni po
  festiwalu"). Both were wrong: running an event and being its RODO data
  controller are different questions with different answers here, and the
  regulamin states no concrete retention period at all ("przez okres
  niezbędny do realizacji celu"). Round 2 corrected `controller.name` to the
  single administrator named in the regulamin's own photo-scoped RODO clause
  (Stowarzyszenie Terra Futura alone) — but that clause turned out to be
  narrower than the *general* data-processing consent on the real, currently
  live Krak-ON Google sign-on form, whose own text names two co-administrators
  ("...Stowarzyszenie Terra Futura oraz Centrum Kultury Podgórza"). Round 3
  matched that instead, since it's the most specific and most current source
  for what this form's own consent actually covers. The `retention` config
  field was removed entirely (a still-optional field showing nothing is
  functionally identical to no field, and a stale-looking unused config key
  invites someone to "helpfully" fill it back in with another guess), and the
  "Twoje prawa" rights list was expanded to match the real form's own list
  (access, rectification, erasure, restriction, portability, consent
  withdrawal, UODO complaint) instead of the shorter ad-hoc version that
  shipped first. Same round: the **photo/video and marketing-email consent
  questions were changed from checkboxes to a required-answer-not-
  required-agreement "Wyrażam zgodę" / "Inne" (free text) choice**, matching
  the real form's own options exactly rather than a generic "Tak"/"Nie" —
  implemented once as a shared pattern (`getYesOtherAnswer` /
  `validateYesOtherAnswer` / `wireYesOtherField` in `app.js`, driven by the
  `#{name}-group`/`#{name}-yes`/`#{name}-other`/`#{name}-other-text`/
  `#{name}-error` id convention) and reused for both fields rather than
  duplicated. Afterparty interest was also changed from yes/no to tri-state
  Tak/Nie/Może to match the real form. If Krak-ON's regulamin or sign-on form
  change their wording later, this form's copy needs to move with it — there's
  no mechanism that keeps them in sync automatically, and there isn't a good
  one available (both are normal web pages, not an API).
  **Round 4** went further: the custom-written `renderPrivacy()` summary
  (`config.js.controller`/`processorNote` templated into a few sentences) and
  the ad-hoc "Twoje prawa" rights list were removed entirely and replaced
  with Centrum Kultury Podgórza's actual, complete "Informacja dotycząca
  przetwarzania danych osobowych" — the real form's own RODO notice text
  (sections I-X), pasted verbatim into `index.html` as static markup inside a
  `<details class="rodo-notice">`, not templated or reworded at all. A second
  verbatim block, the strefazajec.pl payment-processor disclosure, was added
  the same way — its full "Oświadczam, że zostałem poinformowany..." text
  *is* the checkbox's own label, not a summary of it. A third, new checkbox
  ("Zapoznałem się z regulaminem wydarzenia") keeps the regulamin
  confirmation, now preceded by its own "Regulamin wydarzenia dostępny jest
  pod adresem: ..." line instead of being folded into the checkbox label
  itself. `renderPrivacy()` is gone from `app.js`; `config.js.processorNote`
  was deleted (unused once `renderPrivacy()` was removed — same "don't leave
  a stale config key lying around" reasoning as the `retention` field
  removal above). **This surfaces an unresolved discrepancy worth flagging
  rather than silently resolving a fourth time:** the verbatim notice names
  its administrator as Centrum Kultury Podgórza *alone*, while
  `config.js.controller.name` still holds Round 3's two-organiser value
  ("Stowarzyszenie Terra Futura oraz Centrum Kultury Podgórza"), used in the
  footer's erasure-contact line and nowhere else now that the privacy-notice
  rendering is gone. Round 3's source (the general-consent checkbox text on
  the live Google Form) and this round's source (the complete, from-the-org
  RODO notice) may simply be scoped differently — the two-org phrasing could
  cover the *festival's* general consent while the notice covers this
  specific *venue's* own RODO administrator role — but that's a guess, not a
  verified fact; whether `controller.name`/`controller.email` should still
  read "Stowarzyszenie Terra Futura oraz Centrum Kultury Podgórza" or should
  be corrected to match the notice's own contact channels
  (`sekretariat@ckpodgorza.pl`, IOD `iod@ckpodgorza.pl`) needs the organiser's
  own confirmation before either is guessed at again.
  **Round 5**, immediately after: two presentation-only changes, no new
  discrepancies. First, **every consent question's markup was unified into
  one repeated shape** — a bold `<strong>` statement of what's being asked,
  then an *optional* supplementary section (the RODO `<details>`, a plain
  paragraph for strefazajec.pl/regulamin, or nothing for marketing-email),
  then the actual selectable option(s) at normal (unbolded) weight. This
  also fixed a real inconsistency the unification pass surfaced: the
  marketing-email question's label had never been bolded like the
  photo-consent one was, despite both following the same
  `getYesOtherAnswer` pattern — now both are. Second, the photo-consent
  blurb ("Zdajemy sobie sprawę, że niektóre larpy mają tematykę
  kontrowersyjną — zdjęcia z takich gier zostaną przed publikacją przesłane
  do weryfikacji uczestnikom") was replaced with a shorter, broader
  statement that *all* photos (not just ones from "controversial" larps) get
  sent back to the player for verification before publishing — a real
  process commitment, not just copy trimming, so if that's not actually the
  organiser's intended review process this needs correcting before launch.
  **Also in Round 5, unrelated to consent:** afterparty, which Round 3 had
  deliberately changed from plain checkboxes to tri-state Tak/Nie/Może to
  match the official form exactly, was reverted back to plain optional
  checkboxes ("Chcę wziąć udział w afterparty w piątek/w sobotę") on
  explicit user preference — the simpler control was judged better here even
  though it means this one field no longer mirrors the official form's own
  shape (`getAfterpartyAnswer()` removed from `app.js`; `afterparty.friday`/
  `.saturday` are plain booleans again, `schemaVersion` 8). This is a
  deliberate, acknowledged divergence, not an oversight — don't "fix" it
  back to tri-state without asking first.
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
- **Ticket tiers are informational only, no payment processing.** `ticketTiers`
  (added modeling a reference festival's Google Form) captures which tier a
  player intends to buy per pick — it does not charge anyone, check inventory,
  or enforce the reference form's own rule that Social-ticket availability is
  capped by how many Support tickets were bought. If a real event needs that,
  it's a manual reconciliation the organiser does from submitted data, same
  as capacity (`players`, above) — not logic this form implements.
- **Content is now real, not guessed — but the tag/trigger vocabulary is a
  curated unification, not a raw import.** As of 2026-09-18, `larps.json`
  holds Krak-ON's actual 2026 programme (26 larps) with real per-larp
  tags/triggers from the organiser's own sheet — no longer titles/authors
  guesses. That sheet's raw vocabulary was ~90 tags and ~93 triggers, almost
  all used by only one larp (a folksonomy, not a rating scale). `preferenceTags`
  (32, see below) and `triggerGroups` (11 groups, 77 triggers) are a manual unification
  done together with the organiser — merging near-duplicates, splitting
  compound raw values (e.g. `rasizm/dyskryminacja` → two separate triggers),
  dropping ~20 items judged too narrow/branded to be a reusable category
  (media references like `Wiedźmin`/`tarantino`, pure logistics/prop notes
  like `wymagane czarne/ciemne`). The generation script and full raw→final
  mapping are checked in at `.scratch/2026-krakon-tag-trigger-unification/`
  as a reference for redoing this process for a future event's programme —
  it won't just re-run against new data, see that folder's own README for
  why and what to do instead. The source CSV itself was never committed;
  it carried real GMs' emails/phones/Discord handles.
- **The 2026-09-18 unification wasn't the last word — a 2026-09-20 organiser
  feedback round reshaped part of it, this time from *player experience*
  complaints rather than a raw-tag folksonomy problem.** "Rytuał / duchowość
  / folklor" was one tag standing in for two things players feel oppositely
  about — a character devoted to *local folklore/tradition* vs. one devoted
  to *religion/the divine* — split into "Duchowość / religia" and "Folklor /
  obrzędy". Deciding which of the 6 affected larps got which (or
  neither) wasn't done from the tag name alone: each larp's actual
  description was read (from the organiser's shared doc) to judge it — e.g.
  "Nie ufaj tengu w onsenie yokai" (explicitly tagged `#folklor_japoński` by
  its own author) is Folklor. First pass also put "Kult Bachusa i Astarte"
  (a ritual literally invoking named gods) under Duchowość/religia — the
  organiser walked that back on review, so it now carries neither of the two
  split tags, just its other three. That correction is itself worth keeping
  in mind: reading a description and picking the "obviously" fitting new tag
  isn't the same as the organiser's own judgment of whether the tag actually
  belongs, even when the reasoning sounds solid. "Nietypowa forma /
  eksperyment" was dropped outright rather than replaced — the 3 larps
  carrying it turned out to be structurally unrelated (a vignette-scene
  theatrical piece, a Szekspir jeepform/metagra, a Japanese-folklore murder
  mystery), so a single shared tag was misrepresenting a commonality that
  didn't exist; each keeps its other, more specific tags instead. "Ekspresja
  ciałem / larp bez słów" and "Oniryzm / surrealizm" were trimmed to "Larp
  bez słów" and "Oniryzm" — confirmed against the data first, not just taste:
  every larp with the "ciałem" tag already carried "Taniec / larp ruchowy"
  too (so nothing was reclassified, just shortened), and "surrealizm" turned
  out to be entirely unused across the whole programme. "Orientalne" was
  added and applied to the one larp explicitly built around Japanese
  folklore/anime aesthetics — added to the vocabulary but intentionally not
  forced onto looser candidates (e.g. "Awatar: Rozdroża", Avatar-inspired
  but not itself specifically Orientalist) without the organiser confirming
  the read. On the trigger side: "Wykluczenie" renamed "Wykluczenie /
  ostracyzm" (same trigger, clarified wording, both existing usages
  updated); "Bycie ofiarą przemocy" / "Bycie sprawcą przemocy" added to
  Przemoc for players who care which *side* of on-screen violence their
  character is on (not the same axis as violence *type*, which the existing
  Przemoc sub-triggers already cover) — applied to "River Tale...", the one
  larp whose description explicitly splits characters into
  invaders/collaborators/revolutionaries vs. innocent victims. All of this
  needed a real source, same discipline as the RODO content in §7 above —
  it came from the organiser's own larp-description doc
  (`.scratch/2026-krakon-tag-trigger-unification/gen_larps.py`'s header
  comments link the doc used), not from guessing at what a larp "probably"
  covers from its title alone.
- **New feature this round: a language badge, deliberately simplified
  mid-flight.** Two larps in the programme aren't in Polish (an English one,
  a Belarusian one whose written materials are in Russian per the
  organiser). The first version personalized this: a "which languages do you
  know" checklist plus a conditional `.lc-warn` note that only showed up if
  the larp's language wasn't among the player's ticks (mirroring
  `dislikesHTML()` exactly, including a new `languages` top-level vocabulary
  array and per-player `languages` field in the submission, `schemaVersion`
  9). The user rejected that on review — wanted, verbatim, "just mark
  visibly next to larp's name that this game is played in other language
  than polski." That's unconditional information about the *larp*, not a
  personalized judgment about the player, so the whole "known languages"
  side was removed: no question, no checklist, no per-player field, no
  `schemaVersion` bump (reverted to 8 — the payload shape ended up identical
  to before this round started). What's left is `larps.json`'s per-larp
  optional `language` field (absence = Polish, not "unknown") and
  `languageBadgeHTML()` in `app.js`, which renders a small `🌐 <language>`
  badge directly next to `.lc-name` whenever it's set — always, not
  conditionally — in both the "available" card and an already-added tray
  item. Worth remembering for next time a "warn the player about X" feature
  comes up: check first whether X is actually about the player (→
  conditional, personalized, `dislikesHTML()`-style) or about the larp
  itself (→ unconditional badge, no new question needed) — this one started
  as the former by default-assuming symmetry with triggers/dislikes, when it
  was actually the latter.
- **Character-preference and consent-marketing state is a folksonomy risk in
  miniature, but small enough not to need the tag treatment above.**
  `characterPreferences` stayed a flat 3-item list; no unification was needed
  at this scale.

## 8. Extension points (where to make common changes)

| Change | Where |
|---|---|
| Add/edit larps, timeslots, tags, triggers, character preferences, ticket tiers | `larps.json` only |
| Event name, controller contact, rules link, endpoint URL | `config.js` only |
| Change match % formula or scale bands | `likeliness()` / `likeLabel()` in `app.js` |
| Change max picks per slot | `MAX_PICKS` in `app.js` |
| Change submission schema | `collect()` in `app.js` **and** update `SPEC.md` §6 + bump `schemaVersion` |
| Change storage backend or add validation | `Code.gs` in the `larpsign-backend` repo |
| Change the submit request/response contract | keep `submit-outcome.js` here and `buildSubmissionRequest()` in `larpsign-backend`'s `Code.gs` in sync — see §3, and update both repos |
| Add a results-review/casting tool | a script reading the cloned private submissions repo locally — see §7 |
| Visual restyle | `styles.css` (CSS custom properties in `:root` drive the palette) |
| Rebrand for a different event | replace `assets/krakon-logo.svg` and swap `.masthead`'s background/logo in `index.html`; `styles.css`'s `--accent`/`--navy` already happen to be Krak-ON's real brand colors (pink `#ec398b`, navy), not neutral defaults — pick your own if forking for another event |

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
