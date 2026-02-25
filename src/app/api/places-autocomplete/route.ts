import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("input");
  if (!input || input.length < 3) {
    return NextResponse.json({ predictions: [] });
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) {
    return NextResponse.json({ predictions: [] });
  }

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:us&key=${key}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status === "OK") {
    return NextResponse.json({
      predictions: data.predictions.map((p: { description: string; place_id: string }) => ({
        description: p.description,
        place_id: p.place_id,
      })),
    });
  }

  return NextResponse.json({ predictions: [] });
}
