"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                const msg = data.error || "Error al iniciar sesión";
                setError(msg);
                toast.error(msg);
                setLoading(false);
                return;
            }

            window.location.href = "/dashboard";
        } catch {
            const msg = "Error de conexión";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-svh flex items-center justify-center bg-muted/40 p-6">
            <div className="w-full max-w-sm flex flex-col items-center gap-6">
                <Image
                    src="/Logo BN V.jpg"
                    alt="Corporación Municipal Valparaíso"
                    width={180}
                    height={180}
                    priority
                    className="h-20 sm:h-24 w-auto"
                />
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Iniciar sesión</CardTitle>
                        <CardDescription>
                            Ingresa tus credenciales para acceder
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={handleSubmit}
                            className="space-y-4"
                        >
                            {error && (
                                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) =>
                                        setEmail(e.target.value)
                                    }
                                    placeholder="admin@viper.cl"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">
                                    Contraseña
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="••••••••"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full"
                                size="lg"
                            >
                                {loading
                                    ? "Iniciando sesión..."
                                    : "Iniciar sesión"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground text-center">
                    Sistema de Gestión de Eventos Territoriales
                </p>
            </div>
        </div>
    );
}
