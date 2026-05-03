import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-secondary/50">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-foreground mb-4">
                    BIPER CMV
                </h1>
                <p className="text-lg text-muted-foreground">
                    Sistema de Gestión de Eventos Territoriales
                </p>
                <div className="mt-8">
                    <Button asChild>
                        <Link href="/login">Iniciar Sesión</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
