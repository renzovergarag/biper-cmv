"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
    const { user, logout, isLoading } = useAuth();
    const pathname = usePathname();

    if (isLoading) {
        return null;
    }

    return (
        <header className="bg-white shadow">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-semibold text-gray-900">
                            BIPER CMV
                        </h1>
                        {user && (
                            <nav className="flex gap-4">
                                {user.rol === "ADMIN" && (
                                    <>
                                        <Link
                                            href="/dashboard/admin"
                                            className={`text-sm font-medium transition-colors ${
                                                pathname === "/dashboard/admin"
                                                    ? "text-blue-600"
                                                    : "text-gray-500 hover:text-gray-700"
                                            }`}
                                        >
                                            Eventos
                                        </Link>
                                        <Link
                                            href="/dashboard/admin/users"
                                            className={`text-sm font-medium transition-colors ${
                                                pathname.startsWith(
                                                    "/dashboard/admin/users"
                                                )
                                                    ? "text-blue-600"
                                                    : "text-gray-500 hover:text-gray-700"
                                            }`}
                                        >
                                            Usuarios
                                        </Link>
                                    </>
                                )}
                                {user.rol === "AGENT" && (
                                    <Link
                                        href="/dashboard/agent"
                                        className={`text-sm font-medium transition-colors ${
                                            pathname === "/dashboard/agent"
                                                ? "text-blue-600"
                                                : "text-gray-500 hover:text-gray-700"
                                        }`}
                                    >
                                        Eventos
                                    </Link>
                                )}
                            </nav>
                        )}
                    </div>
                    {user && (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-700">
                                    {user.nombre}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                    {user.rol}
                                </span>
                            </div>
                            <button
                                onClick={logout}
                                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                            >
                                Cerrar sesión
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
