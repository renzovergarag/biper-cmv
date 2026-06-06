"use client";

import { useState } from "react";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";

function esIOS(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function esStandalone(): boolean {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean })
            .standalone === true
    );
}

export default function PushNotificationsBanner() {
    const { estado, soportado, activar } = usePushSubscription();
    const [oculto, setOculto] = useState(false);

    if (oculto || !soportado || estado === "suscrito" || estado === "cargando") {
        return null;
    }

    const iosSinInstalar = esIOS() && !esStandalone();

    return (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="flex items-start gap-2">
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1">
                    {estado === "bloqueado" ? (
                        <p>
                            Las notificaciones están bloqueadas. Actívalas en
                            los ajustes de tu navegador para recibir avisos de
                            nuevos eventos.
                        </p>
                    ) : iosSinInstalar ? (
                        <p>
                            Para recibir avisos con el teléfono bloqueado: toca{" "}
                            <strong>Compartir</strong> y luego{" "}
                            <strong>Agregar a inicio</strong>. Abre la app desde
                            el ícono y activa las notificaciones.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <p>
                                Activa las notificaciones para enterarte de
                                nuevos eventos aunque tengas el teléfono
                                bloqueado.
                            </p>
                            <Button size="sm" onClick={() => void activar()}>
                                Activar notificaciones
                            </Button>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setOculto(true)}
                    aria-label="Cerrar"
                    className="text-muted-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
