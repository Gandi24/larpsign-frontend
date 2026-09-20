# Functional Specification — LARP Sign-On Form

Status: living document, updated 2026-09-18: `larps.json`'s `preferenceTags`
and triggers were rebuilt from Krak-ON's real programme data (26 real larps,
replacing the earlier placeholder/guessed content), with tags/triggers
unified from ~90/~93 raw variants down to 31 tags and 75 triggers grouped
into 11 collapsible categories — see §3. A "zapisz i wróć później" draft
autosave (localStorage) was also added — see §6a. Same day: an NPC-interest
checkbox and a temporary "Złoty Bilet" (Golden Ticket) priority picker were
added — see §2 items 1/5 and §6, `schemaVersion` bumped to 4. Later the same
week: photo/video consent switched from a plain checkbox to a required
"Wyrażam zgodę"/"Inne" answer (`schemaVersion` 5), then afterparty was
changed from yes/no to tri-state Tak/Nie/Może and marketing-email consent was
converted to the same "Wyrażam zgodę"/"Inne" shape as photo/video, both to
match the official Krak-ON form's own wording exactly (`schemaVersion` 6).
Then: the custom-written RODO privacy summary and expandable rights list
were replaced with Centrum Kultury Podgórza's own official RODO notice text,
copied verbatim (not paraphrased), plus a verbatim strefazajec.pl payment
processor statement and a dedicated regulamin-link confirmation — three
required checkboxes replacing the old two (`schemaVersion` 7). Immediately
after: afterparty reverted from tri-state Tak/Nie/Może radios back to two
plain optional checkboxes (`schemaVersion` 8, `afterparty.friday`/`.saturday`
now booleans) per explicit user preference for the simpler control over
matching the official form exactly on this one field, and every consent
question's markup was unified into one repeated shape — bold statement,
optional expandable/link section, unbolded selectable option(s) — with the
photo-consent blurb rewritten to state that *all* photos (not just
"controversial" larps') get sent back for verification before publishing —
see §2 items 6-7 and §6. The next day (2026-09-20), a round of organiser
feedback on the tag/trigger taxonomy: `preferenceTags` went from 31 to 32
entries — "Rytuał / duchowość / folklor" split into "Duchowość / religia"
and "Folklor / obrzędy" (5 larps reclassified by reading each
one's actual description, not guessed from the tag name alone — one further
larp initially assigned to "Duchowość / religia" was walked back to neither
new tag on a second pass); "Nietypowa forma / eksperyment" dropped outright
as too broad to discriminate anything; "Ekspresja ciałem / larp bez słów"
renamed to "Larp bez słów" (redundant with "Taniec / larp ruchowy", which
both larps carrying it already had too); "Oniryzm / surrealizm" renamed to
"Oniryzm" (surrealizm was never actually used by any larp); "Orientalne"
added and applied to one larp. Triggers: "Wykluczenie" renamed "Wykluczenie
/ ostracyzm"; "Bycie ofiarą przemocy" / "Bycie sprawcą przemocy" added to
the Przemoc group, applied to one larp with explicit victim/perpetrator
character roles. Two larps in the programme aren't in Polish — rather than
a personalized "known languages" question, each now just carries a fixed,
always-visible 🌐 badge next to its name wherever it appears
(`larps.json`'s per-larp `language` field, unset means Polish; no payload/
schema change, this is display-only). This describes
what the code *does* — for what's actually deployed right now vs. just built
and tested, see `DESIGN.md` §10.
Scope: what the system does and the rules it follows. For *how it's built and why*, see `DESIGN.md`.

## 1. Purpose

A Polish-language sign-up form for a LARP (live-action role-play) festival. A player
who has never read the programme rates what themes they enjoy, flags their personal
triggers, and the form ranks every larp in every timeslot by computed fit — so they
can pick their top choices per slot without prior knowledge of the games.

## 2. User flow

1. **Kto się zapisuje** — first name, last name, preferred form of address,
   email, and phone number (all required); birthdate (required, for 18+
   verification); which character genders the player is willing to play,
   ticked from `larps.json → characterPreferences` (at least one required);
   an optional "chcę zgłosić się jako NPC" checkbox.
2. **Preferencje** — rate every `preferenceTags` entry on a 5-point scale, −2..+2:
   `Nie znoszę / Raczej nie / Obojętne / Lubię / Uwielbiam`. Defaults to 0 (neutral).
3. **Triggery** — tick any number of triggers from `larps.json → triggerGroups`,
   presented as 11 collapsible categories (e.g. "Przemoc", "Zdrowie psychiczne
   i trauma") rather than one flat list — 77 triggers is too many to scan
   un-grouped. A collapsed category shows up to 3 of its checked trigger names
   plus a "+N" overflow count, so a player never has to reopen a category to
   remember what they ticked there.
4. **Sloty** — for each of the 4 timeslots (fixed in `larps.json`), larps are listed
   under "Pozostałe" sorted by descending match %. The player adds up to **4 per
   slot** into a "Twoje wybory" tray, where order is priority (drag via ▲/▼,
   remove via ✕), and picks a **ticket tier** (required) from
   `larps.json → ticketTiers` for each picked larp. Adding/removing re-sorts
   the remaining list live.
5. **Złoty Bilet** — optional, explicitly a temporary feature ("opcja
   tymczasowa na ten sezon" in its own blurb). Three fixed-priority
   `<select>`s (1st/2nd/3rd choice), each listing every larp across all 4
   slots flattened together — independent of the player's own slot picks in
   §4. Not a drag-reorder tray like §4: three fixed dropdowns is enough
   structure for "which larp, in priority order, do you want to redeem your
   one Golden Ticket on" without the complexity a full picker would add for
   a single-use, likely-short-lived mechanic. No duplicate-prevention across
   the three selects — picking the same larp twice is harmless, the
   organiser just reads it as one choice.
6. **Afterparty** — two independent, optional checkboxes ("Chcę wziąć udział
   w afterparty w piątek"/"w sobotę"), independent of slot picks. Simpler
   than matching the official Krak-ON form's own tri-state Tak/Nie/Może
   exactly — briefly implemented that way, then reverted back to plain
   checkboxes on user preference (see `DESIGN.md` §7 for the history); this
   is the one place this form deliberately diverges from the official form's
   own control shape.
7. **Prywatność i zgoda** — five questions, each following one repeated
   visual shape: a **bold** statement of what's being asked, then an
   *optional* supplementary section (an expandable `<details>` for the long
   official text, a plain paragraph, or nothing), then the *unbolded*
   selectable option(s) that answer it. Three required checkboxes carry
   Centrum Kultury Podgórza's own text copied verbatim, not our own
   paraphrase: (a) "Informacja dotycząca przetwarzania danych osobowych." as
   the bold statement, a collapsible `<details>` holding the full, unedited
   official RODO notice (sections I-X: administrator, IOD, legal basis,
   retention, rights, etc.) as the optional section, and "Zapoznał*m się z
   powyższą informacją." as the plain confirmation; (b) "Zapisy i płatności
   obsługuje portal strefazajec.pl." as the bold statement, the verbatim
   "Oświadczam, że zostałem poinformowany..." payment-processor disclosure as
   a plain paragraph, and "Oświadczam, że się zapoznał*m." as the plain
   confirmation; (c) "Regulamin wydarzenia." as the bold statement, "Regulamin
   wydarzenia dostępny jest pod adresem: `<rulesUrl>`" as the optional link,
   and "Zapoznałem się z regulaminem wydarzenia." as the plain confirmation.
   Then, same shape, unchanged mechanics: a photo/video question ("all
   photos get sent back to you for verification before publishing" as the
   optional note, replacing an earlier "controversial larps only" framing)
   and a marketing-email question, both required to *answer* but not to
   agree — "Wyrażam zgodę" or "Inne" with free text, via the shared
   `getYesOtherAnswer`/`validateYesOtherAnswer`/`wireYesOtherField` helpers
   (see §6) — wording matches the official form's "Wyrażam zgodę"/"Inne"
   options exactly, not a generic "Tak".
8. Submit — see §6.

Changing any preference rating or trigger checkbox live-recomputes match % and
re-sorts every slot (`change` listener on the form, §5).

## 3. Data model (`larps.json`)

```jsonc
{
  "preferenceTags": [{ "id": "scifi", "label": "Science fiction" }, ...],   // 32 tags
  "triggerGroups": [
    { "id": "przemoc", "label": "Przemoc", "triggers": ["Przemoc", "Gore", ...] }
    // 11 groups, 77 triggers total
  ],
  "characterPreferences": ["Kobiece", "Męskie", "Niebinarne"],
  "ticketTiers": [
    { "id": "wsparcia", "label": "Bilet Wsparcia", "price": "140 zł" }
  ],
  "timeslots": [
    {
      "id": "pt_wieczor", "name": "Piątek wieczór", "time": "18:00–22:00 (4h)",
      "larps": [
        { "name": "La Candela", "players": 32,
          "tags": ["taniec_ruch", "cialo", "emocje"],
          "triggers": ["Śmierć", "Żałoba", "Ciemność"] },
        { "name": "Gra ludowa", "players": 14, "language": "Białoruski",
          "tags": ["historia", "komedia"], "triggers": [...] }
      ]
    }
  ]
}
```

- `preferenceTags[].id` is the join key used by `larps[].tags`.
- `triggerGroups[].triggers` is a flat string catalogue *within* each group,
  purely for the collapsible-category UI (§2); `larps[].triggers` is a flat
  array of trigger strings (no group indirection) that must match one of
  those strings verbatim — matching/highlighting logic (`getTriggers()`,
  `triggersHTML()`) works exactly as it did with the old flat `triggers` list,
  unaware groups exist. Only the *catalogue's* rendering is grouped.
- `larps[].players` (headcount / capacity) is captured but **not currently used**
  by any matching, sorting, or limit logic — see `DESIGN.md` §6 (Known gaps).
- `characterPreferences` is a flat string catalogue (like the old `triggers`),
  rendered as a checkbox group; the player's ticks are collected but not
  joined against any per-larp data — it's informational for casting, not
  part of matching.
- `larps[].language` (singular, optional string) marks a larp as **not**
  Polish — its absence means Polish, not "unknown". Purely display: it drives
  the `🌐 <language>` badge next to the larp's name (§4), nothing else reads
  it and it isn't collected from the player.
- `ticketTiers[]` is `{ id, label, price }`; `id` is the join key used by each
  slot pick's `ticketTier` in the submission (§6). Price is a display string,
  not a machine-parsed amount — this system has no payment processing; ticket
  choice is informational for the organiser same as everything else.
- Currently 4 timeslots holding Krak-ON's real 2026 programme (26 larps) —
  `preferenceTags` and `triggerGroups` were unified together with the
  organiser from that event's actual per-larp tag/trigger data (`_note`
  records the source and date), not guessed from titles. `players` is each
  larp's max headcount from the organiser's sheet.

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

**Language badge**: a larp whose `language` field is set (i.e. not Polish)
shows a `🌐 <language>` badge right next to its name, in both "Twoje wybory"
and "Pozostałe" (`languageBadgeHTML()` in `app.js`). Unconditional — it's
information about the larp itself, not a personalized warning, so it isn't
gated behind any player input.

**Sort order**: within a slot, un-picked larps ("Pozostałe") are sorted purely
by descending match %. Picked larps ("Twoje wybory") keep the player's manual
priority order, not match %.

## 5. Selection rules

- Max **4 picks per slot** (`MAX_PICKS`), independent per slot.
- A larp already picked in a slot cannot be re-added; disabled `+ Dodaj` once
  the slot tray hits 4.
- Reordering is via ▲/▼ (swap with neighbor); ✕ removes and reflows.
- Each pick carries its own **ticket tier** (`selections[slotId][i].ticketTier`,
  a `ticketTiers[].id`), chosen from a `<select>` in the tray item. Unset by
  default; submit is blocked until every current pick has one (§6).
- No cross-slot exclusivity — a player may pick larps that would clock-conflict
  outside this tool; the sign-on has no concept of "you can only attend one
  slot's worth of larps across the whole festival" beyond the per-slot cap.

## 6. Validation & submission

**Client-side validation** (`validate()`, blocks submit until satisfied):
- First name, last name, preferred address, email (format-checked via the
  input's own `checkValidity()`, not just non-empty), phone, and birthdate
  all non-empty.
- At least one `characterPreferences` checkbox ticked.
- All three RODO/consent checkboxes checked: the official privacy-notice
  read-confirmation (`#consent-rodo`), the strefazajec.pl payment-processor
  acknowledgement (`#consent-strefazajec`), and the regulamin read-confirmation
  (`#consent-rules`).
- The photo/video question and the marketing-email question each have a
  selection — "Wyrażam zgodę" or "Inne" (`getYesOtherAnswer(name).choice !== null`,
  shared by both via `validateYesOtherAnswer`/`wireYesOtherField`). The
  *content* isn't validated: "Inne" with an empty free-text field still counts
  as answered — only an *answer* is required, not agreement.
- Every current slot pick has a `ticketTier` selected (checked per slot, in
  tray-item DOM order — see `DESIGN.md` §6 for why by-position, not by-name).

**Validation timing**: each required field/group gets its own inline message
(a `<p class="field-error">`, `aria-describedby`-linked to its control) rather
than relying solely on the one bottom-of-form status line. A field only shows
its error once the player has *touched* it — first `blur` for text/date/tel
inputs, first `change` for the checkbox groups and ticket `<select>`s — so an
untouched, empty required field stays neutral on page load rather than
greeting the player with a wall of red. Once touched (or once a submit has
been attempted, which marks every field touched at once), the message updates
live on every further `input`/`change`, disappearing the moment the field
becomes valid. Re-rendering the slots list (add/remove/reorder a pick) rebuilds
its DOM from scratch, which would otherwise silently drop a showing ticket
error — `revalidateTickets()` re-applies it immediately after, but only once
a submit has already been attempted, keeping the same "don't shame early"
rule consistent across re-renders.
No validation requires *any* slot picks, ratings, or triggers themselves — a
player who adds zero larps to any slot can still submit, as long as the
identity/consent fields above are satisfied (a pick, once added, does require
its ticket tier).

**Submission payload** (`schemaVersion: 8`):

```jsonc
{
  "meta": { "event", "submittedAt" /* ISO */, "schemaVersion": 8 },
  "identity": {
    "firstName", "lastName", "preferredAddress", "email", "phone",
    "birthdate" // "YYYY-MM-DD" from <input type=date>, no auto age-check
  },
  "characterPreferences": ["<characterPreferences string>", ...],
  "wantsNpc": false,
  "goldenTicket": { "priorities": ["<larp name>", ...] },  // 0-3 entries, empty selects dropped, order preserved
  "afterparty": {
    "friday": true,   // plain optional booleans — unchecked is a valid false
    "saturday": false
  },
  "consent": {
    "rodoNoticeRead": true,       // confirms the official RODO notice (verbatim, §7)
    "strefazajecInformed": true,  // confirms the strefazajec.pl payment-processor disclosure (verbatim)
    "rulesRead": true,            // confirms the event regulamin
    "photoVideo": { "choice": "tak", "other": "" },        // choice: "tak" | "inne" | null (null only pre-validation)
    "marketingEmail": { "choice": "inne", "other": "nie" }, // same shape as photoVideo, same validation
    "timestamp" /* ISO */
  },
  "preferences": { "<tagId>": -2..2, ... },       // every tag, defaults included
  "triggers": ["<trigger string>", ...],           // only the ticked ones
  "choices": {
    "<slotId>": [
      {
        "priority": 1,                             // 1-based, matches tray order
        "name": "<larp name>",
        "ticketTier": "<ticketTiers[].id>",         // null only if collected pre-validation
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

## 6a. Draft autosave ("zapisz i wróć później")

The whole form autosaves to `localStorage` (key `larpsign:draft:v1`) on every
`input`/`change`, debounced ~600ms, with no manual save button — a button can
be forgotten right before an accidental tab close; autosave can't be. On page
load, a saved draft (if any) restores identity fields, ratings, triggers,
character preferences, the NPC checkbox, Golden Ticket priorities, slot picks
+ ticket tiers, and afterparty choices before `renderSlots()` runs.

**Deliberately excluded from save/restore**: the consent checkboxes (general,
rules-read, photo/video, marketing). A returning player re-confirms consent
explicitly rather than inheriting a stale, un-reviewed agreement.

**Visible feedback**: a small fixed badge, top-right corner (`#draft-badge`),
hidden until a draft exists. It reads "Zachowano dane · HH:MM" after any
autosave, or the same text using the saved timestamp on restore — one visual
language for both "just saved" and "restored from earlier," no separate
"restored" message. There is no manual clear/reset control; the draft clears
itself automatically on successful submission (both the real backend path and
the local-download fallback), so a later visit never tries to restore an
already-submitted form.

**Defensive handling**: storage access is probed once at load (`draftStorage()`)
and every read/write is wrapped in `try`/`catch` — private browsing, storage
quota, or a corrupted stored value all degrade to "autosave silently does
nothing" rather than breaking the page. Restoring also drops any saved pick
whose slot or larp no longer exists in the current `larps.json` (content may
have changed since the draft was saved).

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
- `submission.consent.rodoNoticeRead === true && submission.consent.strefazajecInformed
  === true && submission.consent.rulesRead === true` → else
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

- **Lawful basis**: explicit opt-in consent, three checkboxes required,
  timestamped and stored with every submission — confirming the official
  RODO notice (`rodoNoticeRead`), the strefazajec.pl payment-processor
  disclosure (`strefazajecInformed`), and the event regulamin
  (`rulesRead`), each its own distinct purpose. `photoVideo` (promotional
  photo/video use) is a required *question*, not a required *consent* — the
  player must pick "Wyrażam zgodę" or "Inne" (with optional free text for
  nuance, e.g. partial consent), but either answer, including a declining
  "Inne", satisfies validation. `marketingEmail` follows the identical
  pattern. Keeping photo/video and marketing-email as their own fields
  (rather than folding them into the general consents) matters because each
  is a distinct purpose under GDPR from processing data for casting —
  consent (or its refusal) for a distinct purpose must be freely given,
  separable, and not a condition of using the service, which is also why
  answering the question is required but *agreeing* is not.
- **Transparency**: the full official "Informacja dotycząca przetwarzania
  danych osobowych" (Centrum Kultury Podgórza's own RODO notice, sections
  I-X — administrator, IOD, legal basis and purposes, data-subject rights,
  retention, recipients, automated-decision and third-country disclosures)
  is reproduced verbatim in a `<details>` block, not paraphrased or
  summarized — see `DESIGN.md` §7 for why independent wording was abandoned
  in favor of copying the organiser's own text exactly. The
  strefazajec.pl payment-processor statement is likewise verbatim, with its
  full text serving as the checkbox's own label rather than a summary of it.
  If `config.js.rulesUrl` is set, a note above the third checkbox links to
  the regulamin directly ("Regulamin wydarzenia dostępny jest pod adresem:
  ...").
- **Data minimization**: name, email, phone, and birthdate are all mandatory
  — a wider set than the original nickname-only design, adopted to match a
  real festival's actual needs (emergency contact, 18+ verification for
  legally-required age-gating). No further PII beyond what's in this spec is
  collected.
- **Storage location disclosure**: this form's own processing chain (Google
  Apps Script relay, data transits but is not persisted there, and GitHub as
  the actual storage, both USA-based) is not separately disclosed to the
  player in the form's own copy — the official RODO notice (§V, "Odbiorcy
  danych osobowych") covers processors in general terms. If this becomes a
  compliance concern, it belongs in the organiser's own regulamin/RODO text,
  not as separately-invented copy in this codebase — see `DESIGN.md` §7.
- **Retention**: the official RODO notice's own §VI states concrete retention
  periods (accounting/tax documentation: 5 years after the year of the
  event; camera-monitoring recordings: no more than 3 months; consent-based
  processing: until withdrawal) — reproduced verbatim as part of the notice,
  superseding this project's earlier approach of displaying no retention
  info at all (see `DESIGN.md` §7 for that history). *Enforced manually
  regardless*: deleting the JSON file in the private repo is this project's
  own deletion mechanism, there is no automated expiry job.
- **Erasure**: the official notice's own §I/§II give the authoritative
  contact channels (Centrum Kultury Podgórza, `sekretariat@ckpodgorza.pl`,
  and its Inspektor Ochrony Danych at `iod@ckpodgorza.pl`); `controller.email`
  in `config.js`, shown in the footer, is this project's own practical
  contact for erasure requests specifically about a `larpsign` submission —
  manual process either way (organiser finds and deletes the file(s) for
  that person).
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
