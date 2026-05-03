import { Prisma, Rol, NivelUrgencia, EstadoEvento } from "@prisma/client";

export type EventoWithRelations = Prisma.EventoGetPayload<{
    include: { creador: true; asignado: true };
}>;

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Evento {
  id: string;
  titulo: string;
  origen: string;
  nivelUrgencia: NivelUrgencia;
  direccionExacta: string;
  coordenadas?: { lat: number; lng: number };
  telefonoContacto?: string;
  estado: EstadoEvento;
  creadorId: string;
  asignadoId?: string;
  createdAt: Date;
  updatedAt: Date;
  assignedAt?: Date;
  resolvedAt?: Date;
}

export interface LogAuditoria {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string;
  usuarioId: string;
  detalle?: Record<string, unknown>;
  timestamp: Date;
}

export interface SocketEventPayloads {
  "evento:nuevo": { evento: Evento };
  "evento:asignar": { eventoId: string };
  "evento:actualizar-estado": { eventoId: string; nuevoEstado: EstadoEvento };
  "evento:actualizado": { evento: Evento };
  "evento:asignado-exito": { evento: Evento };
  "evento:asignado-error": { mensaje: string };
}
