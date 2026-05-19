import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.$runCommandRaw({
        update: "Evento",
        updates: [
            {
                q: { asignadoId: { $exists: true } },
                u: { $unset: { asignadoId: "" } },
                multi: true,
            },
        ],
    });
    console.log("Resultado $unset asignadoId:", JSON.stringify(result));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
