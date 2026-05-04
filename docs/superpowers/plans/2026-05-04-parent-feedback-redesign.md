# Parent Feedback Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the V1 redesigned parent-facing experience defined in `docs/superpowers/specs/2026-05-04-parent-feedback-redesign-design.md` — full-pipeline visibility (Scored / Engaged / Committed), category-primary panel layout (Parent / AI / Short-term + Candidates), per-metro Plan of Record narrative with pivot conditions, ad-hoc Open Problems board with parent ownership, championship adoption flow, tier-specific detail views, and stage/category-encoded map markers.

**Architecture:** PP-side V1. Five new tables under existing `pp_*` namespace plus one new column on `pp_locations`. Stage and category derived from existing REBL fields (`rebl3_status.leasing` / `loi`) plus best-effort parsing of `rebl3_status.details` JSONB. AltPanel restructured into category-organized sections; LocationDetailView gets tier-specific bottom sections. New API routes follow the existing admin-route pattern (auth → query → update → email → audit). Vitest added to the toolchain for unit-testing the new derivation library; existing Playwright E2E tests extended for user-facing flows.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5 · Supabase Postgres + RLS · Zustand 5 · Mapbox GL 3 · Resend · Playwright (E2E) · Vitest (added)

**Spec reference:** `docs/superpowers/specs/2026-05-04-parent-feedback-redesign-design.md`
**Principles reference:** `docs/principles.md`

---

## File Structure

### New files

**SQL migrations** (`sql/`):
- `2026-05-04-parent-feedback-redesign.sql` — all schema additions

**TypeScript libraries** (`src/lib/sites/`):
- `src/lib/sites/stage.ts` — `getStage()` derivation from REBL fields
- `src/lib/sites/category.ts` — `getCategory()` derivation
- `src/lib/sites/parser.ts` — parse `rebl3_status.details` for milestones / move-on reason
- `src/lib/sites/index.ts` — barrel exports

**API routes** (`src/app/api/`):
- `src/app/api/sites/[id]/champion/route.ts` — POST (claim), DELETE (release)
- `src/app/api/sites/[id]/problems/route.ts` — GET (list)
- `src/app/api/problems/route.ts` — GET (metro-wide list)
- `src/app/api/problems/[id]/claim/route.ts` — POST (claim), DELETE (release)
- `src/app/api/problems/[id]/updates/route.ts` — POST (add status update)
- `src/app/api/admin/problems/route.ts` — POST (create)
- `src/app/api/admin/problems/[id]/route.ts` — PATCH (edit), DELETE (close)
- `src/app/api/admin/sites/[id]/bridge/route.ts` — PATCH (toggle is_bridge)
- `src/app/api/metro/[metro]/plan/route.ts` — GET
- `src/app/api/admin/metro/[metro]/plan/route.ts` — PUT (curate)

**React components** (`src/components/`):
- `src/components/PlanOfRecord.tsx` — narrative + pivot conditions block
- `src/components/CategorySection.tsx` — Parent/AI/Short-term grouping wrapper
- `src/components/StageBadge.tsx` — small status pill
- `src/components/ProblemCard.tsx` — single problem with claim/owned states
- `src/components/ProblemList.tsx` — open problems for a site or metro
- `src/components/ChampionButton.tsx` — "Champion this site" CTA + state
- `src/components/MovedOnSection.tsx` — collapsed link + expansion
- `src/components/StageTimeline.tsx` — LOI → Lease → Zoning → Permits → Buildout → CO progress
- `src/components/admin/ProblemAdmin.tsx` — admin posting/editing UI
- `src/components/admin/PlanAdmin.tsx` — admin curation UI

**Tests:**
- `src/lib/sites/stage.test.ts` — Vitest unit tests
- `src/lib/sites/category.test.ts`
- `src/lib/sites/parser.test.ts`
- `tests/redesign.test.py` — Playwright E2E for new flows

**Documentation:**
- Update `requirements.md` with new requirements + test cases (Phase 0)
- Update `feedback.md` if any user-feedback root causes apply

### Modified files

- `src/types/index.ts` — add SiteChampion, SiteProblem, ProblemOwner, ProblemUpdate, PlanOfRecord, MetroPlan types; extend Location with `is_bridge`, derived `stage`, derived `category`
- `src/lib/votes.ts` — extend Zustand store with champion/problem/plan state and actions
- `src/lib/email.ts` — add `generateProblemClaimedHtml()`, `generateProblemResolvedHtml()`, `generateChampionUpdateHtml()`
- `src/components/AltPanel.tsx` — replace existing layout with Plan of Record + category sections + Candidates link + footer
- `src/components/AltLocationCard.tsx` — add StageBadge, champion attribution, simplified for category-section context
- `src/components/LocationDetailView.tsx` — wire tier-specific sections (problems, timeline, champions, moved-on explainer)
- `src/components/MapView.tsx` — update marker encoding to stage size + category color
- `src/app/admin/page.tsx` — add Problems tab, Plan of Record tab
- `src/app/api/locations/route.ts` — include derived stage/category in response
- `package.json` — add `vitest`, `@testing-library/react` (if needed), test script
- `vitest.config.ts` — new (Phase 0)

---

## Phase 0: Setup

### Task 0.1: Create worktree (execution-time only)

**Files:** none (worktree creation)

- [ ] **Step 1:** Invoke superpowers:using-git-worktrees skill or run:

```bash
cd /Users/aprice/AIFirst/parent_picker
git worktree add ../parent_picker-redesign -b feature/parent-feedback-redesign
cd ../parent_picker-redesign
```

- [ ] **Step 2:** Verify worktree

```bash
git worktree list
git branch --show-current  # → feature/parent-feedback-redesign
```

