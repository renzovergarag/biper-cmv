"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { io, Socket } from "socket.io-client";
import type { AgenteConectado } from "@/types";

export default function ConnectedAgentsPanel() {
    const { user, token, isLoading } = useAuth();
    const [agentes, setAgentes] = useState<AgenteConectado[]>([]);

    const connectSocket = useCallback(() => {
        if (!token) return undefined;

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
        const s = io(socketUrl, { auth: { token } });

        s.on("connect", () => {
            s.on("agentes:lista", (data: AgenteConectado[]) => {
                setAgentes(data);
            });

            s.on("agentes:conectado", (data: AgenteConectado) => {
                setAgentes((prev) => {
                    const filtered = prev.filter((a) => a.userId !== data.userId);
                    return [...filtered, data];
                });
            });

            s.on("agentes:desconectado", (data: { userId: string }) => {
                setAgentes((prev) =>
                    prev.filter((a) => a.userId !== data.userId)
                );
            });
        });

        return s;
    }, [token]);

    useEffect(() => {
        if (isLoading) return;
        const s = connectSocket();
        return () => { s?.disconnect(); };
    }, [isLoading, connectSocket]);

    if (isLoading) return null;
    if (user?.rol !== "ADMIN") return null;

    return (
        <aside className="w-72 flex-shrink-0">
            <div className="sticky top-6">
                <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                        Agentes Conectados
                        <span className="ml-auto text-xs font-normal text-gray-400">
                            {agentes.length}
                        </span>
                    </h3>

                    {agentes.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                            Sin agentes conectados
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {agentes.map((agente) => (
                                <li
                                    key={agente.userId}
                                    className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                                >
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                        {agente.nombre
                                            .split(" ")
                                            .map((n: string) => n[0])
                                            .join("")
                                            .toUpperCase()
                                            .slice(0, 2)}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {agente.nombre}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {agente.email}
                                        </p>
                                    </div>
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </aside>
    );
}
