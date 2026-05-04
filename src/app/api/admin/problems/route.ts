import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin";

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
