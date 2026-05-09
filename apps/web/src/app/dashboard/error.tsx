"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[dashboard error]", error);
    }, [error]);

    return (
        <EmptyState
            icon={AlertTriangle}
            title="No pudimos cargar esta sección"
            description="Algo salió mal. Intenta de nuevo."
            action={
                <Button onClick={reset} className="mt-2">
                    Reintentar
                </Button>
            }
        />
    );
}
