"use client";

import { useState } from "react";
import { Loader2, Plus, X as XIcon } from "lucide-react";
import type { SiteProblem } from "@/types";

interface Candidate {
  id: string;
  address: string;
  city: string;
  state: string;
  leasing_status: string | null;
  loi_status: string | null;
  is_bridge: boolean;
  champion_count: number;
}

interface PivotConditionRow {
  triggerProblemId: string;
  description: string;
}

const COMMITTED_LOI = new Set(["done", "signed", "loi-signed", "completed"]);

function describeStage(c: Candidate): string {
  if (c.is_bridge) return "BRIDGE";
  if ((c.loi_status && COMMITTED_LOI.has(c.loi_status)) || c.leasing_status === "done") return "COMMITTED";
  if (c.leasing_status || c.loi_status) return "ENGAGED";
  return "—";
}

function formatOption(c: Candidate): string {
  const stage = describeStage(c);
  const champ = c.champion_count > 0 ? ` · ★${c.champion_count}` : "";
  return `${stage} · ${c.address}, ${c.city}${champ}`;
}

export function PlanAdmin({ token }: { token: string }) {
  const [metro, setMetro] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [problems, setProblems] = useState<SiteProblem[]>([]);
  const [primaryLongTermSiteId, setPrimaryLongTermSiteId] = useState("");
  const [bridgeSiteId, setBridgeSiteId] = useState("");
  const [watchSiteIds, setWatchSiteIds] = useState<string[]>([]);
  const [narrativeOverride, setNarrativeOverride] = useState("");
  const [pivotConditions, setPivotConditions] = useState<PivotConditionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!metro) return;
    setLoading(true);
    setMessage(null);
    try {
      // Load candidates, problems, and existing plan in parallel.
      const [candidatesRes, problemsRes, planRes] = await Promise.all([
        fetch(`/api/admin/metro/${encodeURIComponent(metro)}/candidates`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/problems?metro=${encodeURIComponent(metro)}&all=true`),
        fetch(`/api/metro/${encodeURIComponent(metro)}/plan`),
      ]);

      const candidatesList: Candidate[] = candidatesRes.ok ? await candidatesRes.json() : [];
      setCandidates(candidatesList);

      const problemsList: SiteProblem[] = problemsRes.ok ? await problemsRes.json() : [];
      setProblems(problemsList);

      const planData = planRes.ok ? await planRes.json() : null;
      if (planData) {
        setPrimaryLongTermSiteId(planData.narrativeTemplateInputs?.primaryLongTermSiteId ?? "");
        setBridgeSiteId(planData.narrativeTemplateInputs?.bridgeSiteId ?? "");
        setWatchSiteIds(planData.narrativeTemplateInputs?.watchSiteIds ?? []);
        setNarrativeOverride(planData.narrativeOverride ?? "");
        // Coerce existing rows into the simple shape; ignore unrecognized fields like newRoleAssignment for now.
        setPivotConditions((planData.pivotConditions ?? []).map((p: { triggerProblemId?: string; description?: string }) => ({
          triggerProblemId: p.triggerProblemId ?? "",
          description: p.description ?? "",
        })));
        setMessage(`Loaded plan (last curated ${new Date(planData.lastCuratedAt).toLocaleString()}). ${candidatesList.length} candidate sites, ${problemsList.length} problems in this metro.`);
      } else {
        setPrimaryLongTermSiteId("");
        setBridgeSiteId("");
        setWatchSiteIds([]);
        setNarrativeOverride("");
        setPivotConditions([]);
        setMessage(`No plan curated yet. ${candidatesList.length} candidate sites, ${problemsList.length} problems in this metro.`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!metro) return;
    setSaving(true);
    setMessage(null);
    try {
      const cleanConditions = pivotConditions
        .filter(c => c.triggerProblemId && c.description.trim())
        .map(c => ({ triggerProblemId: c.triggerProblemId, description: c.description.trim() }));
      const res = await fetch(`/api/admin/metro/${encodeURIComponent(metro)}/plan`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          narrativeTemplateInputs: {
            primaryLongTermSiteId: primaryLongTermSiteId || undefined,
            bridgeSiteId: bridgeSiteId || undefined,
            watchSiteIds: watchSiteIds.length > 0 ? watchSiteIds : undefined,
          },
          pivotConditions: cleanConditions,
          narrativeOverride: narrativeOverride || null,
        }),
      });
      if (res.ok) {
        setMessage("Saved.");
      } else {
        const j = await res.json().catch(() => ({}));
        setMessage(`Failed: ${j.error ?? "unknown error"}`);
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleWatch(id: string) {
    setWatchSiteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function addPivotCondition() {
    setPivotConditions(prev => [...prev, { triggerProblemId: "", description: "" }]);
  }

  function updatePivotCondition(index: number, patch: Partial<PivotConditionRow>) {
    setPivotConditions(prev => prev.map((c, i) => i === index ? { ...c, ...patch } : c));
  }

  function removePivotCondition(index: number) {
    setPivotConditions(prev => prev.filter((_, i) => i !== index));
  }

  const watchCandidates = candidates.filter(c => c.id !== primaryLongTermSiteId && c.id !== bridgeSiteId);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          placeholder="Metro name (e.g. Austin, Oklahoma City, Dallas-Fort Worth)"
          value={metro}
          onChange={e => setMetro(e.target.value)}
          className="flex-1 border rounded px-3 py-1.5 text-sm"
        />
        <button
          onClick={load}
          disabled={loading || !metro}
          className="text-sm px-3 py-1.5 rounded border hover:bg-stone-50 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Load
        </button>
      </div>

      {message && (
        <div className="text-xs px-3 py-2 rounded bg-stone-100 text-stone-700">{message}</div>
      )}

      {candidates.length === 0 && metro && !loading && (
        <div className="text-xs text-stone-500 italic">
          No REBL-active sites loaded for this metro yet. Click Load to fetch candidates.
        </div>
      )}

      <form onSubmit={save} className="space-y-4 border rounded-lg p-4 bg-muted/30">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Primary long-term site
          </label>
          <select
            value={primaryLongTermSiteId}
            onChange={e => setPrimaryLongTermSiteId(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm bg-white"
            disabled={candidates.length === 0}
          >
            <option value="">— none —</option>
            {candidates.map(c => (
              <option key={c.id} value={c.id}>{formatOption(c)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Bridge site
          </label>
          <select
            value={bridgeSiteId}
            onChange={e => setBridgeSiteId(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm bg-white"
            disabled={candidates.length === 0}
          >
            <option value="">— none —</option>
            {candidates.map(c => (
              <option key={c.id} value={c.id}>{formatOption(c)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Watch sites ({watchSiteIds.length})
          </label>
          {watchCandidates.length === 0 ? (
            <p className="text-xs text-stone-500 italic">No additional candidates available.</p>
          ) : (
            <div className="border rounded bg-white max-h-48 overflow-y-auto p-2 space-y-1">
              {watchCandidates.map(c => (
                <label key={c.id} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-stone-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={watchSiteIds.includes(c.id)}
                    onChange={() => toggleWatch(c.id)}
                    className="mt-0.5"
                  />
                  <span>{formatOption(c)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Narrative override
          </label>
          <textarea
            value={narrativeOverride}
            onChange={e => setNarrativeOverride(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            rows={3}
            placeholder="Leave blank to use auto-generated narrative"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pivot conditions ({pivotConditions.length})
            </label>
            <button
              type="button"
              onClick={addPivotCondition}
              disabled={problems.length === 0}
              className="text-xs px-2 py-1 rounded border hover:bg-stone-50 inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          {problems.length === 0 ? (
            <p className="text-xs text-stone-500 italic">
              No problems posted in this metro yet. Create problems on the Problems tab first, then come back to link them here.
            </p>
          ) : pivotConditions.length === 0 ? (
            <p className="text-xs text-stone-500 italic">
              No pivot conditions yet. Click <strong>Add</strong> to link a problem whose resolution would change the plan.
            </p>
          ) : (
            <div className="space-y-2">
              {pivotConditions.map((c, i) => (
                <div key={i} className="border rounded bg-white p-2 space-y-2">
                  <div className="flex items-start gap-2">
                    <select
                      value={c.triggerProblemId}
                      onChange={e => updatePivotCondition(i, { triggerProblemId: e.target.value })}
                      className="flex-1 border rounded px-2 py-1 text-xs bg-white"
                    >
                      <option value="">— pick a problem —</option>
                      {problems.map(p => (
                        <option key={p.id} value={p.id}>
                          [{p.status}] {p.pivotTrigger ? "★ " : ""}{p.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removePivotCondition(i)}
                      className="text-xs text-red-600 hover:bg-red-50 p-1 rounded shrink-0"
                      title="Remove condition"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                  <textarea
                    value={c.description}
                    onChange={e => updatePivotCondition(i, { description: e.target.value })}
                    placeholder='What would change if this resolves? e.g. "If zoning is denied, we shift to 401 Congress as primary."'
                    className="w-full border rounded px-2 py-1 text-xs"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !metro}
          className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save plan"}
        </button>
      </form>
    </div>
  );
}
