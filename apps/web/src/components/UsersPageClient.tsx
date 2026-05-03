"use client";

import { useState, useEffect, useCallback } from "react";
import UserFormModal from "@/components/UserFormModal";
import SessionLogsTab from "@/components/SessionLogsTab";
import type { UserListItem } from "@/types";

export default function UsersPageClient() {
    const [usuarios, setUsuarios] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"usuarios" | "logs">("usuarios");
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
            <p className="text-sm text-gray-400 py-4">Cargando usuarios...</p>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                    Gestión de Usuarios
                </h2>
                <button
                    onClick={handleCreate}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                    + Nuevo Usuario
                </button>
            </div>

            <div className="mb-6 border-b border-gray-200">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab("usuarios")}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === "usuarios"
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        Usuarios
                    </button>
                    <button
                        onClick={() => setActiveTab("logs")}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === "logs"
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        Logs de Sesión
                    </button>
                </nav>
            </div>

            {activeTab === "usuarios" ? (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Usuario
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Rol
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Estado
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {usuarios.map((usuario) => (
                                <tr
                                    key={usuario.id}
                                    className="hover:bg-gray-50"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                                {getInitials(usuario.nombre)}
                                            </span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {usuario.nombre}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {usuario.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                usuario.rol === "ADMIN"
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-yellow-100 text-yellow-700"
                                            }`}
                                        >
                                            {usuario.rol}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                usuario.activo
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                            }`}
                                        >
                                            {usuario.activo
                                                ? "Activo"
                                                : "Inactivo"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <button
                                            onClick={() => handleEdit(usuario)}
                                            className="text-blue-600 hover:text-blue-800 font-medium mr-3"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleToggleActivo(usuario)
                                            }
                                            className={
                                                usuario.activo
                                                    ? "text-red-600 hover:text-red-800 font-medium"
                                                    : "text-green-600 hover:text-green-800 font-medium"
                                            }
                                        >
                                            {usuario.activo
                                                ? "Desactivar"
                                                : "Reactivar"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <SessionLogsTab usuarios={usuarios} />
            )}

            <UserFormModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={fetchUsuarios}
                usuario={editingUser}
            />
        </div>
    );
}
