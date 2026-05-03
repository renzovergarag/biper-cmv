"use client";

import { useState } from "react";
import { NivelUrgencia } from "@prisma/client";

interface CreateEventModalProps {
    onEventCreated: (evento: any) => void;
}

export default function CreateEventModal({
    onEventCreated,
}: CreateEventModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
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

    function handleOpen() {
        setIsOpen(true);
    }

    function handleClose() {
        setIsOpen(false);
        resetForm();
    }

    function handleChange(
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
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
            handleClose();
        } catch {
            setError("Error de red. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <button
                onClick={handleOpen}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
                + Crear Evento
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Crear nuevo evento
                            </h3>
                            <button
                                onClick={handleClose}
                                className="text-gray-400 hover:text-gray-500"
                            >
                                <span className="sr-only">Cerrar</span>
                                <svg
                                    className="h-6 w-6"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="titulo"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Título
                                </label>
                                <input
                                    type="text"
                                    id="titulo"
                                    name="titulo"
                                    value={form.titulo}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="origen"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Origen
                                </label>
                                <input
                                    type="text"
                                    id="origen"
                                    name="origen"
                                    value={form.origen}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="nivelUrgencia"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Nivel de Urgencia
                                </label>
                                <select
                                    id="nivelUrgencia"
                                    name="nivelUrgencia"
                                    value={form.nivelUrgencia}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value={NivelUrgencia.BAJA}>
                                        Baja
                                    </option>
                                    <option value={NivelUrgencia.MEDIA}>
                                        Media
                                    </option>
                                    <option value={NivelUrgencia.ALTA}>
                                        Alta
                                    </option>
                                    <option value={NivelUrgencia.CRITICA}>
                                        Crítica
                                    </option>
                                </select>
                            </div>

                            <div>
                                <label
                                    htmlFor="direccionExacta"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Dirección Exacta
                                </label>
                                <input
                                    type="text"
                                    id="direccionExacta"
                                    name="direccionExacta"
                                    value={form.direccionExacta}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="telefonoContacto"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Teléfono de Contacto
                                </label>
                                <input
                                    type="tel"
                                    id="telefonoContacto"
                                    name="telefonoContacto"
                                    value={form.telefonoContacto}
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label
                                        htmlFor="latitud"
                                        className="block text-sm font-medium text-gray-700"
                                    >
                                        Latitud
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        id="latitud"
                                        name="latitud"
                                        value={form.latitud}
                                        onChange={handleChange}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="longitud"
                                        className="block text-sm font-medium text-gray-700"
                                    >
                                        Longitud
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        id="longitud"
                                        name="longitud"
                                        value={form.longitud}
                                        onChange={handleChange}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading
                                        ? "Creando..."
                                        : "Crear Evento"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
