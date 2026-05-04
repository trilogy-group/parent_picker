import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const { data: rows, error } = await supabase
    .from("pp_site_problems")
    .select("id, site_id, metro, title, description, deadline, pivot_trigger, status, outcome_text, created_at, closed_at")
    .order("status", { ascending: true })
    .order("pivot_trigger", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows) return NextResponse.json([]);

  const siteIds = Array.from(new Set(rows.map(r => r.site_id).filter(Boolean) as string[]));
  const siteMap = new Map<string, { name: string; city: string; state: string }>();
  if (siteIds.length > 0) {
    const { data: sites } = await supabase
      .from("pp_locations")
      .select("id, name, city, state")
      .in("id", siteIds);
    for (const s of sites ?? []) {
      siteMap.set(s.id, { name: s.name, city: s.city, state: s.state });
    }
  }

  return NextResponse.json(rows.map(r => ({
    ...r,
    site: r.site_id ? siteMap.get(r.site_id) ?? null : null,
  })));
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { siteId, metro, title, description, deadline, pivotTrigger } = body as {
    siteId?: string | null;
    metro?: string;
    title?: string;
    description?: string;
    deadline?: string;
    pivotTrigger?: boolean;
  };

  if (!metro || !title) {
    return NextResponse.json({ error: "metro and title required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const { data, error } = await supabase
    .from("pp_site_problems")
    .insert({
      site_id: siteId ?? null,
      metro,
      title,
      description: description ?? null,
      deadline: deadline ?? null,
      pivot_trigger: pivotTrigger ?? false,
      created_by: auth.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, problem: data });
}
