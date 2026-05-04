import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ metro: string }> }
) {
  const { metro } = await params;
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const {
    narrativeTemplateInputs,
    pivotConditions,
    narrativeOverride,
  } = body as {
    narrativeTemplateInputs?: Record<string, unknown>;
    pivotConditions?: unknown[];
    narrativeOverride?: string | null;
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const decodedMetro = decodeURIComponent(metro);

  const { error } = await supabase
    .from("pp_plan_of_record")
    .upsert({
      metro: decodedMetro,
      narrative_template_inputs: narrativeTemplateInputs ?? {},
      pivot_conditions: pivotConditions ?? [],
      narrative_override: narrativeOverride ?? null,
      last_curated_at: new Date().toISOString(),
      last_curated_by: auth.userId,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
