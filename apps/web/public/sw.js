self.addEventListener("push", (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch (e) {
        payload = { title: "Nuevo evento", body: event.data.text() };
    }

    const title = payload.title || "Nuevo evento";
    const body = payload.body || "";
    const eventoId = payload.eventoId;
    const url = payload.url || "/dashboard/agent";

    event.waitUntil(
        (async () => {
            const ventanas = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });
            const hayVentanaVisible = ventanas.some(
                (c) => c.visibilityState === "visible" && c.focused
            );
            // Si la app está abierta y enfocada, el modal por socket ya avisó.
            if (hayVentanaVisible) return;

            await self.registration.showNotification(title, {
                body,
                tag: eventoId || undefined,
                renotify: true,
                requireInteraction: true,
                vibrate: [400, 150, 400, 150, 400],
                icon: "/icons/icon-192.png",
                badge: "/icons/icon-192.png",
                data: { url },
            });
        })()
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url =
        (event.notification.data && event.notification.data.url) ||
        "/dashboard/agent";

    event.waitUntil(
        (async () => {
            const ventanas = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });
            for (const client of ventanas) {
                if ("focus" in client) {
                    await client.focus();
                    if ("navigate" in client) {
                        try {
                            await client.navigate(url);
                        } catch (e) {
                            // ignorar fallos de navegación entre orígenes
                        }
                    }
                    return;
                }
            }
            if (self.clients.openWindow) {
                await self.clients.openWindow(url);
            }
        })()
    );
});
