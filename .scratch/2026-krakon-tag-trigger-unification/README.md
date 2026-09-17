# Tag/trigger unification — Krak-ON 2026 programme import

Checked in as a reference, not a maintained tool. On 2026-09-18, Krak-ON's
organiser exported their programme spreadsheet (Notion, columns `Tytuł`,
`Slot w harmonogramie`, `Maks./Min. graczy`, `Tagi`, `Triggery`, plus
`Oryginalne tagi`/`Oryginalne triggery` showing each GM's raw submitted
values) as CSV. That raw vocabulary was ~90 tags and ~93 triggers, almost
entirely used by a single larp each — not usable as a rating scale or a
scannable checklist as-is.

`gen_larps.py` is the script that turned that export into the current
`larps.json`. It embeds two hand-built dictionaries — `TAG_MAP` (raw tag →
one of 31 unified `preferenceTags`) and `trig_map()` (raw trigger phrase →
one or more of 75 unified triggers, organized into the 11 `triggerGroups`
categories) — built by going through every larp's actual raw tags/triggers
and agreeing the mapping with the organiser (see `SPEC.md` §3 and
`DESIGN.md` §7 for what that unification pass actually did: merges,
splits, and ~20 explicit drops of items judged too narrow/branded to be a
reusable category).

**To reuse for a future event's programme**: don't expect this script to
just re-run — its dictionaries are specific to this event's raw vocabulary.
Instead, use it as a *template* for the same process: export the new
programme the same way, tally raw tag/trigger frequency (a few lines of
`collections.Counter` over the `Tagi`/`Triggery` columns), go through the
unification conversation again, and write fresh `TAG_MAP`/`trig_map`
dictionaries against the new raw vocabulary. The CSV itself (and any GM
contact info in the fuller export) was never committed here — it contains
real people's emails/phone numbers/Discord handles and has no business in a
public repo.
