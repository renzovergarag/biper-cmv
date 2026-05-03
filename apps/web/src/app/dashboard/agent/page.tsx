import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AgentDashboardClient from "@/components/AgentDashboardClient";

export default async function AgentDashboardPage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) redirect("/login");

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== "AGENT") redirect("/dashboard");

    const eventos = await prisma.evento.findMany({
        where: { asignadoId: decoded.sub },
        orderBy: { createdAt: "desc" },
        include: { creador: true, asignado: true },
    });

    return (
        <AgentDashboardClient
            initialEventos={eventos}
            userId={decoded.sub}
            socketUrl={
                process.env.SOCKET_SERVER_URL || "http://localhost:4000"
            }
        />
    );
}
