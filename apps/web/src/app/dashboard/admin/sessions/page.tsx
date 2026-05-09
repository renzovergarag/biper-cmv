import { prisma } from "@/lib/prisma";
import SessionLogsTab from "@/components/SessionLogsTab";
import type { UserListItem } from "@/types";

export default async function AdminSessionsPage() {
    const usuarios = await prisma.user.findMany({
        select: { id: true, email: true, nombre: true, rol: true, activo: true },
        orderBy: { nombre: "asc" },
    });

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Sesiones</h1>
                <p className="text-sm text-muted-foreground">
                    Registro de inicios y cierres de sesión
                </p>
            </div>
            <SessionLogsTab usuarios={usuarios as UserListItem[]} />
        </div>
    );
}
