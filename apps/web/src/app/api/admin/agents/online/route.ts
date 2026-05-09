import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { generateInternalToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const socketUrl =
        process.env.SOCKET_SERVER_INTERNAL_URL ||
        process.env.SOCKET_SERVER_URL ||
        "http://localhost:4000";
    const url = `${socketUrl}/internal/agents-online`;

    try {
        const token = await generateInternalToken();
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "<unreadable>");
            console.error(
                `[admin/agents/online] ${res.status} from ${url}: ${body.slice(0, 200)}`
            );
            const fallback = NextResponse.json({ count: 0, agents: [] });
            fallback.headers.set("x-stale", "agents-online");
            return fallback;
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error(
            `[admin/agents/online] fetch ${url} failed:`,
            err instanceof Error ? err.message : err
        );
        const fallback = NextResponse.json({ count: 0, agents: [] });
        fallback.headers.set("x-stale", "agents-online");
        return fallback;
    }
}