- [ ] **Step 3:** Copy `.env.local` from main checkout (it's gitignored)

```bash
cp ../parent_picker/.env.local .
```

- [ ] **Step 4:** Install deps in the worktree

```bash
npm install
```

### Task 0.2: Update requirements.md with new requirements

**Files:**
- Modify: `requirements.md` (append new section)

- [ ] **Step 1:** Read `requirements.md` to understand the existing structure

- [ ] **Step 2:** Append new requirement sections covering each major area of the redesign:

```markdown
## R-CHAMPIONS — Site Championship

### R-CHAMPIONS-001 — A parent can claim champion of an AI site
Given a parent is signed in and a site has category=AI, when the parent clicks "Champion this site," then their user_id is written to pp_site_champions, the site's display category becomes Parent, and the parent appears in the Champions section.

### R-CHAMPIONS-002 — A parent who submits a site is auto-champion
Given a parent submits a new site through SuggestLocationModal, when the submission is accepted, then a pp_site_champions row is auto-created with role='lead' for the submitter.

### R-CHAMPIONS-003 — Champion can release the role
Given a parent has lead-championed a site, when they click "Pass the torch," then their role is marked released and the next supporter (if any) is promoted to lead, else the site reverts to category AI (or remains parent-submitted with no active champion).

## R-PROBLEMS — Open Problems Board

### R-PROBLEMS-001 — Admin can post a problem on a site
Given an admin is signed in, when they post a problem with title, description, optional deadline, and optional pivot_trigger flag, then the problem appears on the site's detail view and (if pivot_trigger) on the metro Plan of Record's "What would change this" list.

### R-PROBLEMS-002 — A parent can claim ownership of an unclaimed problem
Given a parent is signed in and a problem is open + unclaimed, when they click "Sign up to own," then they're recorded as the active owner, the problem flips to "in_progress," and other parents see the owner attribution.

### R-PROBLEMS-003 — Owner can post status updates
Given a parent owns a problem, when they post an update, the update is visible to all viewers and the "updated N ago" timestamp refreshes.

### R-PROBLEMS-004 — Admin can resolve or mark unresolvable
Given an admin is signed in, when they resolve a problem with an outcome, the problem closes; if marked unresolvable AND the site dies, the site moves to Moved On with the problem as the explanation.

## R-PLAN — Per-Metro Plan of Record

### R-PLAN-001 — Each metro has a Plan of Record
Given a parent visits a metro, when the panel loads, then the Plan of Record narrative paragraph is shown at the top with the metro's primary long-term, bridge (if any), and watch sites named.

### R-PLAN-002 — Pivot conditions visible
Given the Plan of Record exists, the "What would change this" list renders the metro's pivot conditions, each linked to a specific problem on the board.

### R-PLAN-003 — Admin can curate the plan
Given an admin is signed in, when they edit a metro's plan via /admin, they can set: which site is primary long-term, which is bridge, which are watch, the narrative override (optional), and the pivot conditions list.

## R-LAYOUT — Category-Primary Panel

### R-LAYOUT-001 — Parents block at top
Given a metro has parent-championed sites, the Parent block renders first under the Plan of Record.

### R-LAYOUT-002 — AI block lists engaged + committed AI sites
Given a metro has engaged or committed AI sites without champions, they list under the AI block (not in Candidates).

### R-LAYOUT-003 — Short-term block when bridge present
Given a metro has a site with is_bridge=true, the Short-term block renders.

### R-LAYOUT-004 — Candidates link at bottom
Given a metro has scored sites, a "Candidates · N scored sites · Browse + like" link appears at the bottom and routes to the existing scored browser.

### R-LAYOUT-005 — Stage as a status badge
Each site card shows the current stage (Scored / Engaged / Committed) as a small pill, color-coded.

### R-LAYOUT-006 — Footer funnel stat
Given any metro, the footer shows "From N scored, we engaged X and committed Y" + Moved On link + Suggest a site link.

## R-DETAIL — Tier-specific Detail View

### R-DETAIL-001 — Engaged sites show Open Problems with pivot-trigger callout
Given a parent opens an Engaged site detail view, the Open Problems for that site render below the title block, with pivot-trigger problems flagged "★ HIGH-LEVERAGE PROBLEM."

### R-DETAIL-002 — Committed sites show LOI→CO timeline
Given a parent opens a Committed site detail view, a horizontal stage timeline renders (LOI → Lease → Zoning → Permits → Buildout → CO) with the current sub-stage highlighted.

### R-DETAIL-003 — Moved On sites show "what we hit" explainer
Given a parent opens a Moved On site detail view, a prominent block explains what we hit and links forward to the site we're now pursuing.

## R-MAP — Stage + Category Encoding

### R-MAP-001 — Stage drives marker size
Scored sites = small dot, Engaged = medium marker, Committed = large with halo.

### R-MAP-002 — Category drives marker color
AI = blue, Parent = green, Short-term = amber.

### R-MAP-003 — Moved-On sites faded or hidden
By default Moved-On sites are hidden from the map; an admin toggle reveals them as faded markers.
```

- [ ] **Step 3:** Commit the requirements update.

```bash
git add requirements.md
git commit -m "docs: add requirements for parent feedback redesign"
```

### Task 0.3: Add Vitest for unit testing

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1:** Install Vitest + Testing Library

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2:** Create `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 3:** Add scripts to `package.json` (alongside existing scripts):

```json
"test:unit": "vitest run",
"test:unit:watch": "vitest"
```

- [ ] **Step 4:** Sanity check — write a no-op test and run it

Create `src/lib/sanity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
describe('sanity', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

Run: `npm run test:unit`
Expected: `1 passed`

- [ ] **Step 5:** Delete the sanity test, commit

```bash
rm src/lib/sanity.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit testing"
```

---

## Phase 1: Database Foundation

### Task 1.1: Author the migration SQL

**Files:**
- Create: `sql/2026-05-04-parent-feedback-redesign.sql`

- [ ] **Step 1:** Write the migration

```sql
-- 2026-05-04 Parent Feedback Redesign — Phase 1 schema
-- Spec: docs/superpowers/specs/2026-05-04-parent-feedback-redesign-design.md

-- 1. Bridge flag on pp_locations
ALTER TABLE pp_locations
  ADD COLUMN IF NOT EXISTS is_bridge boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pp_locations_is_bridge ON pp_locations(is_bridge) WHERE is_bridge = true;

-- 2. pp_site_champions
CREATE TABLE IF NOT EXISTS pp_site_champions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES pp_locations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('lead','supporter')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  passed_to_user_id uuid REFERENCES auth.users(id),
  UNIQUE (site_id, user_id, claimed_at)
);
CREATE INDEX idx_pp_site_champions_site ON pp_site_champions(site_id) WHERE released_at IS NULL;
CREATE INDEX idx_pp_site_champions_user ON pp_site_champions(user_id) WHERE released_at IS NULL;

-- Partial unique: only one active lead per site
CREATE UNIQUE INDEX idx_pp_site_champions_one_active_lead
  ON pp_site_champions(site_id)
  WHERE role = 'lead' AND released_at IS NULL;

ALTER TABLE pp_site_champions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read champions" ON pp_site_champions
  FOR SELECT USING (true);
CREATE POLICY "users can insert their own championship" ON pp_site_champions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users can update their own championship" ON pp_site_champions
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. pp_site_problems
CREATE TABLE IF NOT EXISTS pp_site_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES pp_locations(id) ON DELETE CASCADE,
  metro text NOT NULL,
  title text NOT NULL,
  description text,
  deadline date,
  pivot_trigger boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','unresolvable')),
  outcome_text text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX idx_pp_site_problems_site ON pp_site_problems(site_id) WHERE status IN ('open','in_progress');
CREATE INDEX idx_pp_site_problems_metro ON pp_site_problems(metro) WHERE status IN ('open','in_progress');
CREATE INDEX idx_pp_site_problems_pivot ON pp_site_problems(metro) WHERE pivot_trigger = true AND status IN ('open','in_progress');

ALTER TABLE pp_site_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read problems" ON pp_site_problems
  FOR SELECT USING (true);
-- INSERT/UPDATE only via service role (admin routes); no row-level write policy

-- 4. pp_problem_owners
CREATE TABLE IF NOT EXISTS pp_problem_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES pp_site_problems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
CREATE UNIQUE INDEX idx_pp_problem_owners_one_active
  ON pp_problem_owners(problem_id)
  WHERE released_at IS NULL;
CREATE INDEX idx_pp_problem_owners_user ON pp_problem_owners(user_id) WHERE released_at IS NULL;

ALTER TABLE pp_problem_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read owners" ON pp_problem_owners
  FOR SELECT USING (true);
CREATE POLICY "users can claim ownership" ON pp_problem_owners
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users can release their own ownership" ON pp_problem_owners
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. pp_problem_updates
CREATE TABLE IF NOT EXISTS pp_problem_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES pp_site_problems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pp_problem_updates_problem ON pp_problem_updates(problem_id, created_at DESC);

ALTER TABLE pp_problem_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read updates" ON pp_problem_updates
  FOR SELECT USING (true);
CREATE POLICY "users can post their own updates" ON pp_problem_updates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. pp_plan_of_record
CREATE TABLE IF NOT EXISTS pp_plan_of_record (
  metro text PRIMARY KEY,
  narrative_template_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  pivot_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  narrative_override text,
  last_curated_at timestamptz NOT NULL DEFAULT now(),
  last_curated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE pp_plan_of_record ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read plan" ON pp_plan_of_record
  FOR SELECT USING (true);
-- INSERT/UPDATE only via service role (admin routes)
```

- [ ] **Step 2:** Read the SQL once to verify FKs and indices look right.

### Task 1.2: Apply migration to Supabase

**Files:** none (DB only)

- [ ] **Step 1:** Apply via Supabase MCP `mcp__supabase__execute_sql` against project `qvinpcymcbadrgnwacuf`. Paste the entire migration content. Confirm 0 errors.

- [ ] **Step 2:** Verify tables exist:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'pp_%' ORDER BY 1;
```

Expected to include: `pp_site_champions`, `pp_site_problems`, `pp_problem_owners`, `pp_problem_updates`, `pp_plan_of_record`.

- [ ] **Step 3:** Verify `is_bridge` column:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='pp_locations' AND column_name='is_bridge';
```

### Task 1.3: Add TypeScript types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1:** Read existing `src/types/index.ts` to understand the established style.

- [ ] **Step 2:** Add the new types at the bottom of the file:

```typescript
// === Parent Feedback Redesign types ===

export type SiteStage = 'scored' | 'engaged' | 'committed' | 'moved_on';
export type SiteCategory = 'parent' | 'ai' | 'short_term';
export type CommittedSubStage = 'loi' | 'lease' | 'zoning' | 'permits' | 'buildout' | 'co';
export type ProblemStatus = 'open' | 'in_progress' | 'resolved' | 'unresolvable';
export type ChampionRole = 'lead' | 'supporter';

export interface SiteChampion {
  id: string;
  siteId: string;
  userId: string;
  role: ChampionRole;
  claimedAt: string;
  releasedAt: string | null;
  passedToUserId: string | null;
  // Joined display fields
  displayName?: string;
}

export interface SiteProblem {
  id: string;
  siteId: string | null;
  metro: string;
  title: string;
  description: string | null;
  deadline: string | null;
  pivotTrigger: boolean;
  status: ProblemStatus;
  outcomeText: string | null;
  createdAt: string;
  closedAt: string | null;
  // Derived
  owner?: ProblemOwner | null;
  updates?: ProblemUpdate[];
}

export interface ProblemOwner {
  id: string;
  problemId: string;
  userId: string;
  claimedAt: string;
  releasedAt: string | null;
  displayName?: string;
}

export interface ProblemUpdate {
  id: string;
  problemId: string;
  userId: string;
  body: string;
  createdAt: string;
  displayName?: string;
}

export interface PivotCondition {
  triggerProblemId: string;
  description: string;
  newRoleAssignment?: { siteId: string; role: 'primary_long_term' | 'bridge' | 'watch' };
}

export interface MetroPlan {
  metro: string;
  narrativeTemplateInputs: {
    primaryLongTermSiteId?: string;
    bridgeSiteId?: string;
    watchSiteIds?: string[];
  };
  pivotConditions: PivotCondition[];
  narrativeOverride: string | null;
  lastCuratedAt: string;
}

// Extend Location with derived fields (set client-side, not stored)
export interface LocationDerived {
  stage: SiteStage;
  category: SiteCategory;
  committedSubStage?: CommittedSubStage;
  movedOnReason?: string;
}
```

- [ ] **Step 3:** Locate the existing `Location` interface in `src/types/index.ts` and extend it:

```typescript
// In Location interface, add:
isBridge?: boolean;       // from pp_locations.is_bridge
champions?: SiteChampion[]; // populated when fetched
problems?: SiteProblem[];   // populated for detail view
derived?: LocationDerived;  // computed at fetch time
```

- [ ] **Step 4:** Commit

```bash
git add src/types/index.ts sql/2026-05-04-parent-feedback-redesign.sql
git commit -m "feat(db): add champion/problem/plan tables and is_bridge column"
```

---

## Phase 2: Stage/Category Derivation Library

### Task 2.1: Write tests for getStage()

**Files:**
- Create: `src/lib/sites/stage.test.ts`

- [ ] **Step 1:** Write the test file

```typescript
import { describe, it, expect } from 'vitest';
import { getStage } from './stage';

describe('getStage', () => {
  it('returns scored when no leasing or loi data', () => {
    expect(getStage({})).toBe('scored');
  });

  it('returns engaged when leasing is in active landlord conversation', () => {
    expect(getStage({ leasing: 'turn_1' })).toBe('engaged');
    expect(getStage({ leasing: 'turn_2' })).toBe('engaged');
    expect(getStage({ leasing: 'turn_3' })).toBe('engaged');
    expect(getStage({ leasing: 'ready' })).toBe('engaged');
  });

  it('returns committed when LOI is signed', () => {
    expect(getStage({ loi: 'signed' })).toBe('committed');
    expect(getStage({ loi: 'loi-signed' })).toBe('committed');
    expect(getStage({ loi: 'done' })).toBe('committed');
    expect(getStage({ loi: 'completed' })).toBe('committed');
  });

  it('returns moved_on when leasing is cut', () => {
    expect(getStage({ leasing: 'cut' })).toBe('moved_on');
  });

  it('returns moved_on when leasing is done with process_exception', () => {
    expect(getStage({ leasing: 'done', leasingDetails: { process_exception: true } })).toBe('moved_on');
  });

  it('committed takes precedence over engaged', () => {
    expect(getStage({ leasing: 'ready', loi: 'signed' })).toBe('committed');
  });

  it('moved_on takes precedence over committed when leasing is cut', () => {
    expect(getStage({ loi: 'signed', leasing: 'cut' })).toBe('moved_on');
  });
});
```

- [ ] **Step 2:** Run test, expect failure

```bash
npm run test:unit -- src/lib/sites/stage.test.ts
```
Expected: `Cannot find module './stage'`

### Task 2.2: Implement getStage()

**Files:**
- Create: `src/lib/sites/stage.ts`

- [ ] **Step 1:** Implement

```typescript
import type { SiteStage } from '@/types';

export interface StageInput {
  leasing?: string | null;
  loi?: string | null;
  leasingDetails?: { process_exception?: boolean; [k: string]: unknown };
}

const ENGAGED_LEASING = new Set(['turn_1', 'turn_2', 'turn_3', 'ready']);
const COMMITTED_LOI = new Set(['signed', 'loi-signed', 'done', 'completed']);
const MOVED_ON_LEASING = new Set(['cut']);

export function getStage(input: StageInput): SiteStage {
  // Moved On takes top priority — definitive end state
  if (input.leasing && MOVED_ON_LEASING.has(input.leasing)) return 'moved_on';
  if (input.leasing === 'done' && input.leasingDetails?.process_exception === true) {
    return 'moved_on';
  }

  // Committed (LOI signed) — survives past leasing transitioning
  if (input.loi && COMMITTED_LOI.has(input.loi)) return 'committed';

  // Engaged (active landlord conversation)
  if (input.leasing && ENGAGED_LEASING.has(input.leasing)) return 'engaged';

  // Default: Scored
  return 'scored';
}
```

- [ ] **Step 2:** Run test, expect pass

```bash
npm run test:unit -- src/lib/sites/stage.test.ts
```
Expected: All tests pass.

### Task 2.3: Write tests for getCategory()

**Files:**
- Create: `src/lib/sites/category.test.ts`

- [ ] **Step 1:** Write the test file

```typescript
import { describe, it, expect } from 'vitest';
import { getCategory } from './category';
import type { SiteChampion } from '@/types';

const champion = (overrides: Partial<SiteChampion> = {}): SiteChampion => ({
  id: 'c1',
  siteId: 's1',
  userId: 'u1',
  role: 'lead',
  claimedAt: new Date().toISOString(),
  releasedAt: null,
  passedToUserId: null,
  ...overrides,
});

describe('getCategory', () => {
  it('returns short_term when isBridge is true (highest priority)', () => {
    expect(getCategory({ isBridge: true, champions: [champion()] })).toBe('short_term');
  });

  it('returns parent when there is at least one active champion', () => {
    expect(getCategory({ isBridge: false, champions: [champion()] })).toBe('parent');
  });

  it('ignores released champions', () => {
    const released = champion({ releasedAt: new Date().toISOString() });
    expect(getCategory({ isBridge: false, champions: [released] })).toBe('ai');
  });

  it('returns ai when no active champion and not bridge', () => {
    expect(getCategory({ isBridge: false, champions: [] })).toBe('ai');
    expect(getCategory({ isBridge: false, champions: undefined })).toBe('ai');
  });
});
```

- [ ] **Step 2:** Run, expect fail.

### Task 2.4: Implement getCategory()

**Files:**
- Create: `src/lib/sites/category.ts`

- [ ] **Step 1:** Implement

```typescript
import type { SiteCategory, SiteChampion } from '@/types';

export interface CategoryInput {
  isBridge?: boolean;
  champions?: SiteChampion[];
}

export function getCategory(input: CategoryInput): SiteCategory {
  if (input.isBridge) return 'short_term';
  const hasActiveChampion = (input.champions ?? []).some(c => c.releasedAt === null);
  if (hasActiveChampion) return 'parent';
  return 'ai';
}
```

- [ ] **Step 2:** Run test, expect pass.

### Task 2.5: Write tests for parseRebl3Details()

**Files:**
- Create: `src/lib/sites/parser.test.ts`

- [ ] **Step 1:** Write the test file

```typescript
import { describe, it, expect } from 'vitest';
import { parseCommittedSubStage, parseMovedOnReason } from './parser';

describe('parseCommittedSubStage', () => {
  it('returns loi when only loi is set', () => {
    expect(parseCommittedSubStage({ loi: 'signed' })).toBe('loi');
  });

  it('returns lease when lease execution date is present', () => {
    expect(parseCommittedSubStage({
      loi: 'signed',
      leaseDetails: { lease_executed_at: '2026-04-01' }
    })).toBe('lease');
  });

  it('returns zoning when zoning approval is in progress', () => {
    expect(parseCommittedSubStage({
      loi: 'signed',
      leaseDetails: { lease_executed_at: '2026-04-01' },
      zoningStatus: 'pending'
    })).toBe('zoning');
  });

  it('returns permits when zoning is approved and permits submitted', () => {
    expect(parseCommittedSubStage({
      loi: 'signed',
      leaseDetails: { lease_executed_at: '2026-04-01' },
      zoningStatus: 'approved',
      permitsDetails: { submitted_at: '2026-05-01' },
    })).toBe('permits');
  });

  it('returns buildout when permits approved and buildout started', () => {
    expect(parseCommittedSubStage({
      loi: 'signed',
      leaseDetails: { lease_executed_at: '2026-04-01' },
      zoningStatus: 'approved',
      permitsDetails: { submitted_at: '2026-05-01', approved_at: '2026-05-15' },
      buildoutDetails: { started_at: '2026-06-01' },
    })).toBe('buildout');
  });

  it('returns co when CO received', () => {
    expect(parseCommittedSubStage({
      loi: 'signed',
      coReceivedAt: '2026-08-01',
    })).toBe('co');
  });
});

describe('parseMovedOnReason', () => {
  it('returns reason from process_exception details', () => {
    const reason = parseMovedOnReason({
      leasing: 'done',
      leasingDetails: { process_exception: true, exception_reason: 'lease-not-signed' },
    });
    expect(reason).toContain('lease-not-signed');
  });

  it('returns "Owner withdrew" when leasing=cut with owner_withdrew', () => {
    const reason = parseMovedOnReason({
      leasing: 'cut',
      leasingDetails: { reason: 'owner-withdrew' },
    });
    expect(reason).toMatch(/owner withdrew/i);
  });

  it('returns generic "Moved on" when leasing=cut without details', () => {
    const reason = parseMovedOnReason({ leasing: 'cut' });
    expect(reason).toMatch(/moved on/i);
  });

  it('returns null when not moved on', () => {
    expect(parseMovedOnReason({ leasing: 'turn_1' })).toBeNull();
  });
});
```

- [ ] **Step 2:** Run, expect fail.

### Task 2.6: Implement parseRebl3Details()

**Files:**
- Create: `src/lib/sites/parser.ts`

- [ ] **Step 1:** Implement

```typescript
import type { CommittedSubStage } from '@/types';

export interface ParserInput {
  loi?: string | null;
  leasing?: string | null;
  leasingDetails?: { process_exception?: boolean; reason?: string; exception_reason?: string; [k: string]: unknown };
  leaseDetails?: { lease_executed_at?: string; [k: string]: unknown };
  zoningStatus?: 'not_required' | 'pending' | 'approved' | 'denied' | string;
  zoningApprovedAt?: string;
  permitsDetails?: { submitted_at?: string; approved_at?: string; [k: string]: unknown };
  buildoutDetails?: { started_at?: string; complete_at?: string; [k: string]: unknown };
  coReceivedAt?: string;
}

export function parseCommittedSubStage(input: ParserInput): CommittedSubStage {
  if (input.coReceivedAt) return 'co';
  if (input.buildoutDetails?.started_at) return 'buildout';
  if (input.permitsDetails?.submitted_at) return 'permits';
  if (input.zoningStatus === 'pending') return 'zoning';
  if (input.zoningStatus === 'approved' && !input.permitsDetails?.submitted_at) {
    return 'zoning'; // approved but permits not yet submitted — still in zoning phase visually
  }
  if (input.leaseDetails?.lease_executed_at) return 'lease';
  return 'loi';
}

const MOVE_ON_REASON_LABELS: Record<string, string> = {
  'owner-withdrew': 'Owner withdrew',
  'zoning-blocked': 'Zoning blocked',
  'building-unfit': 'Building unfit',
  'pricing-failed': 'Pricing fell through',
  'lease-not-signed': 'Lease not signed',
};

export function parseMovedOnReason(input: ParserInput): string | null {
  if (input.leasing === 'done' && input.leasingDetails?.process_exception) {
    const code = input.leasingDetails.exception_reason ?? '';
    return MOVE_ON_REASON_LABELS[code] ?? `Process exception (${code || 'reason unknown'})`;
  }

  if (input.leasing === 'cut') {
    const code = input.leasingDetails?.reason ?? '';
    return MOVE_ON_REASON_LABELS[code] ?? 'Moved on';
  }

  return null;
}
```

- [ ] **Step 2:** Run tests, expect pass.

### Task 2.7: Barrel exports + commit

**Files:**
- Create: `src/lib/sites/index.ts`

- [ ] **Step 1:** Write barrel

```typescript
export { getStage, type StageInput } from './stage';
export { getCategory, type CategoryInput } from './category';
export { parseCommittedSubStage, parseMovedOnReason, type ParserInput } from './parser';
```

- [ ] **Step 2:** Run all unit tests:

```bash
npm run test:unit
```
Expected: all tests pass.

- [ ] **Step 3:** Commit

```bash
git add src/lib/sites/
git commit -m "feat(lib): add stage/category derivation and rebl3 details parser"
```

---

## Phase 3: Champion Feature

### Task 3.1: Champion API route

**Files:**
- Create: `src/app/api/sites/[id]/champion/route.ts`

- [ ] **Step 1:** Read an existing route (`src/app/api/admin/locations/[id]/approve/route.ts`) to confirm the auth + supabaseAdmin + response pattern.

- [ ] **Step 2:** Write the route

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function getUserFromAuth(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// POST → claim championship (lead if no active lead, else supporter)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: siteId } = await params;
  const user = await getUserFromAuth(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: "supabase unavailable" }, { status: 500 });

  // Already an active champion?
  const { data: existing } = await supabaseAdmin
    .from("pp_site_champions")
    .select("id, role")
    .eq("site_id", siteId)
    .eq("user_id", user.id)
    .is("released_at", null)
    .maybeSingle();
  if (existing) return NextResponse.json({ success: true, role: existing.role });

  // Is there an active lead already?
  const { data: lead } = await supabaseAdmin
    .from("pp_site_champions")
    .select("id")
    .eq("site_id", siteId)
    .eq("role", "lead")
    .is("released_at", null)
    .maybeSingle();

  const role: 'lead' | 'supporter' = lead ? 'supporter' : 'lead';

  const { error } = await supabaseAdmin
    .from("pp_site_champions")
    .insert({ site_id: siteId, user_id: user.id, role });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, role });
}

