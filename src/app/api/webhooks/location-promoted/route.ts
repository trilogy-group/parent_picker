import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const locationId: string | undefined = body?.location_id;
  if (!locationId) {
    return NextResponse.json({ error: "location_id required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: loc } = await supabase
    .from("pp_locations")
    .select("address, city, state, rebl3_site_id, feedback_deadline")
    .eq("id", locationId)
    .single();

  if (!loc) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const deadline = loc.feedback_deadline
    ? new Date(loc.feedback_deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "unknown";

  const driveFolder = "https://drive.google.com/drive/folders/1JmePyYxZf5aZ9cu-SZqzQGRMuEYo2YFB";
  const detailUrl = `https://real-estate.alpha.school/location/${locationId}`;

  const html = `
    <h2>New Location Promoted for Parent Feedback</h2>
    <p><strong>${loc.address}, ${loc.city}, ${loc.state}</strong></p>
    <p>Feedback deadline: <strong>${deadline}</strong></p>
    <p>This location needs brochure photos. Check the
      <a href="${driveFolder}">Google Drive folder</a> for a brochure PDF,
      then run <code>/add-proposed-location</code> in Claude Code to extract and upload photos.</p>
    <p><a href="${detailUrl}">View detail page</a></p>
  `;

  await sendEmail(
    "andy.price@trilogy.com",
    `Location promoted: ${loc.address}, ${loc.city} — needs brochure photos`,
    html,
  );

  return NextResponse.json({ ok: true });
}
