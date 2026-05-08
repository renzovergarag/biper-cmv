import { NextResponse } from "next/server";
import { placeDetails, PlacesError } from "@/lib/places";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "places-details", 20, 60_000);
  if (!rl.allowed) {
    console.warn("[places/details] rate-limited", ip);
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const url = new URL(req.url);
  const placeId = url.searchParams.get("placeId")?.trim() ?? "";
  const sessionToken = url.searchParams.get("sessionToken") ?? "";

  if (!placeId) {
    return NextResponse.json({ error: "placeId_required" }, { status: 400 });
  }

  if (!sessionToken) {
    console.warn("[places/details] missing sessionToken");
  }

  try {
    const details = await placeDetails(placeId, sessionToken || crypto.randomUUID());
    return NextResponse.json(details);
  } catch (err) {
    const status = err instanceof PlacesError ? err.status : 503;
    console.error("[places/details] error", err);
    return NextResponse.json(
      { error: status === 404 ? "place_not_found" : "places_failed" },
      { status }
    );
  }
}
