"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

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
  const [primaryLongTermSiteId, setPrimaryLongTermSiteId] = useState("");
  const [bridgeSiteId, setBridgeSiteId] = useState("");
  const [watchSiteIds, setWatchSiteIds] = useState<string[]>([]);
  const [narrativeOverride, setNarrativeOverride] = useState("");
  const [pivotConditionsJson, setPivotConditionsJson] = useState("[]");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!metro) return;
    setLoading(true);
    setMessage(null);
    try {
      // Load candidates and existing plan in parallel.
      const [candidatesRes, planRes] = await Promise.all([
        fetch(`/api/admin/metro/${encodeURIComponent(metro)}/candidates`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/metro/${encodeURIComponent(metro)}/plan`),
      ]);

      const candidatesList: Candidate[] = candidatesRes.ok ? await candidatesRes.json() : [];
      setCandidates(candidatesList);

      const planData = planRes.ok ? await planRes.json() : null;
      if (planData) {
        setPrimaryLongTermSiteId(planData.narrativeTemplateInputs?.primaryLongTermSiteId ?? "");
        setBridgeSiteId(planData.narrativeTemplateInputs?.bridgeSiteId ?? "");
        setWatchSiteIds(planData.narrativeTemplateInputs?.watchSiteIds ?? []);
        setNarrativeOverride(planData.narrativeOverride ?? "");
        setPivotConditionsJson(JSON.stringify(planData.pivotConditions ?? [], null, 2));
        setMessage(`Loaded plan (last curated ${new Date(planData.lastCuratedAt).toLocaleString()}). ${candidatesList.length} candidate sites in this metro.`);
      } else {
        setPrimaryLongTermSiteId("");
        setBridgeSiteId("");
        setWatchSiteIds([]);
        setNarrativeOverride("");
        setPivotConditionsJson("[]");
        setMessage(`No plan curated yet. ${candidatesList.length} candidate sites in this metro.`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!metro) return;
    let pivotConditions: unknown[] = [];
    try {
      pivotConditions = JSON.parse(pivotConditionsJson);
      if (!Array.isArray(pivotConditions)) throw new Error("pivot_conditions must be an array");
    } catch {
      setMessage("Pivot conditions must be valid JSON array.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/metro/${encodeURIComponent(metro)}/plan`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          narrativeTemplateInputs: {
            primaryLongTermSiteId: primaryLongTermSiteId || undefined,
            bridgeSiteId: bridgeSiteId || undefined,
            watchSiteIds: watchSiteIds.length > 0 ? watchSiteIds : undefined,
          },
          pivotConditions,
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
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Pivot conditions (JSON array)
          </label>
          <textarea
            value={pivotConditionsJson}
            onChange={e => setPivotConditionsJson(e.target.value)}
            className="w-full border rounded px-2 py-1 text-xs font-mono"
            rows={5}
            placeholder='[{"triggerProblemId": "uuid", "description": "..."}]'
          />
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
