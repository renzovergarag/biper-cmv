"use client";

import { useState, FormEvent } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePasswordModal() {
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (next !== confirm) {
            toast.error("Las contraseñas no coinciden");
            return;
        }
        if (next.length < 8) {
            toast.error(
                "La nueva contraseña debe tener al menos 8 caracteres"
            );
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/auth/password", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword: current,
                    newPassword: next,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Error al cambiar contraseña");
                return;
            }
            toast.success("Contraseña actualizada");
            setOpen(false);
            setCurrent("");
            setNext("");
            setConfirm("");
        } catch {
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">Cambiar contraseña</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cambiar contraseña</DialogTitle>
                    <DialogDescription>
                        Ingresa tu contraseña actual y la nueva
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current">Contraseña actual</Label>
                        <Input
                            id="current"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={current}
                            onChange={(e) => setCurrent(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="next">Nueva contraseña</Label>
                        <Input
                            id="next"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            required
                            value={next}
                            onChange={(e) => setNext(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm">Confirmar nueva</Label>
                        <Input
                            id="confirm"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            required
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : "Cambiar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
