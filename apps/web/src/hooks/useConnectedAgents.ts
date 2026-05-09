"use client";

import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { AgenteConectado } from "@/types";

export function useConnectedAgents(): AgenteConectado[] {
    const { token, isLoading } = useAuth();
    const [agentes, setAgentes] = useState<AgenteConectado[]>([]);

    const connect = useCallback(() => {
        if (!token) return undefined;
        const socketUrl =
            process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
        const s = io(socketUrl, { auth: { token } });

        s.on("agentes:lista", (data: AgenteConectado[]) =>
            setAgentes(data)
        );
        s.on("agentes:conectado", (data: AgenteConectado) => {
            setAgentes((prev) => {
                const filtered = prev.filter(
                    (a) => a.userId !== data.userId
                );
                return [...filtered, data];
            });
        });
        s.on("agentes:desconectado", (data: { userId: string }) => {
            setAgentes((prev) =>
                prev.filter((a) => a.userId !== data.userId)
            );
        });

        return s;
    }, [token]);

    useEffect(() => {
        if (isLoading) return;
        const s = connect();
        return () => {
            s?.disconnect();
        };
    }, [isLoading, connect]);

    return agentes;
}
