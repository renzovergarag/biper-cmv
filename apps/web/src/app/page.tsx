import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
    return (
        <div className="min-h-svh flex items-center justify-center bg-muted/40 p-6">
            <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
                <Image
                    src="/Logo BN Sin Fondo.png"
                    alt="Corporación Municipal Valparaíso"
                    width={180}
                    height={180}
                    priority
                    className="h-24 sm:h-28 w-auto"
                />
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-foreground">
                        VIPER CMV
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Sistema de Gestión de Eventos Territoriales
                    </p>
                </div>
                <Button asChild size="lg" className="w-full">
                    <Link href="/login">Iniciar sesión</Link>
                </Button>
            </div>
        </div>
    );
}
