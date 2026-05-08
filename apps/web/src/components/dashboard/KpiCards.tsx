"use client";

import { Calendar, AlertCircle, Activity, Wifi } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface Kpis {
    eventosHoy: number;
    pendientesSinAsignar: number;
    enProceso: number;
    agentesEnLinea: number;
}

interface KpiCardsProps {
    kpis: Kpis;
    agentesStale?: boolean;
}

export default function KpiCards({ kpis, agentesStale }: KpiCardsProps) {
    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
                label="Eventos hoy"
                value={kpis.eventosHoy}
                icon={Calendar}
            />
            <KpiCard
                label="Pendientes sin asignar"
                value={kpis.pendientesSinAsignar}
                icon={AlertCircle}
            />
            <KpiCard
                label="En proceso"
                value={kpis.enProceso}
                icon={Activity}
            />
            <KpiCard
                label="Agentes en línea"
                value={kpis.agentesEnLinea}
                icon={Wifi}
                hint={agentesStale ? "no actualizado" : undefined}
            />
        </div>
    );
}

interface KpiCardProps {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    hint?: string;
}

function KpiCard({ label, value, icon: Icon, hint }: KpiCardProps) {
    return (
        <Card>
            <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        {label}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold tabular-nums transition-all">
                    {value}
                </div>
                {hint && (
                    <span className="text-[10px] text-muted-foreground italic">
                        {hint}
                    </span>
                )}
            </CardContent>
        </Card>
    );
}
