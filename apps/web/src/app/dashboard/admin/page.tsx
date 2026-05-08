import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EstadoEvento, Rol } from "@prisma/client";
import { verifyToken, generateInternalToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminHomeClient from "@/components/dashboard/AdminHomeClient";

interface AgentsOnlineResponse {
    count: number;
}

async function fetchAgentsOnline(): Promise<{
    count: number;
    stale: boolean;
}> {
    try {
        const socketUrl =
            process.env.SOCKET_SERVER_INTERNAL_URL ||
            process.env.SOCKET_SERVER_URL ||
            "http://localhost:4000";
        const token = await generateInternalToken();
        const res = await fetch(`${socketUrl}/internal/agents-online`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });
        if (!res.ok) return { count: 0, stale: true };
        const data = (await res.json()) as AgentsOnlineResponse;
        return { count: data.count ?? 0, stale: false };
    } catch {
        return { count: 0, stale: true };
    }
}

function startOfDayUTC(d: Date): Date {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

async function fetchChartData(days: number) {
    const since = startOfDayUTC(new Date());
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const eventos = await prisma.evento.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
    });

    const today = startOfDayUTC(new Date());
    const series: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const day = new Date(today);
        day.setUTCDate(day.getUTCDate() - i);
        series.push({ date: isoDate(day), count: 0 });
    }
    const idx = new Map(series.map((s, i) => [s.date, i]));
    for (const e of eventos) {
        const key = isoDate(startOfDayUTC(e.createdAt));
        const i = idx.get(key);
        if (i !== undefined) series[i].count += 1;
    }
    return series;
}

export default async function AdminDashboardPage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== Rol.ADMIN) {
        redirect("/dashboard/agent");
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
        eventosHoy,
        pendientesSinAsignar,
        enProceso,
        agentes,
        chartData,
        recentEventos,
    ] = await Promise.all([
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
                    in: [EstadoEvento.ASIGNADO, EstadoEvento.EN_RUTA],
                },
            },
        }),
        fetchAgentsOnline(),
        fetchChartData(7),
        prisma.evento.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { creador: true, asignado: true },
        }),
    ]);

    const socketUrl =
        process.env.SOCKET_SERVER_URL || "http://localhost:4000";

    return (
        <AdminHomeClient
            initialKpis={{
                eventosHoy,
                pendientesSinAsignar,
                enProceso,
                agentesEnLinea: agentes.count,
            }}
            initialAgentesStale={agentes.stale}
            initialChartData={chartData}
            initialRecentEventos={recentEventos}
            socketUrl={socketUrl}
        />
    );
}
