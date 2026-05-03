import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Rol } from "@prisma/client";
import AdminDashboardClient from "@/components/AdminDashboardClient";

export default async function AdminDashboardPage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const decoded = await verifyToken(token);

    if (!decoded || decoded.rol !== Rol.ADMIN) {
        redirect("/dashboard/agent");
    }

    const eventos = await prisma.evento.findMany({
        orderBy: { createdAt: "desc" },
        include: { creador: true, asignado: true },
    });

    const socketUrl =
        process.env.SOCKET_SERVER_URL || "http://localhost:4000";

    return (
        <AdminDashboardClient
            initialEventos={eventos}
            socketUrl={socketUrl}
        />
    );
}
