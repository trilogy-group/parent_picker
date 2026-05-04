import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SiteChampion } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json([]);

  const { data, error } = await supabaseAdmin
    .from("pp_site_champions")
    .select("id, site_id, user_id, role, claimed_at, released_at, passed_to_user_id")
    .eq("site_id", id)
    .is("released_at", null)
    .order("claimed_at", { ascending: true });

  if (error) return NextResponse.json([], { status: 500 });

  const champions: SiteChampion[] = (data ?? []).map(c => ({
    id: c.id,
    siteId: c.site_id,
    userId: c.user_id,
    role: c.role as 'lead' | 'supporter',
    claimedAt: c.claimed_at,
    releasedAt: c.released_at,
    passedToUserId: c.passed_to_user_id,
  }));

  return NextResponse.json(champions);
}
