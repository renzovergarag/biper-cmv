"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapsActionSheet } from "./MapsActionSheet";
import type { Coords } from "@/lib/maps-deeplink";

interface Props {
  direccion: string;
  coordenadas?: Coords | null;
  className?: string;
  showIcon?: boolean;
}

export function AddressLink({
  direccion,
  coordenadas,
  className,
  showIcon = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const trimmed = direccion?.trim() ?? "";
  if (!trimmed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Abrir ${trimmed} en una app de mapas`}
        className={cn(
          "inline-flex items-center gap-1 text-left text-primary hover:underline focus:underline focus:outline-none",
          className
        )}
      >
        {showIcon && <MapPin className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="truncate">{trimmed}</span>
      </button>
      <MapsActionSheet
        open={open}
        onOpenChange={setOpen}
        direccion={trimmed}
        coordenadas={coordenadas}
      />
    </>
  );
}
