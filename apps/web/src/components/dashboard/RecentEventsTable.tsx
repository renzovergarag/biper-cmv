"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import EventList from "@/components/EventList";
import type { EventoWithRelations } from "@/types";

interface RecentEventsTableProps {
    eventos: EventoWithRelations[];
    onEventClick?: (eventoId: string) => void;
}

export default function RecentEventsTable({
    eventos,
    onEventClick,
}: RecentEventsTableProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                    Eventos recientes
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/admin/events">
                        Ver todos
                        <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                <EventList
                    eventos={eventos}
                    onEventClick={onEventClick}
                    variant="compact"
                />
            </CardContent>
        </Card>
    );
}
