# Parent Feedback Redesign — Design Spec

**Date:** 2026-05-04
**Status:** Design — pending review

## Summary

Redesign the parent-facing experience around the **full real-estate pipeline** (not just LOI-signed sites), organized by the **strategic role** each site plays in our metro plan rather than by pipeline stage. Replace the broad "vote on this LOI-signed site" model with a layered system: a **per-metro Plan of Record**, a **category-organized site list** (Parent / AI / Short-term + Candidates pool), an **ad-hoc problem board** parents claim ownership of, and **stage-aware detail views** that adapt to where each site is in the lifecycle.

The redesign is governed by the principles in `docs/principles.md`. Most important: parents have 10x our local capability and should be empowered to *own* concrete real-estate problems (zoning, permits, lease review) — not just submit information.

## Goals

- Show parents the entire real-estate journey, not just the slice we're soliciting binding votes on
- Surface concrete, ownable real-estate work to parents (CUP applications, zoning hearings, permit liaison, lease review, etc.)
- Frame the metro plan as a coherent strategy with explicit "what would change this" pivot conditions
- Make parent-submitted and parent-championed sites first-class in the navigation
- Keep V1 buildable entirely PP-side without blocking on REBL data-model changes

## Non-goals

- Recruitment, enrollment, or family referrals — those live in another part of the site, deliberately out of scope here
- Changing how REBL discovers or scores sites
- Replacing the existing scoring algorithm or thresholds
- Rebuilding the suggest-a-site flow (small simplifications only)

## Principles

See `docs/principles.md` for the full list. The seven principles in summary:

