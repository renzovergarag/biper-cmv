"use client";

import { useState } from "react";
import { NivelUrgencia } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { Plus } from "lucide-react";
import { urgenciaLabel } from "@/lib/theme";

interface CreateEventModalProps {
    onEventCreated: (evento: any) => void;
}

export default function CreateEventModal({
    onEventCreated,
}: CreateEventModalProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<{
        titulo: string;
        origen: string;
        nivelUrgencia: NivelUrgencia;
        direccionExacta: string;
        telefonoContacto: string;
        latitud: string;
        longitud: string;
    }>({
        titulo: "",
        origen: "",
        nivelUrgencia: NivelUrgencia.BAJA,
        direccionExacta: "",
        telefonoContacto: "",
        latitud: "",
        longitud: "",
    });

    function resetForm() {
        setForm({
            titulo: "",
            origen: "",
            nivelUrgencia: NivelUrgencia.BAJA,
            direccionExacta: "",
            telefonoContacto: "",
            latitud: "",
            longitud: "",
        });
        setError(null);
    }

    function handleOpenChange(isOpen: boolean) {
        setOpen(isOpen);
        if (!isOpen) {
            resetForm();
        }
    }

    function handleChange(
        e: React.ChangeEvent<HTMLInputElement>
    ) {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    function handleUrgenciaChange(value: string) {
        setForm((prev) => ({
            ...prev,
            nivelUrgencia: value as NivelUrgencia,
        }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const coordenadas =
            form.latitud && form.longitud
                ? {
                      lat: parseFloat(form.latitud),
                      lng: parseFloat(form.longitud),
                  }
                : undefined;

        try {
            const res = await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    titulo: form.titulo,
                    origen: form.origen,
                    nivelUrgencia: form.nivelUrgencia,
                    direccionExacta: form.direccionExacta,
                    telefonoContacto:
                        form.telefonoContacto || undefined,
                    coordenadas,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(
                    data.error ||
                        "Error al crear el evento. Inténtalo de nuevo."
                );
                return;
            }

            onEventCreated(data.evento);
            setOpen(false);
            resetForm();
        } catch {
            setError("Error de red. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    }

    const isMobile = useMediaQuery("(max-width: 639px)");

    const triggerButton = (
        <Button>
            <Plus className="h-4 w-4 mr-2" />
            Crear Evento
        </Button>
    );

    function FormBody() {
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="titulo">Título</Label>
                    <Input id="titulo" name="titulo" value={form.titulo} onChange={handleChange} required />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="origen">Origen</Label>
                    <Input id="origen" name="origen" value={form.origen} onChange={handleChange} required />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="nivelUrgencia">Nivel de Urgencia</Label>
                    <Select value={form.nivelUrgencia} onValueChange={handleUrgenciaChange}>
                        <SelectTrigger id="nivelUrgencia">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.values(NivelUrgencia).map((nivel) => (
                                <SelectItem key={nivel} value={nivel}>
                                    {urgenciaLabel[nivel]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="direccionExacta">Dirección Exacta</Label>
                    <Input
                        id="direccionExacta"
                        name="direccionExacta"
                        value={form.direccionExacta}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="telefonoContacto">Teléfono de Contacto</Label>
                    <Input
                        id="telefonoContacto"
                        name="telefonoContacto"
                        type="tel"
                        value={form.telefonoContacto}
                        onChange={handleChange}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="latitud">Latitud</Label>
                        <Input id="latitud" name="latitud" type="number" step="any" value={form.latitud} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="longitud">Longitud</Label>
                        <Input id="longitud" name="longitud" type="number" step="any" value={form.longitud} onChange={handleChange} />
                    </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Creando..." : "Crear Evento"}
                    </Button>
                </div>
            </form>
        );
    }

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={handleOpenChange}>
                <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
                <DrawerContent>
                    <DrawerHeader className="text-left">
                        <DrawerTitle>Crear nuevo evento</DrawerTitle>
                        <DrawerDescription>
                            Completa los datos del evento para registrarlo en el sistema.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="px-4 pb-6 max-h-[70vh] overflow-y-auto">
                        <FormBody />
                    </div>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{triggerButton}</DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Crear nuevo evento</DialogTitle>
                    <DialogDescription>
                        Completa los datos del evento para registrarlo en el sistema.
                    </DialogDescription>
                </DialogHeader>
                <FormBody />
            </DialogContent>
        </Dialog>
    );
}
