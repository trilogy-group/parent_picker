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

4. **Order by parent relevance, not internal priority.** Primary site first, backup second.

## Backup plan rules

The backup plan is read when parents are already worried. Its job is to reassure, not catalogue failure modes.

1. **Don't manufacture fear.** No "licensed hotel space," "temporary homeschool," etc. as bare phrases — soften: "a temporary Miami Beach space — likely a nearby hotel."
2. **No long commutes.** Don't suggest parents drive 30+ minutes out of their metro. If we'd actually do that internally, it doesn't belong in parent-facing copy.
3. **Stay local.** The backup should keep kids in the same neighborhood/metro.
4. **One sentence on what we'd do**, one sentence on what we won't ask of them. That's enough.

## Anti-examples (real, since fixed)

> "Primary: 1021 Biarritz Dr targeting Aug 2026 (Phase 1 cap 167) with full 250 entitlement by Aug 2027 — pending CUP transfer from City of Miami Beach."

Problems: jargon (cap, entitlement, CUP), wrong number (167 vs. card's 80), wrong date (Aug 2027 vs. card's Jan 2027), mechanism over outcome.

> "If none of these land in time: commute to Miami, Boca, or Palm Beach, or temporary homeschool in a licensed hotel space in Miami Beach."

Problems: ridiculous commutes for a Miami Beach family, "homeschool in a hotel" reads as panic, three fallbacks suggest no plan.

## Quick checklist before saving

- [ ] No real-estate jargon
- [ ] Numbers + dates match `pp_locations_with_votes` overrides
- [ ] Primary site framed first; backup site framed as backup
- [ ] Likelihood signal is plain English ("more straightforward path") if relevant
- [ ] Backup plan keeps families in-metro
- [ ] Backup plan doesn't read as panic
- [ ] Read it out loud as if you were a parent — does it calm you or worry you?
