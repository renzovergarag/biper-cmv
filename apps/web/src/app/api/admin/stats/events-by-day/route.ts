import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

type CacheEntry = {
    expiresAt: number;
    data: { date: string; count: number }[];
};

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function startOfDayUTC(d: Date): Date {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function buildSeries(
    eventos: { createdAt: Date }[],
    days: number
): { date: string; count: number }[] {
    const today = startOfDayUTC(new Date());
    const series: { date: string; count: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
        const day = new Date(today);
        day.setUTCDate(day.getUTCDate() - i);
        series.push({ date: isoDate(day), count: 0 });
    }

    const indexByDate = new Map(series.map((s, i) => [s.date, i]));

    for (const e of eventos) {
        const key = isoDate(startOfDayUTC(e.createdAt));
        const idx = indexByDate.get(key);
        if (idx !== undefined) series[idx].count += 1;
    }

    return series;
}

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const rangeRaw = url.searchParams.get("range");
    const days =
        rangeRaw === "30" ? 30 : rangeRaw === "7" ? 7 : 7;
    const cacheKey = `events-by-day:${days}`;

    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json({ data: cached.data });
    }

    try {
        const since = startOfDayUTC(new Date());
        since.setUTCDate(since.getUTCDate() - (days - 1));

        const eventos = await prisma.evento.findMany({
            where: { createdAt: { gte: since } },
            select: { createdAt: true },
        });

        const data = buildSeries(eventos, days);
        cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, data });

        return NextResponse.json({ data });
    } catch (err) {
        console.error("[stats/events-by-day] error:", err);
        return NextResponse.json(
            { error: "Error al construir serie" },
            { status: 500 }
        );
    }
}
