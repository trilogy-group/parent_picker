"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X as XIcon } from "lucide-react";

type Category = "zoning" | "licensing" | "other";
type Severity = "H" | "M" | "L";

interface AdminProblem {
  id: string;
  site_id: string | null;
  metro: string;
  title: string;
  description: string | null;
  deadline: string | null;
  pivot_trigger: boolean;
  status: "open" | "in_progress" | "resolved" | "unresolvable";
  outcome_text: string | null;
  created_at: string;
  closed_at: string | null;
  parent_ownable: boolean;
  category: Category;
  severity: Severity;
  source_ref: { system: string; site_id: string; name: string } | null;
  site: { name: string; city: string; state: string } | null;
}

interface NewProblem {
  metro: string;
  title: string;
  description: string;
  deadline: string;
  pivotTrigger: boolean;
  siteId: string;
  parentOwnable: boolean;
  category: Category;
  severity: Severity;
}

const EMPTY_FORM: NewProblem = {
  metro: "",
  title: "",
  description: "",
  deadline: "",
  pivotTrigger: false,
  siteId: "",
  parentOwnable: false,
  category: "other",
  severity: "M",
};

export function ProblemAdmin({ token }: { token: string }) {
  const [problems, setProblems] = useState<AdminProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewProblem>(EMPTY_FORM);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/problems", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setProblems(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function createProblem(e: React.FormEvent) {
    e.preventDefault();
    if (!form.metro || !form.title) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/problems", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metro: form.metro,
          title: form.title,
          description: form.description || undefined,
          deadline: form.deadline || undefined,
          pivotTrigger: form.pivotTrigger,
          siteId: form.siteId || undefined,
          parentOwnable: form.parentOwnable,
          category: form.category,
          severity: form.severity,
        }),
      });
      if (res.ok) {
        setForm(EMPTY_FORM);
        setShowForm(false);
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function patchProblem(p: AdminProblem, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/problems/${p.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await refresh();
  }

  async function resolveProblem(p: AdminProblem) {
    const outcome = window.prompt("Outcome (will be emailed to owner + champions):");
    if (!outcome) return;
    await patchProblem(p, { status: "resolved", outcome_text: outcome });
  }

  async function deleteProblem(p: AdminProblem) {
    if (!window.confirm(`Delete problem "${p.title}"?`)) return;
    const res = await fetch(`/api/admin/problems/${p.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) await refresh();
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading problems…</div>;
  }

  const openCount = problems.filter(p => p.status === "open" || p.status === "in_progress").length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Open Problems · {openCount}</h2>
        <button
          onClick={() => setShowForm(s => !s)}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> New problem
        </button>
      </div>

      {showForm && (
        <form onSubmit={createProblem} className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="Metro (e.g. Austin)"
              value={form.metro}
              onChange={e => setForm({ ...form, metro: e.target.value })}
              className="border rounded px-2 py-1.5 text-sm"
            />
            <input
              placeholder="Site ID (optional UUID)"
              value={form.siteId}
              onChange={e => setForm({ ...form, siteId: e.target.value })}
              className="border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <input
            required
            placeholder="Title (short, action-oriented)"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
          <textarea
            placeholder="Description / context"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full border rounded px-2 py-1.5 text-sm"
            rows={2}
          />
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-stone-700 space-y-1">
              <span className="font-semibold">Category</span>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value as Category })}
                className="block w-full border rounded px-2 py-1.5 text-sm"
              >
                <option value="zoning">Zoning</option>
                <option value="licensing">Licensing</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-xs text-stone-700 space-y-1">
              <span className="font-semibold">Severity</span>
              <select
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value as Severity })}
                className="block w-full border rounded px-2 py-1.5 text-sm"
              >
                <option value="H">High</option>
                <option value="M">Medium</option>
                <option value="L">Low</option>
              </select>
            </label>
            <label className="flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.parentOwnable}
                onChange={e => setForm({ ...form, parentOwnable: e.target.checked })}
              />
              Parent-ownable
            </label>
          </div>
          <div className="flex gap-3 items-center">
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm({ ...form, deadline: e.target.value })}
              className="border rounded px-2 py-1.5 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pivotTrigger}
                onChange={e => setForm({ ...form, pivotTrigger: e.target.checked })}
              />
              Pivot trigger (high-leverage)
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm px-3 py-1.5 rounded border">Cancel</button>
            <button type="submit" disabled={submitting} className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50">
              {submitting ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      )}

      {problems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No problems yet. Use &quot;New problem&quot; above to post one.
        </div>
      )}
      {problems.map(p => (
        <div key={p.id} className={`border rounded-lg p-3 ${p.pivot_trigger ? "border-orange-400 border-l-4" : ""}`}>
          {p.source_ref && (
            <div className="text-[11px] text-stone-500 italic mb-1">
              Synced from REBL · {p.source_ref.system} · {p.source_ref.name}
            </div>
          )}
          <div className="flex justify-between gap-2 items-start">
            <div className="flex-1">
              <div className="font-semibold text-sm">{p.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {p.site ? `${p.site.name}, ${p.site.city}, ${p.site.state}` : `Metro: ${p.metro}`}
                {p.deadline && ` · Deadline ${p.deadline}`}
              </div>
              {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                <StatusPill status={p.status} />
                <CategoryPill category={p.category} />
                <SeverityPill severity={p.severity} />
                {p.pivot_trigger && (
                  <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">★ HIGH-LEVERAGE</span>
                )}
                {p.outcome_text && <span className="text-muted-foreground italic">{p.outcome_text}</span>}
              </div>
              {/* Inline curation row */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={p.parent_ownable}
                    onChange={e => patchProblem(p, { parentOwnable: e.target.checked })}
                  />
                  Parent-ownable
                </label>
                <label className="inline-flex items-center gap-1">
                  Cat:
                  <select
                    value={p.category}
                    onChange={e => patchProblem(p, { category: e.target.value })}
                    className="border rounded px-1 py-0.5"
                  >
                    <option value="zoning">zoning</option>
                    <option value="licensing">licensing</option>
                    <option value="other">other</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-1">
                  Sev:
                  <select
                    value={p.severity}
                    onChange={e => patchProblem(p, { severity: e.target.value })}
                    className="border rounded px-1 py-0.5"
                  >
                    <option value="H">H</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {(p.status === "open" || p.status === "in_progress") && (
                <button onClick={() => resolveProblem(p)} className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 hover:bg-green-200">Resolve</button>
              )}
              <button onClick={() => deleteProblem(p)} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50" title="Delete"><XIcon className="h-3 w-3" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: "open" | "in_progress" | "resolved" | "unresolvable" }) {
  const styles: Record<string, string> = {
    open: "bg-amber-100 text-amber-800",
    in_progress: "bg-blue-100 text-blue-800",
    resolved: "bg-green-100 text-green-800",
    unresolvable: "bg-stone-100 text-stone-700",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>{status.replace("_", " ")}</span>;
}

function CategoryPill({ category }: { category: Category }) {
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-200 text-stone-800">{category}</span>;
}

function SeverityPill({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    H: "bg-orange-200 text-orange-900",
    M: "bg-stone-200 text-stone-800",
    L: "bg-stone-100 text-stone-600",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[severity]}`}>{severity}</span>;
}
