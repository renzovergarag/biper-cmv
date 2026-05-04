"use client";

import { useCallback, useRef, useEffect, useState } from "react";

export function useNotifications() {
    const [permission, setPermission] = useState<NotificationPermission>(
        typeof window !== "undefined" && "Notification" in window
            ? Notification.permission
            : "default"
    );
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "default"
        ) {
            Notification.requestPermission().then((result) => {
                setPermission(result);
            });
        }
    }, []);

    const playSound = useCallback(() => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext();
            }
            const ctx = audioContextRef.current;
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(
                440,
                ctx.currentTime + 0.15
            );

            gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
                0.01,
                ctx.currentTime + 0.15
            );

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.15);
        } catch (e) {
            console.warn("No se pudo reproducir el sonido:", e);
        }
    }, []);

    const showNotification = useCallback(
        (title: string, options?: NotificationOptions) => {
            if (
                typeof window !== "undefined" &&
                "Notification" in window &&
                permission === "granted"
            ) {
                try {
                    return new Notification(title, {
                        icon: "/favicon.ico",
                        requireInteraction: true,
                        ...options,
                    });
                } catch (e) {
                    console.warn("Error al mostrar notificación:", e);
                }
            }
            return null;
        },
        [permission]
    );

    return { playSound, showNotification, permission };
}
