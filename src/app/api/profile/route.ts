import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("pp_profiles")
    .select("display_name, home_address, home_lat, home_lng")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ display_name: null, home_address: null, home_lat: null, home_lng: null });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { display_name, home_address } = body as { display_name?: string; home_address?: string };

  let home_lat: number | null = null;
  let home_lng: number | null = null;

  if (home_address?.trim()) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (apiKey) {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(home_address)}&key=${apiKey}`;
      const res = await fetch(geocodeUrl);
      const geo = await res.json();
      if (geo.status === "OK" && geo.results?.[0]) {
        home_lat = geo.results[0].geometry.location.lat;
        home_lng = geo.results[0].geometry.location.lng;
      }
    }
  }

  const { data, error } = await supabase
    .from("pp_profiles")
    .upsert({
      id: user.id,
      display_name: display_name?.trim() || null,
      home_address: home_address?.trim() || null,
      home_lat,
      home_lng,
    }, { onConflict: "id" })
    .select("display_name, home_address, home_lat, home_lng")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
