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

            if (ctx.state === "suspended") {
                void ctx.resume();
            }

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = "square";
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            const startTime = ctx.currentTime;
            const beepDuration = 0.22;
            const gapDuration = 0.08;
            const cycleDuration = beepDuration + gapDuration;
            const totalDuration = 4.5;
            const beepCount = Math.floor(totalDuration / cycleDuration);

            const highFreq = 1000;
            const lowFreq = 700;
            const peakGain = 0.18;

            gainNode.gain.setValueAtTime(0, startTime);

            for (let i = 0; i < beepCount; i++) {
                const beepStart = startTime + i * cycleDuration;
                const freq = i % 2 === 0 ? highFreq : lowFreq;

                oscillator.frequency.setValueAtTime(freq, beepStart);

                gainNode.gain.setValueAtTime(0, beepStart);
                gainNode.gain.linearRampToValueAtTime(
                    peakGain,
                    beepStart + 0.012
                );
                gainNode.gain.setValueAtTime(
                    peakGain,
                    beepStart + beepDuration - 0.02
                );
                gainNode.gain.linearRampToValueAtTime(
                    0,
                    beepStart + beepDuration
                );
            }

            const stopTime = startTime + beepCount * cycleDuration;
            oscillator.start(startTime);
            oscillator.stop(stopTime);
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
