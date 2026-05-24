# POR & Backup Plan Writing Criteria

Evaluation rubric for Plan of Record (`narrative_override`) and Backup Plan (`backup_plan`) text on `pp_plan_of_record`. These fields render to parents — usually a mom — at the top of a metro's panel. Optimize for clarity, calm, and accuracy.

## Audience

Two readers, equally important:

1. **Current Alpha parents** — already enrolled, want to know where their child will be next year and what the path is.
2. **Prospective parents** — considering Alpha for the first time, evaluating whether the school will exist near them in time for their child.

Both are reading the same text. Write so neither feels excluded:

- **Don't say "your child is in class today at…"** — that frames the reader as already enrolled and shuts out prospects.
- **Don't say "we hope you'll join us"** — that frames the reader as a stranger and feels salesy to enrolled families.
- **Do** describe what's true about the metro: where Alpha runs today, what's being built, when it opens. Let the reader place themselves in it.

## Voice

- **Honest, not corporate.** "We're opening at…" not "Alpha is pleased to announce…"
- **Calm and confident**, not breathless or hedged.
- **Direct.** Lead with what we're doing, then context.
- **No em-dashes (—).** They read as AI-generated. Use a comma, period, or parentheses instead. Hyphens in street names (`5000 T-Rex Ave`) are fine; the rule is about prose punctuation.
- **Hedge when the lead site isn't leased.** If the lead campus has `leasing_status != 'done'`, default to "Alpha plans to open in…" or "Alpha is working to open in…" rather than "Alpha is opening in…". The unhedged form implies near-certainty. Use unhedged only when there's explicit off-system confidence (e.g. verbal agreement on purchase pending).

## Content rules

1. **No jargon.** Strip these and similar:
   - `cap` → "students" or "room for"
   - `CUP`, `entitlement`, `conditional use permit` → "city approval" (or just don't mention the mechanism)
   - `Phase 1` → "starting with" / "growing to"
   - `permits pending`, `permits acquired` → "in final approvals"
   - `LOI`, `lease executed`, `zoning cleared` → don't surface; describe outcomes only

2. **Numbers and dates must match the location cards.** Pull from `pp_locations_with_votes`:
   - `capacity_override` → opening student count
   - `max_cap_capacity_override` → full capacity
   - `target_open_date_override` → opening date
   - `max_cap_date_override` → full-capacity date
   - If POR and card disagree, fix the POR — cards are the source of truth for parents.

3. **Convey likelihood without technicalities.** If one site is more likely than another, say so in plain terms ("more straightforward path with the city") — don't explain *why* (CUP vs. permits, zoning class, etc.).

4. **Order by parent relevance, not internal priority.** Permanent campus first, then bridge/short-term sites, then any backup. A bridge (the temporary launch site while a permanent is being readied) is not a backup — lead with the permanent and follow with the bridge.

5. **Every address must link to its detail page.** `PlanOfRecord` auto-linkifies any address string that matches a known location's stored street (case-insensitive, tolerates hyphens/spaces). To make a mention clickable, write the address using **every token of the stored street**, including the suffix (`Dr`, `Ave`, `Street`, `Hwy`). Examples:
   - Stored `353 HIATT DR` → write `353 Hiatt Dr`, not `353 Hiatt`.
   - Stored `10350 RIVERSIDE DR` → write `10350 Riverside Dr`, not `10350 Riverside` or `at Riverside`.
   - Stored `2200 NW 5th Avenue` → write `2200 NW 5th Avenue`, not `2200 NW 5th Ave`.
   - Stored `8000 SW 56th Street` → write `8000 SW 56th Street`, not `8000 SW 56th`.

   If repeating the full address makes a second mention read awkwardly, rephrase to avoid the address ("the new campus", "the bridge site") rather than leave a bare unlinked reference.

## Backup plan rules

The backup plan is read when parents are already worried. Its job is to reassure, not catalogue failure modes.

1. **Don't manufacture fear.** No "licensed hotel space," "temporary homeschool," etc. as bare phrases — soften: "a temporary Miami Beach space, likely a nearby hotel."
2. **No long commutes.** Don't suggest parents drive 30+ minutes out of their metro. If we'd actually do that internally, it doesn't belong in parent-facing copy.
3. **Stay local.** The backup should keep kids in the same neighborhood/metro.
4. **One sentence on what we'd do**, one sentence on what we won't ask of them. That's enough.
5. **Default backup template (single-site metros).** When a metro has a single permanent site and no other inventory in the workstream, use this template: *"If <site address> isn't ready in time, we'll secure a temporary <metro> space, likely a nearby hotel, so families can still start on time. No commutes out of the area."* Skip this template when the metro has additional active sites — only use when there's literally nothing else to point to.
6. **Drop redundant backups.** If the backup just restates options named in the POR (e.g., POR mentions Sites A and B, backup says "If A fails we move to B"), set `backup_plan = null`. Backup is worth keeping only when it adds genuinely new information — the hotel fallback above, an out-of-list reassurance, etc.

## Anti-examples (real, since fixed)

> "Primary: 1021 Biarritz Dr targeting Aug 2026 (Phase 1 cap 167) with full 250 entitlement by Aug 2027 — pending CUP transfer from City of Miami Beach."

Problems: jargon (cap, entitlement, CUP), wrong number (167 vs. card's 80), wrong date (Aug 2027 vs. card's Jan 2027), mechanism over outcome.

> "If none of these land in time: commute to Miami, Boca, or Palm Beach, or temporary homeschool in a licensed hotel space in Miami Beach."

Problems: ridiculous commutes for a Miami Beach family, "homeschool in a hotel" reads as panic, three fallbacks suggest no plan.

## Quick checklist before saving

- [ ] No real-estate jargon
- [ ] No em-dashes (—) anywhere in the prose
- [ ] Every address mention uses the full stored street tokens (so it linkifies)
- [ ] Numbers + dates match `pp_locations_with_votes` overrides
- [ ] Permanent site framed first; bridges next; backup last
- [ ] Lead-site language matches lease status (no "is opening" without a signed lease)
- [ ] Likelihood signal is plain English ("more straightforward path") if relevant
- [ ] Backup adds new information (or is omitted if it doesn't)
- [ ] Backup plan keeps families in-metro
- [ ] Backup plan doesn't read as panic
- [ ] Read it out loud as if you were a parent — does it calm you or worry you?
