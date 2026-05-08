/**
 * Regulatory issue sync — pure ops computation.
 *
 * Reads `rebl3_status[system='regulatory']` issue arrays and an existing pp_site_problems
 * snapshot, returning insert/update/skip ops that the caller dispatches against Postgres.
 *
 * Sync rules:
 *  - Key per site: source_ref.name (the REBL-supplied issue name).
 *  - On insert: parent_ownable=false, status='open', source_ref captures provenance.
 *  - On update: refresh title/category/severity ONLY if admin_edited_at IS NULL.
 *  - parent_ownable is admin-only and never written by sync.
 *  - Existing rows whose name no longer appears in the live REBL payload are flagged
 *    as 'orphan' skips (caller decides what to do — current policy: leave them alone).
 *  - Existing rows with sourceRef=null are admin-typed problems, not regulatory; ignored.
 */

export interface RegulatoryIssue {
  name: string;
  type: 'zoning' | 'licensing' | string;
  severity: 'H' | 'M' | 'L' | string;
}

export interface ExistingProblem {
  id: string;
  title: string;
  category: 'zoning' | 'licensing' | 'other';
  severity: 'H' | 'M' | 'L';
  adminEditedAt: string | null;
  sourceRef: { system: string; site_id: string; name: string } | null;
}

export interface SyncInput {
  siteId: string;          // pp_locations.id (uuid)
  metro: string;
  rebl3SiteId: string;     // rebl3_sites.site_id (slug)
  issues: RegulatoryIssue[];
  existing: ExistingProblem[];
}

export interface InsertOp {
  site_id: string;
  metro: string;
  title: string;
  category: 'zoning' | 'licensing' | 'other';
  severity: 'H' | 'M' | 'L';
  parent_ownable: false;   // sync NEVER sets this true
  status: 'open';
  source_ref: { system: 'regulatory'; site_id: string; name: string };
}

export interface UpdateOp {
  id: string;
  patch: Partial<{
    title: string;
    category: 'zoning' | 'licensing' | 'other';
    severity: 'H' | 'M' | 'L';
  }>;
}

export interface SkipReason {
  reason: 'no-change' | 'admin-edited' | 'orphan';
  id: string;
}

export interface SyncOps {
  insert: InsertOp[];
  update: UpdateOp[];
  skip: SkipReason[];
}

const VALID_CATEGORY = new Set<'zoning' | 'licensing' | 'other'>(['zoning', 'licensing', 'other']);
const VALID_SEVERITY = new Set<'H' | 'M' | 'L'>(['H', 'M', 'L']);

function clampCategory(t: string): 'zoning' | 'licensing' | 'other' {
  return VALID_CATEGORY.has(t as 'zoning' | 'licensing' | 'other')
    ? (t as 'zoning' | 'licensing' | 'other')
    : 'other';
}

function clampSeverity(s: string): 'H' | 'M' | 'L' {
  return VALID_SEVERITY.has(s as 'H' | 'M' | 'L')
    ? (s as 'H' | 'M' | 'L')
    : 'M';
}

export function computeRegulatorySyncOps(input: SyncInput): SyncOps {
  const { siteId, metro, rebl3SiteId, issues, existing } = input;
  const insert: InsertOp[] = [];
  const update: UpdateOp[] = [];
  const skip: SkipReason[] = [];

  // Index existing regulatory-sourced rows by REBL issue name
  const existingByName = new Map<string, ExistingProblem>();
  for (const e of existing) {
    if (e.sourceRef?.system === 'regulatory' && e.sourceRef.name) {
      existingByName.set(e.sourceRef.name, e);
    }
  }
  const seen = new Set<string>();

  for (const issue of issues) {
    seen.add(issue.name);
    const cat = clampCategory(issue.type);
    const sev = clampSeverity(issue.severity);
    const ex = existingByName.get(issue.name);

    if (!ex) {
      insert.push({
        site_id: siteId,
        metro,
        title: issue.name,
        category: cat,
        severity: sev,
        parent_ownable: false,
        status: 'open',
        source_ref: { system: 'regulatory', site_id: rebl3SiteId, name: issue.name },
      });
      continue;
    }

    if (ex.adminEditedAt) {
      skip.push({ reason: 'admin-edited', id: ex.id });
      continue;
    }

    const patch: UpdateOp['patch'] = {};
    if (ex.title !== issue.name) patch.title = issue.name;
    if (ex.category !== cat) patch.category = cat;
    if (ex.severity !== sev) patch.severity = sev;

    if (Object.keys(patch).length === 0) {
      skip.push({ reason: 'no-change', id: ex.id });
    } else {
      update.push({ id: ex.id, patch });
    }
  }

  // Orphans — regulatory-sourced rows whose name no longer appears in the live payload
  for (const e of existing) {
    if (e.sourceRef?.system === 'regulatory' && e.sourceRef.name && !seen.has(e.sourceRef.name)) {
      skip.push({ reason: 'orphan', id: e.id });
    }
  }

  return { insert, update, skip };
}