// DELETE → release championship
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: siteId } = await params;
  const user = await getUserFromAuth(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: "supabase unavailable" }, { status: 500 });

  const { data: existing } = await supabaseAdmin
    .from("pp_site_champions")
    .select("id, role")
    .eq("site_id", siteId)
    .eq("user_id", user.id)
    .is("released_at", null)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "not a champion" }, { status: 404 });

  const releasedAt = new Date().toISOString();
  await supabaseAdmin
    .from("pp_site_champions")
    .update({ released_at: releasedAt })
    .eq("id", existing.id);

  // If this was the lead, promote the longest-serving active supporter
  if (existing.role === "lead") {
    const { data: nextSupporter } = await supabaseAdmin
      .from("pp_site_champions")
      .select("id")
      .eq("site_id", siteId)
      .eq("role", "supporter")
      .is("released_at", null)
      .order("claimed_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextSupporter) {
      await supabaseAdmin
        .from("pp_site_champions")
        .update({ role: "lead" })
        .eq("id", nextSupporter.id);
    }
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3:** Smoke-test manually with curl (first sign in via the app to get a JWT, then `curl -X POST -H "Authorization: Bearer <jwt>" http://localhost:3000/api/sites/<id>/champion`). Verify in DB:

```sql
SELECT * FROM pp_site_champions WHERE site_id = '<id>';
```

### Task 3.2: Add champion data to /api/locations response

**Files:**
- Modify: `src/app/api/locations/route.ts`

- [ ] **Step 1:** Read the existing route to understand how it shapes responses.

- [ ] **Step 2:** Add a join to fetch active champions per location:

```typescript
// After fetching locations, fetch champions for those locations
const locationIds = locations.map(l => l.id);
const { data: championRows } = await supabaseAdmin
  .from("pp_site_champions")
  .select("id, site_id, user_id, role, claimed_at")
  .in("site_id", locationIds)
  .is("released_at", null);

// Group by site_id
const championsBySite: Record<string, SiteChampion[]> = {};
for (const c of championRows ?? []) {
  (championsBySite[c.site_id] ??= []).push({
    id: c.id, siteId: c.site_id, userId: c.user_id, role: c.role,
    claimedAt: c.claimed_at, releasedAt: null, passedToUserId: null,
  });
}

// Attach to each location:
for (const loc of locations) {
  loc.champions = championsBySite[loc.id] ?? [];
  loc.isBridge = (loc as any).is_bridge ?? false;
  loc.derived = {
    stage: getStage({ leasing: loc.leasing, loi: loc.loi }),
    category: getCategory({ isBridge: loc.isBridge, champions: loc.champions }),
  };
}
```

- [ ] **Step 3:** Verify response shape via curl on a known site_id.

### Task 3.3: ChampionButton component

**Files:**
- Create: `src/components/ChampionButton.tsx`

- [ ] **Step 1:** Implement

```typescript
'use client';

import { useState } from 'react';
import type { Location } from '@/types';
import { useVoteStore } from '@/lib/votes';

interface Props {
  location: Location;
}

export function ChampionButton({ location }: Props) {
  const { isAuthenticated, currentUserId, refreshChampions } = useVoteStore();
  const [busy, setBusy] = useState(false);

  const myActiveChamp = (location.champions ?? []).find(
    c => c.userId === currentUserId && !c.releasedAt
  );

  async function claim() {
    setBusy(true);
    try {
      const supabase = (await import('@/lib/supabase')).getSupabase();
      const { data: { session } } = (await supabase!.auth.getSession());
      if (!session) return;
      await fetch(`/api/sites/${location.id}/champion`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      await refreshChampions(location.id);
    } finally { setBusy(false); }
  }

  async function release() {
    setBusy(true);
    try {
      const supabase = (await import('@/lib/supabase')).getSupabase();
      const { data: { session } } = (await supabase!.auth.getSession());
      if (!session) return;
      await fetch(`/api/sites/${location.id}/champion`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      await refreshChampions(location.id);
    } finally { setBusy(false); }
  }

  if (!isAuthenticated) return null;

  if (myActiveChamp) {
    return (
      <button
        onClick={release}
        disabled={busy}
        className="text-xs text-stone-500 underline"
      >
        {myActiveChamp.role === 'lead' ? "★ I'm leading this — pass the torch" : "★ I'm supporting — step back"}
      </button>
    );
  }

  return (
    <button
      onClick={claim}
      disabled={busy}
      className="text-xs px-3 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold hover:bg-emerald-200"
    >
      ★ Champion this site
    </button>
  );
}
```

- [ ] **Step 2:** Add `refreshChampions` action to Zustand store (`src/lib/votes.ts`):

```typescript
// In store interface
refreshChampions: (siteId: string) => Promise<void>;

// In store implementation
refreshChampions: async (siteId: string) => {
  const res = await fetch(`/api/locations/${siteId}/champions`);
  if (!res.ok) return;
  const champions = await res.json();
  set(state => ({
    locations: state.locations.map(l =>
      l.id === siteId
        ? { ...l, champions, derived: { ...l.derived!, category: getCategory({ isBridge: l.isBridge, champions }) } }
        : l
    ),
  }));
},
```

(Also add a small route at `src/app/api/locations/[id]/champions/route.ts` returning the champions array — pattern matches `/api/sites/[id]/champion` but read-only and accepts no auth. Or merge into the existing `/api/locations/[id]` route if one exists.)

- [ ] **Step 3:** Wire `<ChampionButton location={location} />` into `LocationDetailView.tsx` near the top of the body, beneath the title block. Behind a sign-in gate (existing pattern in the file).

### Task 3.4: E2E test for champion flow

**Files:**
- Create: `tests/redesign.test.py` (extend with new tests over the redesign session)

- [ ] **Step 1:** Add a test that signs in as a test user, opens an AI-categorized site, clicks "Champion this site," and asserts the badge changes.

```python
# Pseudocode — adapt to existing tests/requirements.test.py harness style
def test_champion_adopt_changes_category():
    page.goto(BASE_URL + "/")
    sign_in_as_test_user(page)
    page.click('[data-testid="ai-site-card-first"]')
    expect(page.locator('[data-testid="category-badge"]').inner_text()).to_contain("AI")
    page.click('text=Champion this site')
    page.wait_for_selector('text=I\'m leading this')
    expect(page.locator('[data-testid="category-badge"]').inner_text()).to_contain("Parent")
```

- [ ] **Step 2:** Run E2E suite locally:

```bash
npm run test
```
Expected: new test passes; existing tests still pass.

### Task 3.5: Commit

- [ ] **Step 1:**

```bash
git add src/app/api/sites src/app/api/locations src/components/ChampionButton.tsx src/components/LocationDetailView.tsx src/lib/votes.ts src/types/index.ts tests/redesign.test.py
git commit -m "feat(champions): champion adopt flow with category derivation"
```

---

## Phase 4: Problem Board

### Task 4.1: Admin POST /api/admin/problems

**Files:**
- Create: `src/app/api/admin/problems/route.ts`

- [ ] **Step 1:** Read `src/lib/admin.ts` for `verifyAdmin` pattern.

- [ ] **Step 2:** Implement

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin";

export async function POST(request: NextRequest) {
  const adminCheck = await verifyAdmin(request.headers.get("authorization"));
  if (!adminCheck.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const { siteId, metro, title, description, deadline, pivotTrigger } = body as {
    siteId?: string; metro: string; title: string;
    description?: string; deadline?: string; pivotTrigger?: boolean;
  };

  if (!metro || !title) {
    return NextResponse.json({ error: "metro and title required" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: "supabase unavailable" }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("pp_site_problems")
    .insert({
      site_id: siteId ?? null,
      metro,
      title,
      description: description ?? null,
      deadline: deadline ?? null,
      pivot_trigger: pivotTrigger ?? false,
      created_by: adminCheck.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, problem: data });
}
```

### Task 4.2: Admin PATCH/DELETE /api/admin/problems/[id]

**Files:**
- Create: `src/app/api/admin/problems/[id]/route.ts`

- [ ] **Step 1:** Implement

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminCheck = await verifyAdmin(request.headers.get("authorization"));
  if (!adminCheck.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  for (const k of ["title", "description", "deadline", "pivot_trigger", "status", "outcome_text"]) {
    if (k in body) updates[k] = body[k];
  }
  if (body.status === "resolved" || body.status === "unresolvable") {
    updates.closed_at = new Date().toISOString();
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: "supabase unavailable" }, { status: 500 });

  const { error } = await supabaseAdmin
    .from("pp_site_problems")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminCheck = await verifyAdmin(request.headers.get("authorization"));
  if (!adminCheck.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: "supabase unavailable" }, { status: 500 });
  await supabaseAdmin.from("pp_site_problems").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
```

### Task 4.3: GET endpoints for problems

**Files:**
- Create: `src/app/api/sites/[id]/problems/route.ts`
- Create: `src/app/api/problems/route.ts` (metro-scoped)

- [ ] **Step 1:** Implement site-scoped GET

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json([], { status: 200 });

  const { data: problems } = await supabaseAdmin
    .from("pp_site_problems")
    .select("*")
    .eq("site_id", id)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false });

  if (!problems?.length) return NextResponse.json([]);

  const ids = problems.map(p => p.id);
  const { data: owners } = await supabaseAdmin
    .from("pp_problem_owners")
    .select("*")
    .in("problem_id", ids)
    .is("released_at", null);

  const result = problems.map(p => ({
    ...camelize(p),
    owner: owners?.find(o => o.problem_id === p.id) ? camelize(owners.find(o => o.problem_id === p.id)) : null,
  }));
  return NextResponse.json(result);
}

function camelize(row: Record<string, unknown>): Record<string, unknown> {
  // basic snake → camel for the columns we use
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [
    k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v
  ]));
}
```

- [ ] **Step 2:** Implement metro-scoped GET (`src/app/api/problems/route.ts`)

```typescript
// Reads ?metro= param, returns array same shape as above.
// Same pattern, no `eq("site_id", ...)`, eq("metro", metro) instead.
```

### Task 4.4: Claim/release problem ownership

**Files:**
- Create: `src/app/api/problems/[id]/claim/route.ts`

- [ ] **Step 1:** Implement (POST = claim, DELETE = release). Pattern matches `src/app/api/sites/[id]/champion/route.ts` but writes `pp_problem_owners`. On claim success, also UPDATE `pp_site_problems.status = 'in_progress'` (only if currently 'open'). On release, set status back to 'open'.

### Task 4.5: Problem updates endpoint

**Files:**
- Create: `src/app/api/problems/[id]/updates/route.ts`

- [ ] **Step 1:** POST = add update (writes `pp_problem_updates` after verifying caller is the active owner). GET = list updates for problem.

### Task 4.6: Email notifications on problem events

**Files:**
- Modify: `src/lib/email.ts`
- Modify: `src/app/api/admin/problems/[id]/route.ts` (PATCH that sets status=resolved → email owner + champions)
- Modify: `src/app/api/problems/[id]/claim/route.ts` (POST → email champions of the site that someone claimed)

- [ ] **Step 1:** Add email templates to `src/lib/email.ts`:

```typescript
export function generateProblemClaimedHtml(args: {
  problemTitle: string;
  ownerName: string;
  siteName: string;
  detailsUrl: string;
}) {
  return baseEmailHtml(`
    <h2>Someone stepped up</h2>
    <p><strong>${args.ownerName}</strong> just claimed ownership of:</p>
    <p style="font-size: 18px; font-weight: 600;">${args.problemTitle}</p>
    <p>This is on <strong>${args.siteName}</strong>. We'll keep you posted on progress.</p>
    <p><a href="${args.detailsUrl}" style="...">See progress</a></p>
  `);
}

