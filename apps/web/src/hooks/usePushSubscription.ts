"use client";

import { useCallback, useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type EstadoPush =
    | "cargando"
    | "no-soportado"
    | "sin-permiso"
    | "suscrito"
    | "bloqueado";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function esSoportado(): boolean {
    return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

export function usePushSubscription() {
    const [estado, setEstado] = useState<EstadoPush>("cargando");
    const soportado = esSoportado();

    const refrescar = useCallback(async () => {
        if (!soportado) {
            setEstado("no-soportado");
            return;
        }
        if (Notification.permission === "denied") {
            setEstado("bloqueado");
            return;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
            // Re-sincroniza la suscripción por si el navegador la rotó
            // (el endpoint es la clave del upsert; es idempotente).
            const json = sub.toJSON();
            await fetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    endpoint: json.endpoint,
                    keys: json.keys,
                }),
            }).catch(() => {});
            setEstado("suscrito");
        } else {
            setEstado("sin-permiso");
        }
    }, [soportado]);

    useEffect(() => {
        if (!soportado) {
            setEstado("no-soportado");
            return;
        }
        navigator.serviceWorker.register("/sw.js").catch(() => {});
        void refrescar();
    }, [soportado, refrescar]);

    const activar = useCallback(async () => {
        if (!soportado || !VAPID_PUBLIC_KEY) return;

        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
            setEstado(permiso === "denied" ? "bloqueado" : "sin-permiso");
            return;
        }

        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });

        const json = sub.toJSON();
        await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });

        setEstado("suscrito");
    }, [soportado]);

    const desactivar = useCallback(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
            await fetch("/api/push/unsubscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            await sub.unsubscribe();
        }
        setEstado("sin-permiso");
    }, []);

    return { estado, soportado, activar, desactivar, refrescar };
}
