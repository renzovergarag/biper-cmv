import { Settings as SettingsIcon } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export default function AdminSettingsPage() {
    return (
        <EmptyState
            icon={SettingsIcon}
            title="Configuración"
            description="Próximamente"
        />
    );
}
