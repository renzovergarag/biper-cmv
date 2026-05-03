"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LogOut } from "lucide-react";

export default function Navigation() {
    const { user, logout, isLoading } = useAuth();

    if (isLoading) {
        return null;
    }

    return (
        <header className="border-b bg-background">
            <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
                <h1 className="text-xl font-semibold text-foreground">
                    BIPER CMV
                </h1>
                {user && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                {user.nombre}
                            </span>
                            <Badge variant="secondary">{user.rol}</Badge>
                        </div>
                        <Separator orientation="vertical" className="h-8" />
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={logout}
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Cerrar sesión
                        </Button>
                    </div>
                )}
            </div>
        </header>
    );
}