1. Community Site
2. Parents have 10x the capability and knowledge
3. Inspire confidence, not uncertainty and fear
4. Empowered with actionable, impactful things to do (ownership > information)
5. Educate them (especially on why specific sites don't work out)
6. Show the full pipeline
7. Certainty in the destination, flexibility in the path

Every design decision in this spec is downstream of these principles. When in doubt, test against the list.

## Information Model

### Pipeline Stages (per site)

Each site is in exactly one stage at any given time:

| Stage | Definition | Typical count per metro |
|---|---|---|
| **Scored** | REBL has scored the site; no landlord engagement yet | Hundreds–thousands |
| **Engaged** | REBL is in active landlord conversation (`leasing IN ('turn_1','turn_2','turn_3','ready')`) | 3–5 |
| **Committed** | LOI signed; arc continues through Lease → Zoning → Permits → Buildout → CO → Opening | 1–2 |

Within Committed, sites progress through **six sub-milestones**: LOI / Lease / Zoning / Permits / Buildout / CO. Stage stays "Committed" the entire time; sub-milestones are the granular status.

A fourth implicit state is **Moved On** — sites that died at any stage, retained for context and education.

### Site Categories (per site)

Each site carries one display category:

| Category | Definition |
|---|---|
| **AI** | AI-sourced, no parent champion |
| **Parent** | Has at least one active parent champion (regardless of whether origin was AI or parent-submitted) |
| **Short-term** | Bridging site, time-bounded — chosen for speed, not long-term fit |

Origin is preserved as immutable metadata (`AI_sourced` / `parent_submitted`) and surfaced as a sub-detail on the site card (e.g., *"submitted by Sarah K."* or *"adopted by Sarah K."*) but does not change the badge.

### Championship

Parents can become champions of a site through one of two paths:

1. **Submit a new site** — submission is treated as the act of saying "I'll drive this." Submitter is auto-champion.
2. **Adopt an existing AI site** — explicit "champion this" action on a scored or engaged AI site. Moves the site's display category from AI to Parent.

Championship implies commitment beyond a like or comment:

- Champions are notified about every problem, decision, and status change on their site
- Champions are listed publicly: *"Championed by Sarah K. + 8 families"*
- A primary champion can pass the role to another parent
- If primary champion drops without a successor, the site reverts to category = AI (or remains parent-submitted with no active champion → drops back to standard candidate)

A submission UI must make this commitment explicit: *"By submitting, you're saying you'll help drive this. We'll loop you in on every problem and decision. You can hand it off later."*

### Plan of Record (per metro)

A short narrative paragraph plus a list of pivot conditions, displayed at the top of every metro home view. Example:

> *"We're launching at **Bridge Coworking** (~2 months) while we build out **401 Congress** for Aug 2026. Long-term watch: **1234 Lamar** — parent site, blocked on zoning."*
>
> *What would change this:*
> - *Zoning approved at 1234 Lamar → pivot to parent site for fall 2027*
> - *Major snag at 401 Congress → engage backup AI site*

The narrative is assembled from per-metro role assignments captured in `pp_plan_of_record.narrative_template_inputs` (which site is primary long-term, which is the bridge, which are watch-only) plus champion attribution. For V1 the narrative may be hand-curated per metro; later it can be templated from structured data.

Pivot conditions in the Plan of Record map directly to entries on the **Open Problems** board. Solving a pivot-trigger problem is the highest-leverage action a parent can take, and we mark it as such.

### Open Problems Board

When the leasing team hits a real obstacle on a site, it's posted to the parent community as a **concrete, time-bounded problem**:

- "Attend zoning hearing for 1234 Lamar on June 15 and present our case"
- "Real estate attorney needed to review Bridge Coworking lease"
- "Permit submission for 401 Congress — handle filings with City of Austin"

A problem has:

- A title (concrete action) and short description
- A deadline or expected window (where applicable)
- An owner (one — claimed by a parent)
- A status (Open / In Progress / Resolved / Unresolvable)
- An optional `pivot_trigger` flag — solving the problem changes the metro Plan of Record

Problems are **not predefined roles**. They emerge from real obstacles, get claimed once, and close when resolved. This is intentionally an open-source-issues model, not a job-description model.

### Moved-On Sites

When a site dies, it transitions to Moved On (not deleted). Each Moved On site shows:

- The site name and category
- Plain-English explanation of what we hit (zoning impossible, owner withdrew, building unfit, etc.)
- A forward link: *"We're moving forward with [next site]."*
- Acknowledgment of the submitter/champion if applicable: *"Mike — appreciated the suggestion, shifting focus to 1234 Lamar."*

Moved On is principle 5 (educate) + principle 7 (certainty in the destination) made explicit. Frequency-decayed display in the panel — collapsed behind a "Recently moved on (N)" link by default.

## UX Design

### Per-metro home view (panel)

Top-to-bottom:

1. **Header** — metro name
2. **Plan of Record** — tinted block with the narrative paragraph + embedded "Help us" action items (the Open Problems associated with pivot triggers and immediate asks)
3. **Site list, organized by category:**
   - **Parent** block (championed sites, all stages)
   - **AI** block (engaged + committed AI sites — *not* the scored candidates pool)
   - **Short-term** block (bridges)
4. **Candidates pool access** — quiet link near the bottom: *"Candidates · 1,247 scored sites · Browse + like →"*
5. **Footer** — funnel stat (*"From 1,247 scored, we engaged 3 and committed 1"*), Moved On link, Suggest-a-site link

Stage is a **status badge** on each site card (e.g., `ENGAGED` pill in orange, `COMMITTED` pill in green), not a navigation tab.

#### Why category-primary, not stage-primary

The pipeline strip we initially designed (Scored / Engaged / Committed tabs) was rejected because:

- Plan of Record is already category-driven; matching the navigation reinforces the mental model
- "The parent site" / "the bridge" is how parents think; "the engaged site" is back-office language
- Stage skews heavily toward Scored (one tab with thousands, another with 1–2)

### Map encoding

The map shows all sites simultaneously with stage and category encoded visually:

| Element | Visual |
|---|---|
| Scored | Small dots, blue |
| Engaged | Medium markers + label, color = category (AI blue / Parent green / Short-term amber) |
| Committed | Large halo + bold label, distinct treatment |
| Moved On | Faded or hidden by default |
| User location | Black pin |

When a user opens a site detail view, the map zooms to that site, draws its drive-time isochrone (already implemented), and de-emphasizes other markers.

### Site detail view (tier-specific sections)

Shared structure across all sites:

- Hero image with street view / map toggle (existing)
- Title + category badge + stage badge + champion attribution (where applicable)
- Origin sub-detail (*"Submitted by Sarah K."* / *"Adopted by Sarah K."*)
- Score breakdown (existing — what we like / what's missing)
- Light asks: "I'd love this" / "Add intel"
- Champions section (avatar row + count)

The section that differs by stage:

| Stage | Tier-specific section |
|---|---|
| **Scored** | Just the shared sections — light browsing experience |
| **Engaged** | Open problems for this site (highlighted with `★ HIGH-LEVERAGE PROBLEM` callout if pivot-linked), champion card, intel feed |
| **Committed** | Full LOI → Lease → Zoning → Permits → Buildout → CO timeline with milestone status; open problems; construction progress photos when available |
| **Moved On** | Faded visual treatment, prominent "What we hit" explainer, forward link to next site we're pursuing in that area |

### Mobile

The map is hidden on mobile (existing behavior). On mobile, the panel is full-width and the experience is the same scrolling vertical layout. Detail view becomes full-screen with photo carousel.

### Suggest-a-site flow

Existing flow stays mostly intact (school type tabs + simplified address/details/zoning form). One addition: an explicit championship affirmation before submit — *"By submitting, you're saying you'll help drive this. We'll loop you in. You can hand off later."*

### Submission decline path

A parent who wants to share a tip without committing to championship can use a separate "Tell us about a place" lightweight intel form (no auto-championship). Alternative: parent can submit normally and immediately drop the champion role. Either works; pick the simpler implementation.

## Data Model

### V1 — entirely PP-side, no REBL changes required

**New tables:**

- `pp_site_champions`
  - `id`, `site_id` (→ `pp_locations`), `user_id` (→ auth.users), `role` (`lead` | `supporter`), `claimed_at`, `passed_at` nullable, `passed_to_user_id` nullable
  - Index on `(site_id, role)` and `(user_id)`
  - Constraint: at most one active `lead` per site

- `pp_site_problems`
  - `id`, `site_id` (nullable for cross-site/metro problems), `metro` (denormalized for filtering), `title`, `description`, `deadline` nullable, `pivot_trigger` boolean default false, `status` (`open` | `in_progress` | `resolved` | `unresolvable`), `outcome_text` nullable, `created_at`, `closed_at` nullable

- `pp_problem_owners`
  - `id`, `problem_id` (→ `pp_site_problems`), `user_id`, `claimed_at`, `released_at` nullable
  - Constraint: at most one active owner per problem

- `pp_problem_updates`
  - `id`, `problem_id`, `user_id`, `body`, `created_at`
  - Public status updates from owner → community

- `pp_plan_of_record`
  - `metro` (PK), `narrative_template_inputs` (jsonb: site role assignments, primary/bridge/watch IDs), `pivot_conditions` (jsonb array of `{trigger_problem_id, new_role_assignment, description}`), `last_curated_at`, `narrative_override` text nullable (for V1 hand-curated narratives)

**New column:**

- `pp_locations.is_bridge` — boolean, default false. Set manually by admin until REBL provides `site_kind`. Drives the Short-term display category.

**Plan-of-record positioning** (which site is the primary long-term target, which is the bridge, which are watch) is captured in `pp_plan_of_record.narrative_template_inputs` per metro, not as per-site columns. Keeps positioning a metro-level decision and avoids ambiguity if a site is referenced in multiple metros' plans.

**Display category** is derived (no stored column needed):
- `is_bridge=true` → Short-term
- Else has any active champion in `pp_site_champions` → Parent
- Else → AI

**Existing fields used:**

- `pp_locations.suggested_by` — parent-submitted origin (immutable metadata; informs sub-detail copy *"submitted by"* vs *"adopted by"*)
- `pp_votes` (existing) — re-labeled as "likes" in the new UI but the schema and counts are unchanged
- `rebl3_status.leasing` — drives Engaged stage detection
- `rebl3_status.loi` — drives Committed stage detection
- `rebl3_status.details` (jsonb) — parsed for sub-stage milestones (Lease executed, Zoning approved, Permits submitted, etc.) and move-on reasons. Tolerant parser: missing fields render as "in progress" / "reason unknown."

### V2 — REBL ask (formalize what we're parsing today)

In rough priority:

1. **`rebl3_sites.site_kind`** enum (`long_term` | `bridge` | `other`) — replaces `pp_locations.is_bridge` for short-term detection
2. **Structured move-on reason** on `rebl3_status` when `leasing=cut` or deal dies — typed enum (`zoning_blocked`, `owner_withdrew`, `building_unfit`, `pricing_failed`, `process_exception`, `other`) + free-text note
3. **Sub-stage milestone fields** on `rebl3_status` (or per-site on `rebl3_sites`):
   - `lease_executed_at`, `zoning_status` enum + `zoning_approved_at`, `permits_submitted_at`, `permits_approved_at`, `buildout_started_at`, `buildout_complete_at`, `co_received_at`, `target_opening_date`
4. **(Lower priority, derivable)** Plan-of-record assembly signal — explicit per-metro `primary_long_term_site_id` etc.
5. **(Lowest priority)** Pivot conditions structured — could stay PP-side indefinitely

V2 swaps PP's parsing layer for REBL's structured fields with no UX change.

## Phased Rollout

### Phase 1 — Foundation (MVP of redesign)

- New tables (`pp_site_champions`, `pp_site_problems`, `pp_problem_owners`, `pp_problem_updates`, `pp_plan_of_record`) + `pp_locations.is_bridge` column
- Per-metro home view with category-primary panel layout
- Plan of Record block (hand-curated per metro)
- Open Problems board + ownership claim flow
- Champion claim/adopt flow on AI sites
- Tier-specific detail view sections (Scored / Engaged / Committed / Moved On)
- Map encoding by stage + category
- Parser layer over `rebl3_status.details` for sub-stage milestones (best-effort)
- Existing scored-site browsing remains as the Candidates pool
- Email notifications on problem claims, problem resolutions, champion updates

### Phase 2 — Structure (after REBL adds fields)

- Replace parser layer with direct REBL field reads
- Auto-generate Plan of Record narratives from structured data (template-driven)
- Drop manual `pp_locations.is_bridge` override in favor of REBL `site_kind`
- Structured Moved On reason categories

### Phase 3 — Refinement (post-launch)

- Champion-roster gamification (stewardship streaks, "you helped us close this site" recognition)
- Cross-metro champion mobility
- Inline status updates from owners visible to all watchers
- Move-on retention policy (auto-archive after N days)

## Open Questions

- **Submission with no commitment.** Do we offer a "share intel without championing" path, or force every submission to imply commitment with an immediate-drop fallback? Lean toward force-with-drop for V1 (simpler).
- **Champion handoff UX.** When a champion drops, do they nominate a successor, or does the site go open-listing for a community claim? Likely: any current supporter can claim lead; if none, site reverts.
- **Multi-champion governance.** When there are 9 supporters and 1 lead, how do disputes get resolved? Probably non-issue at our scale — defer.
- **Problem board scope creep.** What stops parents from filing arbitrary problems ("the playground design is bad")? Need a curation step — likely problems are admin-posted (we surface obstacles) and parents only claim, not file. Open question for V1.
- **Candidates browse experience.** Should the Candidates pool have its own search/filter UI, or stay as today's existing scored browser? Likely keep existing for V1 — the redesign sits above the Candidates pool.

## Glossary

- **Stage** — Where in the real-estate pipeline a site is (Scored / Engaged / Committed / Moved On).
- **Category** — The strategic role a site plays in the metro plan (Parent / AI / Short-term).
- **Champion** — A parent who has explicitly committed to drive a site forward.
- **Plan of Record** — The per-metro narrative of what we're launching with, what we're building toward, and what would change the plan.
- **Pivot Condition** — An explicit "if X happens, the plan changes to Y" statement, tied to a problem on the board.
- **Problem** — A concrete, time-bounded real-estate obstacle a parent can claim ownership of.
- **Candidates** — The full pool of scored sites we're considering but haven't engaged with. Mostly AI-sourced; includes parent-submitted sites without an active champion.
- **Moved On** — A site that died at any stage, retained with explanation for educational and trust-building purposes.

## References

- `docs/principles.md` — the seven principles
- `docs/brainlift-location-selection.md` — Alpha's location strategy and the 10x parent thesis
- `docs/pp-rebl3-integration.md` — how PP currently reads REBL data
- `docs/schema-design.md` — current PP schema
