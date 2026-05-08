import { NextRequest, NextResponse } from "next/server";
import { EstadoEvento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { generateInternalToken } from "@/lib/auth";

interface AgentsOnlineResponse {
    count: number;
    agents: Array<{
        userId: string;
        email: string;
        nombre: string;
        connectedAt: string;
    }>;
}

async function fetchAgentsOnline(): Promise<{
    count: number;
    stale: boolean;
}> {
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
                `[stats/kpis] agents-online ${res.status} from ${url}: ${body.slice(0, 200)}`
            );
            return { count: 0, stale: true };
        }
        const data = (await res.json()) as AgentsOnlineResponse;
        return { count: data.count ?? 0, stale: false };
    } catch (err) {
        console.error(
            `[stats/kpis] fetch ${url} failed:`,
            err instanceof Error ? err.message : err
        );
        return { count: 0, stale: true };
    }
}

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [eventosHoy, pendientesSinAsignar, enProceso, agentes] =
            await Promise.all([
                prisma.evento.count({
                    where: { createdAt: { gte: startOfToday } },
                }),
                prisma.evento.count({
                    where: {
                        estado: EstadoEvento.PENDIENTE,
                        asignadoId: null,
                    },
                }),
                prisma.evento.count({
                    where: {
                        estado: {
                            in: [
                                EstadoEvento.ASIGNADO,
                                EstadoEvento.EN_RUTA,
                            ],
                        },
                    },
                }),
                fetchAgentsOnline(),
            ]);

        const response = NextResponse.json({
            eventosHoy,
            pendientesSinAsignar,
            enProceso,
            agentesEnLinea: agentes.count,
        });
        if (agentes.stale) {
            response.headers.set("x-stale", "agents-online");
        }
        return response;
    } catch (err) {
        console.error("[stats/kpis] error:", err);
        return NextResponse.json(
            { error: "Error al calcular KPIs" },
            { status: 500 }
        );
    }
}
