import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { MetroPlan } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ metro: string }> }
) {
  const { metro } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json(null);

  const { data } = await supabase
    .from("pp_plan_of_record")
    .select("metro, narrative_template_inputs, pivot_conditions, narrative_override, last_curated_at")
    .eq("metro", decodeURIComponent(metro))
    .maybeSingle();

  if (!data) return NextResponse.json(null);

  const plan: MetroPlan = {
    metro: data.metro,
    narrativeTemplateInputs: data.narrative_template_inputs ?? {},
    pivotConditions: data.pivot_conditions ?? [],
    narrativeOverride: data.narrative_override,
    lastCuratedAt: data.last_curated_at,
  };
  return NextResponse.json(plan);
}
