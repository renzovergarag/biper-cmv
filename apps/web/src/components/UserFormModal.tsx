"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { UserListItem } from "@/types";
import type { Rol } from "@prisma/client";

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    usuario?: UserListItem | null;
}

export default function UserFormModal({
    isOpen,
    onClose,
    onSave,
    usuario,
}: UserFormModalProps) {
    const [nombre, setNombre] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rol, setRol] = useState<Rol>("AGENT");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const isEditing = !!usuario;

    useEffect(() => {
        if (usuario) {
            setNombre(usuario.nombre);
            setEmail(usuario.email);
            setRol(usuario.rol);
            setPassword("");
        } else {
            setNombre("");
            setEmail("");
            setPassword("");
            setRol("AGENT");
        }
        setError("");
    }, [usuario, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSaving(true);

        try {
            const url = isEditing
                ? `/api/admin/users/${usuario!.id}`
                : "/api/admin/users";
            const method = isEditing ? "PATCH" : "POST";

            const body: Record<string, unknown> = { nombre, email, rol };
            if (!isEditing) {
                body.password = password;
            } else if (password) {
                body.password = password;
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || data.mensaje || "Error al guardar");
                return;
            }

            onSave();
            onClose();
        } catch {
            setError("Error de conexión");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? "Editar Usuario" : "Nuevo Usuario"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Modifica los datos del usuario"
                            : "Crea un nuevo usuario en el sistema"}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre</Label>
                        <Input
                            id="nombre"
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">
                            Contraseña
                            {isEditing && (
                                <span className="font-normal text-muted-foreground ml-1">
                                    (dejar vacío para mantener)
                                </span>
                            )}
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required={!isEditing}
                            minLength={6}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="rol">Rol</Label>
                        <Select value={rol} onValueChange={(v) => setRol(v as Rol)}>
                            <SelectTrigger id="rol">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AGENT">Agente</SelectItem>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving
                                ? "Guardando..."
                                : isEditing
                                  ? "Guardar Cambios"
                                  : "Crear Usuario"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
