import ConnectedAgentsPanel from "@/components/ConnectedAgentsPanel";

export default function AdminAgentsPage() {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Agentes en línea</h1>
                <p className="text-sm text-muted-foreground">
                    Lista de agentes con sesión activa
                </p>
            </div>
            <ConnectedAgentsPanel />
        </div>
    );
}
