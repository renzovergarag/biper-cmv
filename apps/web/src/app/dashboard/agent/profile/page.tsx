import { User as UserIcon } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export default function AgentProfilePage() {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Mi perfil</h1>
                <p className="text-sm text-muted-foreground">
                    Datos de tu cuenta
                </p>
            </div>
            <EmptyState
                icon={UserIcon}
                title="Próximamente"
                description="Aquí podrás ver tus datos y cambiar tu contraseña"
            />
        </div>
    );
}