export function generateProblemResolvedHtml(args: {
  problemTitle: string;
  outcome: string;
  siteName: string;
  detailsUrl: string;
}) {
  return baseEmailHtml(`
    <h2>Problem resolved</h2>
    <p>The problem you were watching has been resolved:</p>
    <p style="font-size: 18px; font-weight: 600;">${args.problemTitle}</p>
    <p style="background: #f4f0e6; padding: 12px; border-radius: 4px;"><strong>Outcome:</strong> ${args.outcome}</p>
    <p>This was on <strong>${args.siteName}</strong>.</p>
    <p><a href="${args.detailsUrl}" style="...">See site</a></p>
  `);
}
```

- [ ] **Step 2:** In claim route, after successful insert, fetch champions for the site, call `sendEmail()` for each.

### Task 4.7: Admin UI for posting problems

**Files:**
- Create: `src/components/admin/ProblemAdmin.tsx`
- Modify: `src/app/admin/page.tsx` (add Problems tab)

- [ ] **Step 1:** Read existing `src/app/admin/page.tsx` to understand the tab pattern (Suggestions / Likes / History tabs already exist).

- [ ] **Step 2:** Add a Problems tab that renders `<ProblemAdmin />`. The component lists open problems (paginated via `/api/problems?metro=&all=true`) and provides a "New problem" form (POST `/api/admin/problems`).

- [ ] **Step 3:** Each row shows: title, site name, metro, status, owner (if any), created date. Actions: edit (PATCH), close as resolved (PATCH status=resolved), delete (DELETE).

### Task 4.8: ProblemCard + ProblemList components

**Files:**
- Create: `src/components/ProblemCard.tsx`
- Create: `src/components/ProblemList.tsx`

- [ ] **Step 1:** ProblemCard renders a single problem with:
  - Title
  - Pivot-trigger callout (orange border + "★ HIGH-LEVERAGE PROBLEM" label) when `pivotTrigger=true`
  - Description
  - Deadline (if set)
  - Owner attribution OR "Sign up to own" button (POST claim) if unclaimed
  - Status updates (collapsed by default, expand link)

```typescript
'use client';

