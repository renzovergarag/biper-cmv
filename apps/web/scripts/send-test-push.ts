import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { enviarPushASuscripciones } from "../src/lib/push";

const prisma = new PrismaClient();

async function main() {
    const suscripciones = await prisma.suscripcionPush.findMany();
    console.log(`Suscripciones registradas: ${suscripciones.length}`);

    if (suscripciones.length === 0) {
        console.log(
            "No hay suscripciones. Activa las notificaciones en un dispositivo primero."
        );
        return;
    }

    const muertos = await enviarPushASuscripciones(
        suscripciones.map((s) => ({
            endpoint: s.endpoint,
            p256dh: s.p256dh,
            auth: s.auth,
        })),
        {
            id: "test",
            titulo: "Evento de prueba",
            direccionExacta: "Dirección de prueba 123",
        }
    );

    console.log(`Push enviado. Endpoints muertos eliminados: ${muertos.length}`);
    if (muertos.length > 0) {
        await prisma.suscripcionPush.deleteMany({
            where: { endpoint: { in: muertos } },
        });
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => {
        void prisma.$disconnect();
    });
