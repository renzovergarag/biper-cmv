import { BarChart3 } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export default function AdminReportsPage() {
    return (
        <EmptyState
            icon={BarChart3}
            title="Reportes"
            description="Próximamente"
        />
    );
}
