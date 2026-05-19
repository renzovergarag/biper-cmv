import {
    PrismaClient,
    EstadoEvento,
    EstadoAsignacion,
} from "@prisma/client";

const prisma = new PrismaClient();

function mapEstado(estado: EstadoEvento): EstadoAsignacion {
    switch (estado) {
        case EstadoEvento.EN_RUTA:
            return EstadoAsignacion.EN_RUTA;
        case EstadoEvento.RESUELTO:
            return EstadoAsignacion.RESUELTO;
        case EstadoEvento.CANCELADO:
            return EstadoAsignacion.ABANDONADO;
        default:
            // PENDIENTE (inconsistente con asignadoId) o ASIGNADO
            return EstadoAsignacion.ASIGNADO;
    }
}

interface RawEvento {
    _id: { $oid: string };
    asignadoId?: { $oid: string };
    estado: EstadoEvento;
    assignedAt?: { $date: string };
    createdAt: { $date: string };
    resolvedAt?: { $date: string };
}

async function main() {
    // Usamos $runCommandRaw para leer el campo legacy asignadoId directamente
    // desde MongoDB, ya que no existe en el schema de Prisma.
    const raw = await prisma.$runCommandRaw({
        find: "Evento",
        filter: { asignadoId: { $exists: true, $ne: null } },
        projection: {
            _id: 1,
            asignadoId: 1,
            estado: 1,
            assignedAt: 1,
            createdAt: 1,
            resolvedAt: 1,
        },
    }) as unknown as { cursor: { firstBatch: RawEvento[] } };

    const eventos = raw.cursor.firstBatch;

    console.log(`Encontrados ${eventos.length} eventos con asignadoId.`);

    let creadas = 0;
    let omitidas = 0;

    for (const evento of eventos) {
        const eventoId = evento._id.$oid;
        const agenteId = evento.asignadoId?.$oid;
        if (!agenteId) continue;

        const existente = await prisma.asignacionEvento.findUnique({
            where: { eventoId_agenteId: { eventoId, agenteId } },
        });

        if (existente) {
            omitidas++;
            continue;
        }

        const assignedAt = evento.assignedAt
            ? new Date(evento.assignedAt.$date)
            : new Date(evento.createdAt.$date);
        const resolvedAt = evento.resolvedAt
            ? new Date(evento.resolvedAt.$date)
            : null;

        await prisma.asignacionEvento.create({
            data: {
                eventoId,
                agenteId,
                estado: mapEstado(evento.estado),
                assignedAt,
                resolvedAt,
            },
        });
        creadas++;
    }

    console.log(`Asignaciones creadas: ${creadas} | omitidas (ya existían): ${omitidas}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
