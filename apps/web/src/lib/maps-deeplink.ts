export type MapProvider = "google" | "waze" | "apple";

export interface Coords {
  lat: number;
  lng: number;
}

export function hasValidCoords(coords?: Coords | null): coords is Coords {
  return (
    !!coords &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lng >= -180 &&
    coords.lng <= 180
  );
}

export function buildDeepLink(
  provider: MapProvider,
  direccion: string,
  coordenadas?: Coords | null
): string {
  const q = encodeURIComponent(direccion.trim());
  const useCoords = hasValidCoords(coordenadas);
  const lat = useCoords ? coordenadas!.lat : null;
  const lng = useCoords ? coordenadas!.lng : null;

  switch (provider) {
    case "google":
      return useCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`;
    case "waze":
      return useCoords
        ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
        : `https://waze.com/ul?q=${q}&navigate=yes`;
    case "apple":
      return useCoords
        ? `https://maps.apple.com/?daddr=${lat},${lng}`
        : `https://maps.apple.com/?q=${q}`;
  }
}

export function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
}
