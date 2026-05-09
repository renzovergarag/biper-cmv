"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { AgentList } from "@/components/ConnectedAgentsPanel";
import { useConnectedAgents } from "@/hooks/useConnectedAgents";

export default function AdminAgentsPage() {
    const agentes = useConnectedAgents();

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Agentes en línea</h1>
                <p className="text-sm text-muted-foreground">
                    {agentes.length === 0
                        ? "Sin agentes conectados"
                        : `${agentes.length} agente${agentes.length === 1 ? "" : "s"} conectado${agentes.length === 1 ? "" : "s"}`}
                </p>
            </div>
            {agentes.length === 0 ? (
                <EmptyState
                    icon={Wifi}
                    title="No hay agentes conectados en este momento"
                />
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                            </span>
                            Conectados ahora
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AgentList agentes={agentes} />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
