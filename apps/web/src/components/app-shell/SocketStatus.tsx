"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/components/providers/AuthProvider";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type Status = "connected" | "connecting" | "disconnected";

const statusInfo: Record<Status, { color: string; label: string }> = {
    connected: { color: "bg-green-500", label: "Tiempo real conectado" },
    connecting: { color: "bg-amber-500", label: "Reconectando…" },
    disconnected: { color: "bg-red-500", label: "Sin conexión" },
};

export default function SocketStatus() {
    const { token, isLoading } = useAuth();
    const [status, setStatus] = useState<Status>("connecting");

    useEffect(() => {
        if (isLoading || !token) return;
        const socketUrl =
            process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
        const s: Socket = io(socketUrl, { auth: { token } });

        s.on("connect", () => setStatus("connected"));
        s.on("disconnect", () => setStatus("disconnected"));
        s.io.on("reconnect_attempt", () => setStatus("connecting"));
        s.io.on("error", () => setStatus("disconnected"));

        return () => {
            s.disconnect();
        };
    }, [token, isLoading]);

    if (isLoading || !token) return null;

    const info = statusInfo[status];

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className="flex h-2 w-2 rounded-full mr-2"
                        aria-label={info.label}
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${info.color}`}
                        />
                    </span>
                </TooltipTrigger>
                <TooltipContent>{info.label}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
