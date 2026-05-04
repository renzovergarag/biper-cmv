"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Evento } from "@/types";
import { NivelUrgencia } from "@prisma/client";
import { Socket } from "socket.io-client";
import { useNotifications } from "@/hooks/useNotifications";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, MapPin, Phone, User, Clock } from "lucide-react";
import { urgenciaBadgeVariant, urgenciaLabel } from "@/lib/theme";

interface Props {
    socket: Socket | null;
}

export default function EventNotification({ socket }: Props) {
    const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
    const { playSound, showNotification } = useNotifications();

    const handleAsignar = useCallback(
        (eventoId: string) => {
            if (!socket) return;
            socket.emit("evento:asignar", { eventoId });
            setSelectedEvento(null);
        },
        [socket]
    );

    const handleIgnore = useCallback(() => {
        setSelectedEvento(null);
    }, []);

    const openEventModal = useCallback((evento: Evento) => {
        setSelectedEvento(evento);
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleNuevo = ({ evento }: { evento: Evento }) => {
            playSound();

            const notif = showNotification("Nuevo evento", {
                body: `${evento.titulo} - ${evento.direccionExacta}`,
                tag: evento.id,
            });

            if (notif) {
                notif.onclick = () => {
                    window.focus();
                    openEventModal(evento);
                };
            }

            toast.info("Nuevo evento disponible", {
                description: `${evento.titulo} - ${evento.direccionExacta}`,
                duration: 10000,
                action: {
                    label: "Ver detalles",
                    onClick: () => openEventModal(evento),
                },
                icon: <Bell className="h-4 w-4" />,
            });
        };

        const handleAsignadoExito = ({ evento }: { evento: Evento }) => {
            toast.success("Evento asignado", {
                description: `Te has asignado a: ${evento.titulo}`,
            });
        };

        const handleAsignadoError = ({ mensaje }: { mensaje: string }) => {
            toast.error("No se pudo asignar el evento", {
                description: mensaje,
            });
        };

        socket.on("evento:nuevo", handleNuevo);
        socket.on("evento:asignado-exito", handleAsignadoExito);
        socket.on("evento:asignado-error", handleAsignadoError);

        return () => {
            socket.off("evento:nuevo", handleNuevo);
            socket.off("evento:asignado-exito", handleAsignadoExito);
            socket.off("evento:asignado-error", handleAsignadoError);
        };
    }, [socket, playSound, showNotification, openEventModal]);

    return (
        <Dialog
            open={!!selectedEvento}
            onOpenChange={(open) => {
                if (!open) setSelectedEvento(null);
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-primary" />
                        Nuevo Evento
                    </DialogTitle>
                    <DialogDescription>
                        Detalles del evento recibido
                    </DialogDescription>
                </DialogHeader>

                {selectedEvento && (
                    <div className="space-y-4 py-2">
                        <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-lg">
                                {selectedEvento.titulo}
                            </h3>
                            <Badge
                                variant={
                                    urgenciaBadgeVariant[
                                        selectedEvento.nivelUrgencia as NivelUrgencia
                                    ]
                                }
                            >
                                {urgenciaLabel[
                                    selectedEvento.nivelUrgencia as NivelUrgencia
                                ] || selectedEvento.nivelUrgencia}
                            </Badge>
                        </div>

                        <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 shrink-0" />
                                <span>{selectedEvento.direccionExacta}</span>
                            </div>
                            {selectedEvento.telefonoContacto && (
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 shrink-0" />
                                    <span>
                                        {selectedEvento.telefonoContacto}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 shrink-0" />
                                <span>Origen: {selectedEvento.origen}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 shrink-0" />
                                <span>
                                    {new Date(
                                        selectedEvento.createdAt
                                    ).toLocaleString("es-CL")}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={handleIgnore}
                        className="w-full sm:w-auto"
                    >
                        Ignorar
                    </Button>
                    <Button
                        onClick={() =>
                            selectedEvento &&
                            handleAsignar(selectedEvento.id)
                        }
                        className="w-full sm:w-auto"
                    >
                        Asignarme este caso
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
