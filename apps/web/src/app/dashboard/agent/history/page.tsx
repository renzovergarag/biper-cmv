import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EstadoEvento, Rol } from "@prisma/client";
import { History } from "lucide-react";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EventList from "@/components/EventList";
import EmptyState from "@/components/EmptyState";

export default async function AgentHistoryPage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== Rol.AGENT) {
        redirect("/dashboard");
    }

    const eventos = await prisma.evento.findMany({
        where: {
            asignadoId: decoded.sub,
            estado: {
                in: [EstadoEvento.RESUELTO, EstadoEvento.CANCELADO],
            },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: { creador: true, asignado: true },
    });

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Historial</h1>
                <p className="text-sm text-muted-foreground">
                    Eventos resueltos o cancelados
                </p>
            </div>
            {eventos.length === 0 ? (
                <EmptyState
                    icon={History}
                    title="Aún no has cerrado eventos"
                />
            ) : (
                <EventList eventos={eventos} />
            )}
        </div>
    );
}
