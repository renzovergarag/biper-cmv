"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/components/providers/AuthProvider";

export function useSocket(socketUrl: string) {
    const { token, user } = useAuth();
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!token || !user) {
            return;
        }

        const socket = io(socketUrl, {
            auth: { token },
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            setConnected(true);
        });

        socket.on("disconnect", () => {
            setConnected(false);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [socketUrl, token, user]);

    return { socket: socketRef.current, connected };
}
