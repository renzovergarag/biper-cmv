"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import KpiCards, { type Kpis } from "./KpiCards";
import EventsAreaChart from "./EventsAreaChart";
import RecentEventsTable from "./RecentEventsTable";
import EventDetailModal from "@/components/EventDetailModal";
import type { EventoWithRelations } from "@/types";

interface AdminHomeClientProps {
    initialKpis: Kpis;
    initialAgentesStale: boolean;
    initialChartData: { date: string; count: number }[];
    initialRecentEventos: EventoWithRelations[];
    socketUrl: string;
}

export default function AdminHomeClient({
    initialKpis,
    initialAgentesStale,
    initialChartData,
    initialRecentEventos,
    socketUrl,
}: AdminHomeClientProps) {
    const [kpis, setKpis] = useState<Kpis>(initialKpis);
    const [agentesStale, setAgentesStale] = useState(initialAgentesStale);
    const [recent, setRecent] = useState(initialRecentEventos);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(
        null
    );
    const [modalOpen, setModalOpen] = useState(false);
    const { socket } = useSocket(socketUrl);
    const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const refetchKpis = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/stats/kpis", {
                cache: "no-store",
            });
            if (!res.ok) return;
            const data = (await res.json()) as Kpis;
            setKpis(data);
            setAgentesStale(res.headers.get("x-stale") === "agents-online");
        } catch (err) {
            console.error("refetchKpis:", err);
        }
    }, []);

    const scheduleRefetch = useCallback(() => {
        if (refetchTimer.current) clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(refetchKpis, 1000);
    }, [refetchKpis]);

    useEffect(() => {
        if (!socket) return;

        const handleNuevo = ({
            evento,
        }: {
            evento: EventoWithRelations;
        }) => {
            setRecent((prev) => [evento, ...prev].slice(0, 10));
            scheduleRefetch();
        };

        const handleActualizado = ({
            evento,
        }: {
            evento: EventoWithRelations;
        }) => {
            setRecent((prev) =>
                prev.map((e) => (e.id === evento.id ? evento : e))
            );
            scheduleRefetch();
        };

        const handleAgentesCambio = () => {
            scheduleRefetch();
        };

        socket.on("evento:nuevo", handleNuevo);
        socket.on("evento:actualizado", handleActualizado);
        socket.on("agentes:conectado", handleAgentesCambio);
        socket.on("agentes:desconectado", handleAgentesCambio);

        return () => {
            socket.off("evento:nuevo", handleNuevo);
            socket.off("evento:actualizado", handleActualizado);
            socket.off("agentes:conectado", handleAgentesCambio);
            socket.off("agentes:desconectado", handleAgentesCambio);
            if (refetchTimer.current) clearTimeout(refetchTimer.current);
        };
    }, [socket, scheduleRefetch]);

    useEffect(() => {
        const interval = setInterval(refetchKpis, 30_000);
        return () => clearInterval(interval);
    }, [refetchKpis]);

    function handleEventClick(eventoId: string) {
        setSelectedEventId(eventoId);
        setModalOpen(true);
    }

    function handleModalOpenChange(open: boolean) {
        setModalOpen(open);
        if (!open) setSelectedEventId(null);
    }

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                    Resumen de operación en tiempo real
                </p>
            </div>
            <KpiCards kpis={kpis} agentesStale={agentesStale} />
            <EventsAreaChart initialData={initialChartData} />
            <RecentEventsTable
                eventos={recent}
                onEventClick={handleEventClick}
            />
            <EventDetailModal
                eventoId={selectedEventId}
                open={modalOpen}
                onOpenChange={handleModalOpenChange}
                refreshVersion={0}
            />
        </div>
    );
}