import { useState } from 'react';
import type { SiteProblem } from '@/types';
import { useVoteStore } from '@/lib/votes';

export function ProblemCard({ problem }: { problem: SiteProblem }) {
  const { isAuthenticated, currentUserId, claimProblem, releaseProblem } = useVoteStore();
  const isMine = problem.owner?.userId === currentUserId;
  const isUnclaimed = !problem.owner;

  return (
    <div className={`p-3 rounded border ${problem.pivotTrigger ? 'border-orange-400 border-l-4' : 'border-stone-200'}`}>
      {problem.pivotTrigger && (
        <div className="text-xs font-bold text-orange-700 mb-1">★ HIGH-LEVERAGE PROBLEM</div>
      )}
      <div className="flex justify-between items-start gap-2">
        <div className="font-semibold">{problem.title}</div>
        {problem.deadline && <div className="text-xs text-stone-500">{problem.deadline}</div>}
      </div>
      {problem.description && <p className="text-sm text-stone-600 mt-1">{problem.description}</p>}
      <div className="flex justify-between items-center mt-2">
        {isUnclaimed ? (
          <button
            disabled={!isAuthenticated}
            onClick={() => claimProblem(problem.id)}
            className="text-xs px-3 py-1 bg-orange-100 text-orange-800 font-semibold rounded hover:bg-orange-200 disabled:opacity-50"
          >Sign up to own</button>
        ) : (
          <div className="text-xs text-stone-600">
            {isMine ? "You're driving this" : `${problem.owner!.displayName ?? 'A parent'} is driving this`}
          </div>
        )}
        {isMine && (
          <button onClick={() => releaseProblem(problem.id)} className="text-xs text-stone-500 underline">
            Release
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** ProblemList: takes `siteId` or `metro` prop, fetches via `/api/sites/:id/problems` or `/api/problems?metro=`, renders pivot-trigger problems first, then by deadline, then by created_at.

### Task 4.9: Wire problems into LocationDetailView (Engaged + Committed sites)

**Files:**
- Modify: `src/components/LocationDetailView.tsx`

- [ ] **Step 1:** Below the title block, when `location.derived.stage` is `engaged` or `committed`, render:

```tsx
{(location.derived?.stage === 'engaged' || location.derived?.stage === 'committed') && (
  <div className="px-4 py-3">
    <ProblemList siteId={location.id} />
  </div>
)}
```

### Task 4.10: E2E + commit

- [ ] **Step 1:** Extend `tests/redesign.test.py` with: admin posts a problem, parent sees it, parent claims, refresh shows owner.

- [ ] **Step 2:**

```bash
git add src/app/api/admin/problems src/app/api/problems src/app/api/sites/\[id\]/problems src/components/ProblemCard.tsx src/components/ProblemList.tsx src/components/admin/ProblemAdmin.tsx src/app/admin/page.tsx src/components/LocationDetailView.tsx src/lib/email.ts src/lib/votes.ts tests/redesign.test.py
git commit -m "feat(problems): ad-hoc problem board with claim/release and email notifications"
```

---

## Phase 5: Plan of Record

### Task 5.1: Plan API routes

**Files:**
- Create: `src/app/api/metro/[metro]/plan/route.ts` (public GET)
- Create: `src/app/api/admin/metro/[metro]/plan/route.ts` (admin PUT)

- [ ] **Step 1:** Public GET — read-only fetch from `pp_plan_of_record` keyed by metro.

```typescript
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ metro: string }> }
) {
  const { metro } = await params;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json(null);
  const { data } = await supabaseAdmin
    .from("pp_plan_of_record")
    .select("*")
    .eq("metro", metro)
    .maybeSingle();
  return NextResponse.json(data);
}
```

- [ ] **Step 2:** Admin PUT — verifies admin, upserts plan with new template inputs, narrative override, pivot conditions. Sets `last_curated_at`, `last_curated_by`.

### Task 5.2: Admin UI for curating plans

**Files:**
- Create: `src/components/admin/PlanAdmin.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1:** Add a "Plans" tab. PlanAdmin lets admin pick a metro from a dropdown, then shows a form with:
  - Primary long-term site (autocomplete dropdown over `pp_locations` filtered to that metro)
  - Bridge site (same)
  - Watch sites (multi-select)
  - Narrative override (textarea, optional)
  - Pivot conditions (repeating section: trigger problem dropdown + description text)

- [ ] **Step 2:** Save → PUT to `/api/admin/metro/<metro>/plan`.

### Task 5.3: PlanOfRecord component

**Files:**
- Create: `src/components/PlanOfRecord.tsx`

- [ ] **Step 1:** Fetches plan via `/api/metro/<metro>/plan`. Renders the narrative paragraph (either `narrativeOverride` or auto-generated from template inputs + champion attribution + bridge timeline). Below it, the "What would change this" list mapping each pivot condition to its trigger problem with a "Sign up" CTA when unclaimed.

```typescript
async function buildAutoNarrative(plan: MetroPlan, locations: Location[]): Promise<string> {
  // Look up bridgeSite, primaryLongTermSite, watch sites by ID
  // Format: "Launching at <bridge> while we build out <primary>. Watch: <watch>."
  // Champion attribution: "...parent site, championed by <names>."
  // Status decoration: "blocked on zoning" if a pivot condition exists for that site.
  // ...
}
```

- [ ] **Step 2:** Wire `<PlanOfRecord metro={metro} />` to render at top of `AltPanel` (Phase 6 will move this — for now it can render below the existing header).

### Task 5.4: Commit

```bash
git add src/app/api/metro src/app/api/admin/metro src/components/PlanOfRecord.tsx src/components/admin/PlanAdmin.tsx src/app/admin/page.tsx
git commit -m "feat(plan): per-metro plan of record with admin curation"
```

---

## Phase 6: Per-metro Home View Layout

### Task 6.1: Refactor AltPanel into category-organized sections

**Files:**
- Modify: `src/components/AltPanel.tsx`
- Create: `src/components/CategorySection.tsx`
- Create: `src/components/StageBadge.tsx`

- [ ] **Step 1:** Read the current `AltPanel.tsx` carefully. Identify the section that renders the location card list at zoom >= 9.

- [ ] **Step 2:** Create `StageBadge.tsx`:

```typescript
import type { SiteStage } from '@/types';

const STAGE_STYLES: Record<SiteStage, { label: string; className: string }> = {
  scored: { label: 'SCORED', className: 'bg-blue-100 text-blue-700' },
  engaged: { label: 'ENGAGED', className: 'bg-orange-100 text-orange-700' },
  committed: { label: 'COMMITTED', className: 'bg-green-100 text-green-700' },
  moved_on: { label: 'MOVED ON', className: 'bg-stone-100 text-stone-500' },
};

export function StageBadge({ stage }: { stage: SiteStage }) {
  const s = STAGE_STYLES[stage];
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.className}`}>
      {s.label}
    </span>
  );
}
```

- [ ] **Step 3:** Create `CategorySection.tsx`:

```typescript
import type { Location, SiteCategory } from '@/types';
import { AltLocationCard } from './AltLocationCard';

const CATEGORY_HEADERS: Record<SiteCategory, { label: string; subtitle: string; borderClass: string; bgClass: string; textClass: string }> = {
  parent: { label: 'PARENT', subtitle: 'long-term watch', borderClass: 'border-emerald-600', bgClass: 'bg-emerald-50', textClass: 'text-emerald-700' },
  ai: { label: 'AI', subtitle: 'primary path', borderClass: 'border-blue-600', bgClass: 'bg-blue-50', textClass: 'text-blue-700' },
  short_term: { label: 'SHORT-TERM', subtitle: 'bridge', borderClass: 'border-amber-600', bgClass: 'bg-amber-50', textClass: 'text-amber-700' },
};

export function CategorySection({
  category,
  locations,
  /* card props passed through */
  ...cardProps
}: {
  category: SiteCategory;
  locations: Location[];
} & React.ComponentProps<typeof AltLocationCard>) {
  if (locations.length === 0) return null;
  const h = CATEGORY_HEADERS[category];
  return (
    <div className={`mx-4 mb-3 p-3 bg-white border ${h.borderClass} border-l-4 rounded`}>
      <div className="flex justify-between items-baseline mb-2">
        <div className={`text-xs font-bold uppercase tracking-wider ${h.textClass}`}>
          {h.label} · {locations.length}
        </div>
        <div className="text-xs text-stone-500">{h.subtitle}</div>
      </div>
      <div className="space-y-2">
        {locations.map(loc => (
          <AltLocationCard key={loc.id} location={loc} {...cardProps} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4:** In `AltPanel.tsx`, replace the existing flat card list with three CategorySection blocks (Parent, AI, Short-term). Filter the location array three ways using `loc.derived?.category`.

```typescript
// In AltPanel, where locations are listed:
const parentSites = filteredLocations.filter(l => l.derived?.category === 'parent');
const aiActive = filteredLocations.filter(
  l => l.derived?.category === 'ai' && (l.derived?.stage === 'engaged' || l.derived?.stage === 'committed')
);
const shortTerm = filteredLocations.filter(l => l.derived?.category === 'short_term');
const candidates = filteredLocations.filter(
  l => l.derived?.category === 'ai' && l.derived?.stage === 'scored'
);

// Render:
<PlanOfRecord metro={currentMetro} />
<CategorySection category="parent" locations={parentSites} {...cardProps} />
<CategorySection category="ai" locations={aiActive} {...cardProps} />
<CategorySection category="short_term" locations={shortTerm} {...cardProps} />
{/* Candidates link */}
<div className="mx-4 mb-3 p-3 bg-stone-50 rounded cursor-pointer">
  <div className="flex justify-between items-center">
    <div className="text-sm text-stone-600">
      <span className="font-semibold">Candidates</span> · {candidates.length} scored sites
    </div>
    <span className="text-sm text-blue-600">Browse + like →</span>
  </div>
</div>
{/* Footer */}
<div className="mx-4 mb-4 pt-3 border-t border-stone-200">
  <div className="text-xs text-stone-500">
    From {totalScored} scored, we engaged {aiActive.length} and committed {committedCount}.
    <a className="text-blue-600 ml-2">See moved-on (N) →</a>
    <a className="text-blue-600 ml-2">Suggest a site →</a>
  </div>
</div>
```

### Task 6.2: AltLocationCard simplifications for category context

**Files:**
- Modify: `src/components/AltLocationCard.tsx`

- [ ] **Step 1:** Add a `<StageBadge stage={location.derived?.stage} />` to the top-right of each card.

- [ ] **Step 2:** When `category === 'parent'`, show champion attribution under the title: *"Submitted by Sarah K. · championed by 9"*.

- [ ] **Step 3:** Hide the per-card progress bar in the new category-organized context (it's redundant with the Plan of Record narrative).

### Task 6.3: Candidates link → existing scored browser

**Files:**
- Modify: `src/components/AltPanel.tsx`

- [ ] **Step 1:** Click on the Candidates link toggles a "browse mode" state where the panel shows the existing flat scored list (preserve the previous AltPanel behavior here as a sub-mode). Add a back-arrow at the top to return to the categorized view.

### Task 6.4: E2E + commit

- [ ] **Step 1:** Add Playwright test: open Austin metro, see Plan of Record block, see Parent / AI / Short-term sections in that order, see Candidates link, see footer.

- [ ] **Step 2:**

```bash
git add src/components/AltPanel.tsx src/components/AltLocationCard.tsx src/components/CategorySection.tsx src/components/StageBadge.tsx tests/redesign.test.py
git commit -m "feat(panel): category-primary layout with plan of record"
```

---

## Phase 7: Detail View + Map Encoding

### Task 7.1: StageTimeline component

**Files:**
- Create: `src/components/StageTimeline.tsx`

- [ ] **Step 1:** Implement

```typescript
import type { CommittedSubStage } from '@/types';

const SUB_STAGES: { key: CommittedSubStage; label: string }[] = [
  { key: 'loi', label: 'LOI' },
  { key: 'lease', label: 'Lease' },
  { key: 'zoning', label: 'Zoning' },
  { key: 'permits', label: 'Permits' },
  { key: 'buildout', label: 'Buildout' },
  { key: 'co', label: 'CO' },
];

export function StageTimeline({ current }: { current: CommittedSubStage }) {
  const idx = SUB_STAGES.findIndex(s => s.key === current);
  return (
    <div>
      <div className="flex gap-1">
        {SUB_STAGES.map((s, i) => (
          <div key={s.key} className={`h-1.5 flex-1 rounded ${
            i < idx ? 'bg-emerald-500' :
            i === idx ? 'bg-orange-500' :
            'bg-stone-200'
          }`} />
        ))}
      </div>
      <div className="flex justify-between text-[9px] uppercase tracking-wider text-stone-500 mt-1">
        {SUB_STAGES.map(s => <span key={s.key}>{s.label}</span>)}
      </div>
    </div>
  );
}
```

### Task 7.2: Tier-specific sections in LocationDetailView

**Files:**
- Modify: `src/components/LocationDetailView.tsx`
- Create: `src/components/MovedOnSection.tsx`

- [ ] **Step 1:** Below the title block, render conditional sections:

```tsx
{/* Engaged → Open Problems for this site */}
{location.derived?.stage === 'engaged' && (
  <div className="px-4 py-3">
    <ProblemList siteId={location.id} />
  </div>
)}

{/* Committed → Stage Timeline + Open Problems */}
{location.derived?.stage === 'committed' && (
  <>
    <div className="px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">Path to opening</div>
      <StageTimeline current={location.derived?.committedSubStage ?? 'loi'} />
    </div>
    <div className="px-4 py-3">
      <ProblemList siteId={location.id} />
    </div>
  </>
)}

{/* Moved On → reason + forward link */}
{location.derived?.stage === 'moved_on' && (
  <MovedOnSection location={location} />
)}
```

- [ ] **Step 2:** MovedOnSection renders a faded block with the parsed reason from `location.derived?.movedOnReason` and a forward link to the next site (sourced from same metro's plan-of-record primary site).

### Task 7.3: Map marker encoding

**Files:**
- Modify: `src/components/MapView.tsx`

- [ ] **Step 1:** Read existing layer setup in `MapView.tsx`. Identify the unclustered-point layer and its paint expressions.

- [ ] **Step 2:** Replace `circle-color` and `circle-radius` expressions:

```typescript
// circle-color → category-driven
"circle-color": [
  "case",
  ["==", ["get", "category"], "parent"], "#10b981",      // emerald
  ["==", ["get", "category"], "short_term"], "#f59e0b",  // amber
  "#3b82f6"                                               // default = AI blue
],

// circle-radius → stage-driven (sizes)
"circle-radius": [
  "case",
  ["get", "selected"], 14,
  ["==", ["get", "stage"], "committed"], 12,
  ["==", ["get", "stage"], "engaged"], 9,
  6  // scored
],

// Stroke / halo for committed
"circle-stroke-width": [
  "case",
  ["get", "selected"], 4,
  ["==", ["get", "stage"], "committed"], 4,
  2
],
```

- [ ] **Step 3:** When mapping locations to GeoJSON features (existing function in MapView), include `category: loc.derived?.category` and `stage: loc.derived?.stage` in the properties.

- [ ] **Step 4:** Hide moved-on sites from the map by default. Filter them out in the GeoJSON feature builder.

### Task 7.4: E2E + commit

```bash
git add src/components/StageTimeline.tsx src/components/LocationDetailView.tsx src/components/MovedOnSection.tsx src/components/MapView.tsx
git commit -m "feat(detail): tier-specific sections, stage timeline, and map encoding"
```

---

## Phase 8: Move-On Display in panel

### Task 8.1: Surface moved-on sites in panel footer

**Files:**
- Modify: `src/components/AltPanel.tsx`

- [ ] **Step 1:** Add a "Recently moved on (N)" link in the footer that toggles a moved-on list. Each item: name, stage at death, faded styling, parsed reason.

- [ ] **Step 2:** Click → opens MovedOnSection-style detail view.

### Task 8.2: Commit

```bash
git add src/components/AltPanel.tsx
git commit -m "feat(panel): surface recently moved-on sites in footer"
```

---

## Phase 9: Integration & Polish

### Task 9.1: Run full test suite

- [ ] **Step 1:**

```bash
npm run test:unit && npm run test
```
Expected: all pass.

- [ ] **Step 2:** Lint and type-check:

```bash
npm run lint
npx tsc --noEmit
```
Fix anything that surfaces.

### Task 9.2: Manual smoke test in dev server

- [ ] **Step 1:** Start dev server:

```bash
npm run dev
```

- [ ] **Step 2:** Visit a metro (Austin recommended given existing seed data). Verify:
  - Plan of Record block renders (curate one in admin first if needed)
  - Parent / AI / Short-term sections render where applicable
  - Candidates link toggles to scored browser
  - Footer shows funnel stat + moved-on link + suggest link
  - Click an Engaged AI site → "Champion this site" button shows; clicking it adds you as champion; site moves to Parent block on refresh
  - Admin posts a problem → it appears in detail view; clicking "Sign up to own" claims it
  - Map markers show stage-size + category-color encoding
  - Map drives detail view zoom on selection
  - Mobile (resize to <768px): map hides, panel scrolls vertically, detail view full-screen

### Task 9.3: Update CLAUDE.md session state

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1:** Add a new "Workstream" entry under "Session State" summarizing what shipped in this PR (the parent feedback redesign), the new tables, the new data flow, and any quirks discovered.

### Task 9.4: PR

- [ ] **Step 1:** Push the branch:

```bash
git push -u origin feature/parent-feedback-redesign
```

- [ ] **Step 2:** Open PR with title "feat: parent feedback redesign — full-pipeline visibility, championship, problem board, plan of record" and body summarizing the spec. Verify Vercel preview deployment succeeds.

- [ ] **Step 3:** Test on the preview URL with at least one metro that has a curated Plan of Record.

---

## Self-Review

### Spec coverage check
- ✅ R-CHAMPIONS — Phase 3 (champion API + UI)
- ✅ R-PROBLEMS — Phase 4 (problem board API + UI + admin)
- ✅ R-PLAN — Phase 5 (plan API + admin curation + display)
- ✅ R-LAYOUT — Phase 6 (AltPanel category-primary refactor)
- ✅ R-DETAIL — Phase 7 (tier-specific sections + StageTimeline)
- ✅ R-MAP — Phase 7 (marker encoding refactor)
- ✅ Move-On display — Phase 7 (MovedOnSection) + Phase 8 (footer link)
- ✅ Submission championship affirmation — to add to Phase 3 or as a follow-up (covered indirectly via R-CHAMPIONS-002 in requirements; tighten in Task 3.x by extending SuggestLocationModal). **Adding Task 3.6 to address.**
- ✅ Origin metadata preserved — uses existing `pp_locations.suggested_by`; surfaced in card subtitle in Phase 6
- ✅ V1 scope (no REBL changes) — Phase 0/1/2 establish parser layer; no REBL coordination required

### Type consistency
Names checked across phases:
- `SiteStage`, `SiteCategory`, `CommittedSubStage`, `ProblemStatus`, `ChampionRole` — defined in Task 1.3, used consistently
- `getStage()`, `getCategory()`, `parseCommittedSubStage()`, `parseMovedOnReason()` — defined Phase 2, called from Tasks 3.2 and 7.x
- `refreshChampions`, `claimProblem`, `releaseProblem` — Zustand actions referenced consistently

### Placeholder scan
No "TBD" / "TODO" left in the implementation steps. Tasks 4.4, 4.5 reference patterns from earlier tasks rather than re-pasting code — acceptable since pattern is identical.

### Adding Task 3.6 (championship affirmation in submission flow)

### Task 3.6: Championship affirmation in SuggestLocationModal

**Files:**
- Modify: `src/components/SuggestLocationModal.tsx`
- Modify: `src/app/api/contributions/route.ts` (or wherever submission persists — confirm path on read)

- [ ] **Step 1:** Read `SuggestLocationModal.tsx` to find the submit button + form state.

- [ ] **Step 2:** Add a checkbox above the submit button:

```tsx
<label className="flex items-start gap-2 text-sm text-stone-700 mt-3">
  <input type="checkbox" checked={championAck} onChange={e => setChampionAck(e.target.checked)} required />
  <span>By submitting, I'm saying I'll help drive this site forward. I understand I'll be looped in on every problem and decision, and I can hand off the role later if needed.</span>
</label>
```

Disable submit until checked.

- [ ] **Step 3:** On successful submission, after the location row is inserted, also insert a `pp_site_champions` row with role='lead' for the submitter.

- [ ] **Step 4:** Commit (extend the Phase 3 commit or add a follow-up commit).

---

## Execution Notes

- **Worktree-first:** Per user preference (saved to memory), all code work happens in the `feature/parent-feedback-redesign` worktree, not main.
- **Frequent commits:** Each task ends with a commit; each phase ends with a phase-level commit if natural.
- **TDD for the lib layer:** Phases 1–2 are strict TDD. UI phases blend TDD with E2E/Playwright tests for user-facing flows.
- **Migration discipline:** The migration in `sql/2026-05-04-parent-feedback-redesign.sql` is idempotent (`CREATE TABLE IF NOT EXISTS`, etc.) so it can be re-applied safely if needed.
- **Vercel preview:** Each push to the feature branch will create a Vercel preview deployment. Test the PR on preview before merging.
- **Out of scope (explicitly):** Recruitment, enrollment, family referrals (separate part of the site). Don't accept feature creep into those during execution.

## References

- Spec: `docs/superpowers/specs/2026-05-04-parent-feedback-redesign-design.md`
- Principles: `docs/principles.md`
- Existing patterns: `src/app/api/admin/locations/[id]/approve/route.ts` (route pattern), `src/lib/admin.ts` (auth check), `src/lib/email.ts` (email pattern), `src/components/AltPanel.tsx` (panel structure)
