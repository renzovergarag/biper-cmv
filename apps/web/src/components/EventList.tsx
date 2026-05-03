"use client";

import { EventoWithRelations } from "@/types";
import { NivelUrgencia, EstadoEvento } from "@prisma/client";

interface EventListProps {
    eventos: EventoWithRelations[];
}

const urgenciaColors: Record<NivelUrgencia, string> = {
    [NivelUrgencia.CRITICA]: "bg-red-100 text-red-800",
    [NivelUrgencia.ALTA]: "bg-orange-100 text-orange-800",
    [NivelUrgencia.MEDIA]: "bg-yellow-100 text-yellow-800",
    [NivelUrgencia.BAJA]: "bg-green-100 text-green-800",
};

const estadoLabels: Record<EstadoEvento, string> = {
    [EstadoEvento.PENDIENTE]: "Pendiente",
    [EstadoEvento.ASIGNADO]: "Asignado",
    [EstadoEvento.EN_RUTA]: "En ruta",
    [EstadoEvento.RESUELTO]: "Resuelto",
    [EstadoEvento.CANCELADO]: "Cancelado",
};

function formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function EventList({ eventos }: EventListProps) {
    if (eventos.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-600">No hay eventos registrados.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Título
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Origen
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Urgencia
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Estado
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Asignado a
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fecha
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {eventos.map((evento) => (
                            <tr key={evento.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {evento.titulo}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {evento.origen}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${urgenciaColors[evento.nivelUrgencia]}`}
                                    >
                                        {evento.nivelUrgencia}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {estadoLabels[evento.estado]}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {evento.asignado?.nombre || "—"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {formatDate(evento.createdAt)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
