import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Rol } from "@prisma/client";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import ChangePasswordModal from "@/components/ChangePasswordModal";

export default async function AgentProfilePage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== Rol.AGENT) {
        redirect("/dashboard");
    }

    const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { nombre: true, email: true },
    });
    if (!user) redirect("/login");

    return (
        <div className="space-y-4 max-w-lg">
            <div>
                <h1 className="text-2xl font-bold">Mi perfil</h1>
                <p className="text-sm text-muted-foreground">
                    Datos de tu cuenta
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Información</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                            Nombre
                        </Label>
                        <p className="text-sm">{user.nombre}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                            Email
                        </Label>
                        <p className="text-sm">{user.email}</p>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Seguridad</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChangePasswordModal />
                </CardContent>
            </Card>
        </div>
    );
}
