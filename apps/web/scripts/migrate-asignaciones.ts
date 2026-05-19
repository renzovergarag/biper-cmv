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

async function main() {
    const eventos = await prisma.evento.findMany({
        where: { asignadoId: { not: null } },
        select: {
            id: true,
            asignadoId: true,
            estado: true,
            assignedAt: true,
            createdAt: true,
            resolvedAt: true,
        },
    });

    console.log(`Encontrados ${eventos.length} eventos con asignadoId.`);

    let creadas = 0;
    let omitidas = 0;

    for (const evento of eventos) {
        const agenteId = evento.asignadoId;
        if (!agenteId) continue;

        const existente = await prisma.asignacionEvento.findUnique({
            where: { eventoId_agenteId: { eventoId: evento.id, agenteId } },
        });

        if (existente) {
            omitidas++;
            continue;
        }

        await prisma.asignacionEvento.create({
            data: {
                eventoId: evento.id,
                agenteId,
                estado: mapEstado(evento.estado),
                assignedAt: evento.assignedAt ?? evento.createdAt,
                resolvedAt: evento.resolvedAt ?? null,
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
