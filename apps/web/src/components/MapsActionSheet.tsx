"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { buildDeepLink, isAppleDevice, type Coords } from "@/lib/maps-deeplink";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direccion: string;
  coordenadas?: Coords | null;
}

function openExternal(url: string) {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = url;
}

export function MapsActionSheet({ open, onOpenChange, direccion, coordenadas }: Props) {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const showApple = isAppleDevice();

  const handleClick = (provider: "google" | "waze" | "apple") => {
    openExternal(buildDeepLink(provider, direccion, coordenadas));
    onOpenChange(false);
  };

  // Render como Sheet (bottom drawer) en mobile, Sheet right en desktop
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Abrir dirección en…</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start h-12"
            onClick={() => handleClick("google")}
          >
            Google Maps
          </Button>
          <Button
            variant="outline"
            className="justify-start h-12"
            onClick={() => handleClick("waze")}
          >
            Waze
          </Button>
          {showApple && (
            <Button
              variant="outline"
              className="justify-start h-12"
              onClick={() => handleClick("apple")}
            >
              Apple Maps
            </Button>
          )}
          <Button
            variant="ghost"
            className="justify-start h-12 mt-2"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
