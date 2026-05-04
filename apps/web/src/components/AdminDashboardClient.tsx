"use client";

import { useState, useEffect } from "react";
import { EventoWithRelations } from "@/types";
import { useSocket } from "@/hooks/useSocket";
import { Badge } from "@/components/ui/badge";
import CreateEventModal from "./CreateEventModal";
import EventList from "./EventList";
import EventDetailModal from "./EventDetailModal";

interface AdminDashboardClientProps {
    initialEventos: EventoWithRelations[];
    socketUrl: string;
}

export default function AdminDashboardClient({
    initialEventos,
    socketUrl,
}: AdminDashboardClientProps) {
    const [eventos, setEventos] =
        useState<EventoWithRelations[]>(initialEventos);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const { socket, connected } = useSocket(socketUrl);

    function handleEventCreated(evento: EventoWithRelations) {
        setEventos((prev) => [evento, ...prev]);
    }

    function handleEventClick(eventoId: string) {
        setSelectedEventId(eventoId);
        setModalOpen(true);
    }

    function handleModalOpenChange(open: boolean) {
        setModalOpen(open);
        if (!open) {
            setSelectedEventId(null);
        }
    }

    useEffect(() => {
        if (!socket) return;

        const handleNuevo = ({ evento }: { evento: EventoWithRelations }) => {
            setEventos((prev) => [evento, ...prev]);
        };

        const handleActualizado = ({
            evento,
        }: {
            evento: EventoWithRelations;
        }) => {
            setEventos((prev) =>
                prev.map((e) => (e.id === evento.id ? evento : e))
            );

            if (selectedEventId === evento.id) {
                setRefreshVersion((v) => v + 1);
            }
        };

        socket.on("evento:nuevo", handleNuevo);
        socket.on("evento:actualizado", handleActualizado);

        return () => {
            socket.off("evento:nuevo", handleNuevo);
            socket.off("evento:actualizado", handleActualizado);
        };
    }, [socket, selectedEventId]);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-foreground">
                        Panel de Administración
                    </h2>
                    {connected && (
                        <Badge
                            variant="outline"
                            className="gap-1.5 border-green-300 text-green-700"
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Tiempo real conectado
                        </Badge>
                    )}
                </div>
                <CreateEventModal onEventCreated={handleEventCreated} />
            </div>

            <EventList eventos={eventos} onEventClick={handleEventClick} />

            <EventDetailModal
                eventoId={selectedEventId}
                open={modalOpen}
                onOpenChange={handleModalOpenChange}
                refreshVersion={refreshVersion}
            />
        </div>
    );
}
