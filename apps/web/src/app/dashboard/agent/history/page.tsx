import { History } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export default function AgentHistoryPage() {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Historial</h1>
                <p className="text-sm text-muted-foreground">
                    Eventos resueltos o cancelados
                </p>
            </div>
            <EmptyState
                icon={History}
                title="Aún no has cerrado eventos"
            />
        </div>
    );
}
