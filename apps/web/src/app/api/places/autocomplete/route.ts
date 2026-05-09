import { NextResponse } from "next/server";
import { autocomplete, PlacesError } from "@/lib/places";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "places-autocomplete", 60, 60_000);
  if (!rl.allowed) {
    console.warn("[places/autocomplete] rate-limited", ip);
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const sessionToken = url.searchParams.get("sessionToken") ?? "";

  if (q.length < 3) {
    return NextResponse.json({ error: "q_too_short" }, { status: 400 });
  }

  if (!sessionToken) {
    console.warn("[places/autocomplete] missing sessionToken");
  }

  try {
    const suggestions = await autocomplete(q, sessionToken || crypto.randomUUID());
    return NextResponse.json({ suggestions });
  } catch (err) {
    const status = err instanceof PlacesError ? err.status : 503;
    console.error("[places/autocomplete] error", err);
    return NextResponse.json({ error: "places_failed" }, { status });
  }
}
