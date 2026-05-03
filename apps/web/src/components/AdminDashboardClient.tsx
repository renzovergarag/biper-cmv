"use client";

import { useState } from "react";
import { EventoWithRelations } from "@/types";
import { useSocket } from "@/hooks/useSocket";
import { Badge } from "@/components/ui/badge";
import CreateEventModal from "./CreateEventModal";
import EventList from "./EventList";

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
    const { connected } = useSocket(socketUrl);

    function handleEventCreated(evento: EventoWithRelations) {
        setEventos((prev) => [evento, ...prev]);
    }

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

            <EventList eventos={eventos} />
        </div>
    );
}
