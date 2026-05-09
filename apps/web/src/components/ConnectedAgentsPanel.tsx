"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { AgenteConectado } from "@/types";
import { useConnectedAgents } from "@/hooks/useConnectedAgents";

export function AgentList({ agentes }: { agentes: AgenteConectado[] }) {
    if (agentes.length === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-4">
                Sin agentes conectados
            </p>
        );
    }

    return (
        <ul className="space-y-2">
            {agentes.map((agente) => (
                <li
                    key={agente.userId}
                    className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent transition-colors"
                >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {agente.nombre
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                            {agente.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {agente.email}
                        </p>
                    </div>
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                </li>
            ))}
        </ul>
    );
}

export default function ConnectedAgentsPanel() {
    const { user, isLoading } = useAuth();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const agentes = useConnectedAgents();

    if (isLoading) return null;
    if (user?.rol !== "ADMIN") return null;

    return (
        <>
            {/* --- Desktop: panel inline (&ge;1024px) --- */}
            <aside className="w-72 flex-shrink-0 hidden lg:block">
                <Card className="sticky top-6">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                            </span>
                            Agentes Conectados
                            <span className="ml-auto text-xs font-normal text-muted-foreground">
                                {agentes.length}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AgentList agentes={agentes} />
                    </CardContent>
                </Card>
            </aside>

            {/* --- Mobile/Tablet: FAB flotante + Bottom Sheet (<1024px) --- */}
            <div className="lg:hidden">
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button
                            size="icon"
                            className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg"
                            aria-label="Ver agentes conectados"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="lucide lucide-users"
                            >
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 shadow-sm">
                                {agentes.length}
                            </span>
                            {agentes.length > 0 && (
                                <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                                </span>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="bottom"
                        className="max-h-[70vh] rounded-t-2xl px-4 pb-8"
                    >
                        {/* Drag handle visual */}
                        <div className="flex justify-center pt-2 pb-4">
                            <div className="w-10 h-1 rounded-full bg-border" />
                        </div>
                        <SheetHeader className="text-left mb-4">
                            <SheetTitle className="text-base flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                </span>
                                Agentes Conectados
                                <span className="ml-auto text-sm font-normal text-muted-foreground">
                                    {agentes.length}
                                </span>
                            </SheetTitle>
                            <SheetDescription className="sr-only">
                                Lista de agentes actualmente conectados al sistema
                            </SheetDescription>
                        </SheetHeader>
                        <AgentList agentes={agentes} />
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
