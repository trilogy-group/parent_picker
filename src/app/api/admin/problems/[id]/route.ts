import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin";
import { sendEmail, generateProblemResolvedHtml } from "@/lib/email";

const ALLOWED_KEYS = new Set([
  "title", "description", "deadline", "pivot_trigger",
  "status", "outcome_text",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_KEYS.has(k)) updates[k] = v;
  }
  if (body.status === "resolved" || body.status === "unresolvable") {
    updates.closed_at = new Date().toISOString();
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const { error } = await supabase
    .from("pp_site_problems")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify owner + champions when a problem is resolved with an outcome.
  if (body.status === "resolved" && body.outcome_text) {
    try {
      const { data: problem } = await supabase
        .from("pp_site_problems")
        .select("id, site_id, title, outcome_text")
        .eq("id", id)
        .single();

      if (problem?.site_id) {
        const { data: location } = await supabase
          .from("pp_locations")
          .select("id, name, city, state")
          .eq("id", problem.site_id)
          .single();

        const recipientUserIds = new Set<string>();
        const { data: owners } = await supabase
          .from("pp_problem_owners")
          .select("user_id")
          .eq("problem_id", id)
          .order("released_at", { ascending: false, nullsFirst: false });
        if (owners?.[0]?.user_id) recipientUserIds.add(owners[0].user_id);

        const { data: champions } = await supabase
          .from("pp_site_champions")
          .select("user_id")
          .eq("site_id", problem.site_id)
          .is("released_at", null);
        for (const c of champions ?? []) recipientUserIds.add(c.user_id);

        if (location && recipientUserIds.size > 0) {
          const detailsUrl = `https://real-estate.alpha.school/?location=${location.id}`;
          const html = generateProblemResolvedHtml({
            problemTitle: problem.title,
            outcome: body.outcome_text,
            location: { name: location.name, city: location.city, state: location.state },
            detailsUrl,
          });
          for (const uid of recipientUserIds) {
            const { data: userData } = await supabase.auth.admin.getUserById(uid);
            const email = userData?.user?.email;
            if (email) {
              await sendEmail(email, `Resolved: ${problem.title}`, html);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to send problem-resolved emails:", e);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const { error } = await supabase
    .from("pp_site_problems")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
