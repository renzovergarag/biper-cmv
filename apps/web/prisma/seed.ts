import { PrismaClient, Rol, NivelUrgencia, EstadoEvento } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Limpiar datos existentes (sin transacciones, una por una)
  try {
    await prisma.logAuditoria.deleteMany({});
  } catch { /* ignore if empty */ }
  try {
    await prisma.estadoHistorial.deleteMany({});
  } catch { /* ignore if empty */ }
  try {
    await prisma.evento.deleteMany({});
  } catch { /* ignore if empty */ }
  try {
    await prisma.user.deleteMany({});
  } catch { /* ignore if empty */ }
  console.log("🗑️  Datos existentes eliminados");

  // Crear usuarios
  const hashedPassword = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@biper.cl",
      password: hashedPassword,
      nombre: "Admin Principal",
      rol: Rol.ADMIN,
    },
  });
  console.log(`✅ Admin creado: ${admin.email}`);

  const agente1 = await prisma.user.create({
    data: {
      email: "agente1@biper.cl",
      password: hashedPassword,
      nombre: "Juan Pérez",
      rol: Rol.AGENT,
    },
  });
  console.log(`✅ Agente 1 creado: ${agente1.email}`);

  const agente2 = await prisma.user.create({
    data: {
      email: "agente2@biper.cl",
      password: hashedPassword,
      nombre: "María González",
      rol: Rol.AGENT,
    },
  });
  console.log(`✅ Agente 2 creado: ${agente2.email}`);

  // Crear eventos de ejemplo
  const evento1 = await prisma.evento.create({
    data: {
      titulo: "Árbol caído en vía pública",
      origen: "teléfono",
      nivelUrgencia: NivelUrgencia.ALTA,
      direccionExacta: "Av. Libertador Bernardo O'Higgins 1234, Santiago",
      coordenadas: { lat: -33.4489, lng: -70.6693 },
      telefonoContacto: "+56912345678",
      estado: EstadoEvento.PENDIENTE,
      creadorId: admin.id,
    },
  });
  console.log(`✅ Evento 1 creado: ${evento1.titulo} (PENDIENTE)`);

  const evento2 = await prisma.evento.create({
    data: {
      titulo: "Corte de suministro eléctrico",
      origen: "radio",
      nivelUrgencia: NivelUrgencia.CRITICA,
      direccionExacta: "Calle San Martín 567, Valparaíso",
      coordenadas: { lat: -33.0472, lng: -71.6127 },
      estado: EstadoEvento.PENDIENTE,
      creadorId: admin.id,
    },
  });
  console.log(`✅ Evento 2 creado: ${evento2.titulo} (PENDIENTE)`);

  const evento3 = await prisma.evento.create({
    data: {
      titulo: "Solicitud de información",
      origen: "rrss",
      nivelUrgencia: NivelUrgencia.BAJA,
      direccionExacta: "Plaza de Armas 100, Concepción",
      telefonoContacto: "+56987654321",
      estado: EstadoEvento.ASIGNADO,
      creadorId: admin.id,
      asignadoId: agente1.id,
      assignedAt: new Date(Date.now() - 3600000),
    },
  });
  console.log(`✅ Evento 3 creado: ${evento3.titulo} (ASIGNADO)`);

  const evento4 = await prisma.evento.create({
    data: {
      titulo: "Inundación por lluvia intensa",
      origen: "teléfono",
      nivelUrgencia: NivelUrgencia.CRITICA,
      direccionExacta: "Ruta 5 Norte km 120, La Serena",
      coordenadas: { lat: -29.9027, lng: -71.2519 },
      estado: EstadoEvento.EN_RUTA,
      creadorId: admin.id,
      asignadoId: agente2.id,
      assignedAt: new Date(Date.now() - 7200000),
    },
  });
  console.log(`✅ Evento 4 creado: ${evento4.titulo} (EN_RUTA)`);

  const evento5 = await prisma.evento.create({
    data: {
      titulo: "Poste de luz con cables sueltos",
      origen: "radio",
      nivelUrgencia: NivelUrgencia.MEDIA,
      direccionExacta: "Av. España 890, Antofagasta",
      estado: EstadoEvento.RESUELTO,
      creadorId: admin.id,
      asignadoId: agente1.id,
      assignedAt: new Date(Date.now() - 86400000),
      resolvedAt: new Date(Date.now() - 43200000),
    },
  });
  console.log(`✅ Evento 5 creado: ${evento5.titulo} (RESUELTO)`);

  // Crear historial de estados (uno por uno, sin createMany)
  const historialData = [
    { eventoId: evento3.id, estado: EstadoEvento.PENDIENTE, usuarioId: admin.id },
    { eventoId: evento3.id, estado: EstadoEvento.ASIGNADO, usuarioId: agente1.id },
    { eventoId: evento4.id, estado: EstadoEvento.PENDIENTE, usuarioId: admin.id },
    { eventoId: evento4.id, estado: EstadoEvento.ASIGNADO, usuarioId: agente2.id },
    { eventoId: evento4.id, estado: EstadoEvento.EN_RUTA, usuarioId: agente2.id },
    { eventoId: evento5.id, estado: EstadoEvento.PENDIENTE, usuarioId: admin.id },
    { eventoId: evento5.id, estado: EstadoEvento.ASIGNADO, usuarioId: agente1.id },
    { eventoId: evento5.id, estado: EstadoEvento.EN_RUTA, usuarioId: agente1.id },
    { eventoId: evento5.id, estado: EstadoEvento.RESUELTO, usuarioId: agente1.id },
  ];

  for (const item of historialData) {
    await prisma.estadoHistorial.create({ data: item });
  }
  console.log("✅ Historial de estados creado (9 registros)");

  // Crear logs de auditoría (uno por uno)
  const logsData = [
    {
      accion: "CREATED",
      entidad: "Evento",
      entidadId: evento1.id,
      usuarioId: admin.id,
      detalle: { titulo: evento1.titulo },
    },
    {
      accion: "CREATED",
      entidad: "Evento",
      entidadId: evento2.id,
      usuarioId: admin.id,
      detalle: { titulo: evento2.titulo },
    },
    {
      accion: "ASSIGNED",
      entidad: "Evento",
      entidadId: evento3.id,
      usuarioId: agente1.id,
      detalle: { eventoId: evento3.id, agenteId: agente1.id },
    },
    {
      accion: "STATUS_CHANGED",
      entidad: "Evento",
      entidadId: evento4.id,
      usuarioId: agente2.id,
      detalle: { estadoAnterior: "ASIGNADO", nuevoEstado: "EN_RUTA" },
    },
    {
      accion: "STATUS_CHANGED",
      entidad: "Evento",
      entidadId: evento5.id,
      usuarioId: agente1.id,
      detalle: { estadoAnterior: "EN_RUTA", nuevoEstado: "RESUELTO" },
    },
  ];

  for (const item of logsData) {
    await prisma.logAuditoria.create({ data: item });
  }
  console.log("✅ Logs de auditoría creados (5 registros)");

  console.log("\n📊 Resumen del seed:");
  console.log("   Usuarios: 3 (1 admin, 2 agentes)");
  console.log("   Eventos: 5 (2 pendientes, 1 asignado, 1 en ruta, 1 resuelto)");
  console.log("   Historial de estados: 9 registros");
  console.log("   Logs de auditoría: 5 registros");
  console.log("\n🔐 Credenciales de prueba:");
  console.log("   Admin: admin@biper.cl / password123");
  console.log("   Agente 1: agente1@biper.cl / password123");
  console.log("   Agente 2: agente2@biper.cl / password123");
  console.log("\n✅ Seed completado!");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
