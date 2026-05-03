"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface User {
    id: string;
    email: string;
    nombre: string;
    rol: string;
    activo: boolean;
}

interface AuthContextValue {
    user: User | null;
    token: string | null;
    logout: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchMe() {
            try {
                const res = await fetch("/api/auth/me");
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                    setToken(data.token);
                } else {
                    setUser(null);
                    setToken(null);
                }
            } catch {
                setUser(null);
                setToken(null);
            } finally {
                setIsLoading(false);
            }
        }

        fetchMe();
    }, []);

    async function logout() {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch {
            // Silenciar errores de red
        }
        setUser(null);
        setToken(null);
        router.push("/login");
    }

    return (
        <AuthContext.Provider value={{ user, token, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth debe usarse dentro de un AuthProvider");
    }
    return context;
}
