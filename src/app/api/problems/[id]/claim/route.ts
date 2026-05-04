import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, generateProblemClaimedHtml } from "@/lib/email";

async function getUserFromAuth(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// POST → claim ownership
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: problemId } = await params;
  const user = await getUserFromAuth(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  // Already owned (active)?
  const { data: activeOwner } = await supabase
    .from("pp_problem_owners")
    .select("id, user_id")
    .eq("problem_id", problemId)
    .is("released_at", null)
    .maybeSingle();

  if (activeOwner) {
    if (activeOwner.user_id === user.id) {
      return NextResponse.json({ success: true, alreadyOwner: true });
    }
    return NextResponse.json({ error: "problem already claimed" }, { status: 409 });
  }

  // Insert ownership
  const { error: insertErr } = await supabase
    .from("pp_problem_owners")
    .insert({ problem_id: problemId, user_id: user.id });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Flip problem status to in_progress only if it was open
  await supabase
    .from("pp_site_problems")
    .update({ status: "in_progress" })
    .eq("id", problemId)
    .eq("status", "open");

  // Notify active champions of the related site that someone stepped up.
  try {
    const { data: problem } = await supabase
      .from("pp_site_problems")
      .select("id, site_id, title")
      .eq("id", problemId)
      .single();

    if (problem?.site_id) {
      const { data: location } = await supabase
        .from("pp_locations")
        .select("id, name, city, state")
        .eq("id", problem.site_id)
        .single();

      const { data: champions } = await supabase
        .from("pp_site_champions")
        .select("user_id")
        .eq("site_id", problem.site_id)
        .is("released_at", null);

      if (location && champions && champions.length > 0) {
        const { data: profile } = await supabase
          .from("pp_profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        const ownerName = profile?.display_name || user.email?.split("@")[0] || "A parent";

        const detailsUrl = `https://real-estate.alpha.school/?location=${location.id}`;
        const html = generateProblemClaimedHtml({
          problemTitle: problem.title,
          ownerName,
          location: { name: location.name, city: location.city, state: location.state },
          detailsUrl,
        });

        for (const champ of champions) {
          if (champ.user_id === user.id) continue; // don't email the claimer
          const { data: userData } = await supabase.auth.admin.getUserById(champ.user_id);
          const email = userData?.user?.email;
          if (email) {
            await sendEmail(email, `Update on a problem you're watching`, html);
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to send problem-claimed emails:", e);
  }

  return NextResponse.json({ success: true });
}

// DELETE → release ownership
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: problemId } = await params;
  const user = await getUserFromAuth(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const { data: existing } = await supabase
    .from("pp_problem_owners")
    .select("id")
    .eq("problem_id", problemId)
    .eq("user_id", user.id)
    .is("released_at", null)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "not the owner" }, { status: 404 });

  const releasedAt = new Date().toISOString();
  await supabase
    .from("pp_problem_owners")
    .update({ released_at: releasedAt })
    .eq("id", existing.id);

  // Flip problem status back to open if it was in_progress
  await supabase
    .from("pp_site_problems")
    .update({ status: "open" })
    .eq("id", problemId)
    .eq("status", "in_progress");

  return NextResponse.json({ success: true });
}
