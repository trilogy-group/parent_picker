import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdmin } from "@/lib/admin";
import { sendEmail, generateProblemResolvedHtml } from "@/lib/email";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await verifyAdmin(request.headers.get("authorization"));
  if (!auth.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  let adminEdited = false;

  // Curation fields — set admin_edited_at when any are present.
  if (typeof body.title === "string") {
    updates.title = body.title;
    adminEdited = true;
  }
  if (typeof body.description === "string" || body.description === null) {
    updates.description = body.description;
    adminEdited = true;
  }
  if (typeof body.parentOwnable === "boolean") {
    updates.parent_ownable = body.parentOwnable;
    adminEdited = true;
  }
  if (body.category && (['zoning', 'licensing', 'other'] as const).includes(body.category)) {
    updates.category = body.category;
    adminEdited = true;
  }
  if (body.severity && (['H', 'M', 'L'] as const).includes(body.severity)) {
    updates.severity = body.severity;
    adminEdited = true;
  }

  // Operational fields — do NOT trigger admin_edited_at.
  // Accept both camelCase (new) and snake_case (legacy clients).
  if (typeof body.status === "string") updates.status = body.status;
  if (typeof body.outcomeText === "string" || body.outcomeText === null) {
    updates.outcome_text = body.outcomeText;
  } else if (typeof body.outcome_text === "string" || body.outcome_text === null) {
    updates.outcome_text = body.outcome_text;
  }
  if (typeof body.pivotTrigger === "boolean") {
    updates.pivot_trigger = body.pivotTrigger;
  } else if (typeof body.pivot_trigger === "boolean") {
    updates.pivot_trigger = body.pivot_trigger;
  }
  if (typeof body.deadline === "string" || body.deadline === null) updates.deadline = body.deadline;

  if (adminEdited) updates.admin_edited_at = new Date().toISOString();

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
  const resolvedOutcome = body.outcomeText ?? body.outcome_text;
  if (body.status === "resolved" && resolvedOutcome) {
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
            outcome: resolvedOutcome,
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
