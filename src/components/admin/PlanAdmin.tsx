"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function PlanAdmin({ token }: { token: string }) {
  const [metro, setMetro] = useState("");
  const [primaryLongTermSiteId, setPrimaryLongTermSiteId] = useState("");
  const [bridgeSiteId, setBridgeSiteId] = useState("");
  const [watchSiteIds, setWatchSiteIds] = useState("");  // comma-separated for simplicity
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
      const res = await fetch(`/api/metro/${encodeURIComponent(metro)}/plan`);
      if (!res.ok) {
        setMessage("Plan not found — fill in fields below to create a new one.");
        return;
      }
      const data = await res.json();
      if (!data) {
        setMessage("Plan not found — fill in fields below to create a new one.");
        return;
      }
      setPrimaryLongTermSiteId(data.narrativeTemplateInputs?.primaryLongTermSiteId ?? "");
      setBridgeSiteId(data.narrativeTemplateInputs?.bridgeSiteId ?? "");
      setWatchSiteIds((data.narrativeTemplateInputs?.watchSiteIds ?? []).join(", "));
      setNarrativeOverride(data.narrativeOverride ?? "");
      setPivotConditionsJson(JSON.stringify(data.pivotConditions ?? [], null, 2));
      setMessage(`Loaded plan (last curated ${new Date(data.lastCuratedAt).toLocaleString()})`);
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
      const watchList = watchSiteIds.split(",").map(s => s.trim()).filter(Boolean);
      const res = await fetch(`/api/admin/metro/${encodeURIComponent(metro)}/plan`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          narrativeTemplateInputs: {
            primaryLongTermSiteId: primaryLongTermSiteId || undefined,
            bridgeSiteId: bridgeSiteId || undefined,
            watchSiteIds: watchList.length > 0 ? watchList : undefined,
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

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          placeholder="Metro name (e.g. Austin)"
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

      <form onSubmit={save} className="space-y-3 border rounded-lg p-4 bg-muted/30">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary long-term site (UUID)</label>
          <input
            value={primaryLongTermSiteId}
            onChange={e => setPrimaryLongTermSiteId(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm font-mono"
            placeholder="optional"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bridge site (UUID)</label>
          <input
            value={bridgeSiteId}
            onChange={e => setBridgeSiteId(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm font-mono"
            placeholder="optional"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Watch sites (comma-separated UUIDs)</label>
          <input
            value={watchSiteIds}
            onChange={e => setWatchSiteIds(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm font-mono"
            placeholder="optional"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Narrative override</label>
          <textarea
            value={narrativeOverride}
            onChange={e => setNarrativeOverride(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            rows={3}
            placeholder="Leave blank to use auto-generated narrative"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pivot conditions (JSON array)</label>
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
