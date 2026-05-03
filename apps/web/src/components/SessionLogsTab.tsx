"use client";

import { useState, useEffect, useCallback } from "react";
import type { LogSesion, UserListItem } from "@/types";

interface SessionLogsTabProps {
    usuarios: UserListItem[];
}

export default function SessionLogsTab({ usuarios }: SessionLogsTabProps) {
    const [logs, setLogs] = useState<LogSesion[]>([]);
    const [loading, setLoading] = useState(true);
    const [usuarioId, setUsuarioId] = useState("");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (usuarioId) params.set("usuarioId", usuarioId);
            if (fechaDesde) params.set("fechaDesde", new Date(fechaDesde).toISOString());
            if (fechaHasta) params.set("fechaHasta", new Date(fechaHasta + "T23:59:59").toISOString());
            params.set("limit", "100");

            const res = await fetch(`/api/admin/sessions?${params}`);
            if (res.ok) {
                const { data } = await res.json();
                setLogs(data);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [usuarioId, fechaDesde, fechaHasta]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const formatearFecha = (ts: string) =>
        new Date(ts).toLocaleString("es-CL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    return (
        <div>
            <div className="mb-4 flex flex-wrap gap-3 items-end">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        Agente
                    </label>
                    <select
                        value={usuarioId}
                        onChange={(e) => setUsuarioId(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="">Todos</option>
                        {usuarios
                            .filter((u) => u.rol === "AGENT")
                            .map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.nombre}
                                </option>
                            ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        Desde
                    </label>
                    <input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        Hasta
                    </label>
                    <input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={fetchLogs}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                >
                    Filtrar
                </button>
            </div>

            {loading ? (
                <p className="text-sm text-gray-400 py-4">Cargando...</p>
            ) : logs.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">
                    No hay registros de sesión
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                                <th className="px-4 py-2">Usuario</th>
                                <th className="px-4 py-2">Acción</th>
                                <th className="px-4 py-2">Fecha</th>
                                <th className="px-4 py-2">IP</th>
                                <th className="px-4 py-2">Navegador</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2">
                                        <div className="font-medium text-gray-900">
                                            {log.usuario?.nombre || "—"}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {log.usuario?.email || "—"}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                log.accion === "LOGIN"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                            }`}
                                        >
                                            {log.accion}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-500">
                                        {formatearFecha(log.timestamp)}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                                        {(log.detalle as Record<string, string>)?.ip ||
                                            "—"}
                                    </td>
                                    <td className="px-4 py-2 text-gray-400 text-xs max-w-[150px] truncate">
                                        {(log.detalle as Record<string, string>)
                                            ?.userAgent || "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
