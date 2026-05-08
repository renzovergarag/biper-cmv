"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
            if (usuarioId && usuarioId !== "todos") {
                params.set("usuarioId", usuarioId);
            }
            if (fechaDesde) {
                params.set(
                    "fechaDesde",
                    new Date(fechaDesde + "T00:00:00").toISOString()
                );
            }
            if (fechaHasta) {
                params.set(
                    "fechaHasta",
                    new Date(fechaHasta + "T23:59:59.999").toISOString()
                );
            }
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
                <div className="space-y-1">
                    <Label className="text-xs">Usuario</Label>
                    <Select value={usuarioId} onValueChange={setUsuarioId}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            {usuarios.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                    {u.nombre}{" "}
                                    <span className="text-muted-foreground text-xs">
                                        ({u.rol})
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        className="w-[160px]"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        className="w-[160px]"
                    />
                </div>
                <Button onClick={fetchLogs} size="sm">
                    Filtrar
                </Button>
            </div>

            {loading ? (
                <p className="text-sm text-muted-foreground py-4">Cargando...</p>
            ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                    No hay registros de sesión
                </p>
            ) : (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Acción</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>IP</TableHead>
                                <TableHead>Navegador</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        <div className="font-medium text-foreground">
                                            {log.usuario?.nombre || "—"}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {log.usuario?.email || "—"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                log.accion === "LOGIN"
                                                    ? "default"
                                                    : "destructive"
                                            }
                                            className={
                                                log.accion === "LOGIN"
                                                    ? "bg-green-100 text-green-700 hover:bg-green-100"
                                                    : ""
                                            }
                                        >
                                            {log.accion}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatearFecha(log.timestamp)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">
                                        {(log.detalle as Record<string, string>)?.ip ||
                                            "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">
                                        {(log.detalle as Record<string, string>)
                                            ?.userAgent || "—"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
