"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import UserFormModal from "@/components/UserFormModal";
import { Plus } from "lucide-react";
import type { UserListItem } from "@/types";

export default function UsersPageClient() {
    const [usuarios, setUsuarios] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserListItem | null>(null);

    const fetchUsuarios = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/users");
            if (res.ok) {
                const { data } = await res.json();
                setUsuarios(data);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsuarios();
    }, [fetchUsuarios]);

    const handleEdit = (usuario: UserListItem) => {
        setEditingUser(usuario);
        setModalOpen(true);
    };

    const handleCreate = () => {
        setEditingUser(null);
        setModalOpen(true);
    };

    const handleToggleActivo = async (usuario: UserListItem) => {
        if (usuario.activo) {
            if (
                !confirm(
                    `¿Desactivar a ${usuario.nombre}? No podrá iniciar sesión.`
                )
            )
                return;

            const res = await fetch(`/api/admin/users/${usuario.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                fetchUsuarios();
            } else {
                const data = await res.json();
                alert(data.error || "Error al desactivar");
            }
        } else {
            const res = await fetch(`/api/admin/users/${usuario.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: true }),
            });
            if (res.ok) {
                fetchUsuarios();
            } else {
                const data = await res.json();
                alert(data.error || "Error al reactivar");
            }
        }
    };

    const getInitials = (nombre: string) =>
        nombre
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

    if (loading) {
        return (
            <p className="text-sm text-muted-foreground py-4">
                Cargando usuarios...
            </p>
        );
    }

    return (
        <div>
            <div className="sticky top-14 z-20 -mx-4 lg:-mx-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold truncate">Usuarios</h2>
                    <Button onClick={handleCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo
                        <span className="hidden sm:inline">&nbsp;Usuario</span>
                    </Button>
                </div>
            </div>

            {/* --- Desktop: tabla (≥1024px) --- */}
            <div className="hidden lg:block rounded-lg border bg-card text-card-foreground shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">
                                        Acciones
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usuarios.map((usuario) => (
                                    <TableRow key={usuario.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                                        {getInitials(usuario.nombre)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-medium text-foreground">
                                                    {usuario.nombre}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {usuario.email}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    usuario.rol === "ADMIN"
                                                        ? "default"
                                                        : "secondary"
                                                }
                                            >
                                                {usuario.rol}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    usuario.activo
                                                        ? "outline"
                                                        : "destructive"
                                                }
                                            >
                                                {usuario.activo
                                                    ? "Activo"
                                                    : "Inactivo"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="link"
                                                size="sm"
                                                onClick={() =>
                                                    handleEdit(usuario)
                                                }
                                                className="mr-2"
                                            >
                                                Editar
                                            </Button>
                                            <Button
                                                variant="link"
                                                size="sm"
                                                onClick={() =>
                                                    handleToggleActivo(usuario)
                                                }
                                                className={
                                                    usuario.activo
                                                        ? "text-destructive"
                                                        : "text-green-600"
                                                }
                                            >
                                                {usuario.activo
                                                    ? "Desactivar"
                                                    : "Reactivar"}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* --- Mobile/Tablet: cards (<1024px) --- */}
                    <div className="lg:hidden space-y-3">
                        {usuarios.map((usuario) => (
                            <div
                                key={usuario.id}
                                className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3"
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                                            {getInitials(usuario.nombre)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">
                                            {usuario.nombre}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {usuario.email}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">
                                        Rol
                                    </span>
                                    <Badge
                                        variant={
                                            usuario.rol === "ADMIN"
                                                ? "default"
                                                : "secondary"
                                        }
                                    >
                                        {usuario.rol}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">
                                        Estado
                                    </span>
                                    <Badge
                                        variant={
                                            usuario.activo
                                                ? "outline"
                                                : "destructive"
                                        }
                                    >
                                        {usuario.activo
                                            ? "Activo"
                                            : "Inactivo"}
                                    </Badge>
                                </div>
                                <div className="flex justify-end gap-2 pt-1 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEdit(usuario)}
                                    >
                                        Editar
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            handleToggleActivo(usuario)
                                        }
                                        className={
                                            usuario.activo
                                                ? "text-destructive border-destructive hover:bg-destructive/10"
                                                : "text-green-600 border-green-600 hover:bg-green-50"
                                        }
                                    >
                                        {usuario.activo
                                            ? "Desactivar"
                                            : "Reactivar"}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

            <UserFormModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={fetchUsuarios}
                usuario={editingUser}
            />
        </div>
    );
}
