"use client";

import { MapPin } from "lucide-react";
import {
    Map,
    MapMarker,
    MarkerContent,
    MapControls,
} from "@/components/ui/map";

interface Props {
    coordenadas?: { lat: number; lng: number } | null;
    className?: string;
}

const OPENFREEMAP_STYLES = {
    light: "https://tiles.openfreemap.org/styles/bright",
    dark: "https://tiles.openfreemap.org/styles/dark",
};

export function EventMapPreview({ coordenadas, className }: Props) {
    if (
        !coordenadas ||
        !Number.isFinite(coordenadas.lat) ||
        !Number.isFinite(coordenadas.lng)
    ) {
        return null;
    }

    return (
        <div
            className={`h-[220px] w-full overflow-hidden rounded-md border ${className ?? ""}`}
        >
            <Map
                center={[coordenadas.lng, coordenadas.lat]}
                zoom={16}
                theme="light"
                styles={OPENFREEMAP_STYLES}
            >
                <MapMarker
                    longitude={coordenadas.lng}
                    latitude={coordenadas.lat}
                >
                    <MarkerContent>
                        <MapPin
                            className="fill-red-500 stroke-white drop-shadow-md"
                            size={32}
                        />
                    </MarkerContent>
                </MapMarker>
                <MapControls position="top-right" showZoom />
            </Map>
        </div>
    );
}
