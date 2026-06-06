import webpush from "web-push";

let configurado = false;

function getWebPush() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@biper-cmv.cl";

    if (!publicKey || !privateKey) {
        return null;
    }
    if (!configurado) {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        configurado = true;
    }
    return webpush;
}

export interface SuscripcionPushLike {
    endpoint: string;
    p256dh: string;
    auth: string;
}

export interface EventoPushInput {
    id: string;
    titulo: string;
    direccionExacta: string;
}

// Envía el push a todas las suscripciones. Devuelve los endpoints que ya no
// existen (404/410) para que el llamador los elimine de la base de datos.
export async function enviarPushASuscripciones(
    suscripciones: SuscripcionPushLike[],
    evento: EventoPushInput
): Promise<string[]> {
    const wp = getWebPush();
    if (!wp) {
        console.warn("[push] VAPID no configurado; se omite el envío push");
        return [];
    }

    const payload = JSON.stringify({
        title: "Nuevo evento",
        body: `${evento.titulo} – ${evento.direccionExacta}`,
        eventoId: evento.id,
        url: `/dashboard/agent?evento=${evento.id}`,
    });

    const endpointsMuertos: string[] = [];

    await Promise.allSettled(
        suscripciones.map(async (sub) => {
            try {
                await wp.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth },
                    },
                    payload
                );
            } catch (err) {
                const statusCode = (err as { statusCode?: number }).statusCode;
                if (statusCode === 404 || statusCode === 410) {
                    endpointsMuertos.push(sub.endpoint);
                } else {
                    console.error(`[push] error enviando a ${sub.endpoint}:`, err);
                }
            }
        })
    );

    return endpointsMuertos;
}
