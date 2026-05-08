import { LRUCache } from "lru-cache";

const PLACES_BASE = "https://places.googleapis.com/v1";

const GRAN_VALPARAISO_RECTANGLE = {
  low: { latitude: -33.10, longitude: -71.66 },
  high: { latitude: -32.90, longitude: -71.30 },
};

const INCLUDED_PRIMARY_TYPES = [
  "street_address",
  "route",
  "premise",
  "subpremise",
  "point_of_interest",
];

export interface Suggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  description: string;
  lat: number;
  lng: number;
  comuna: string | null;
}

export class PlacesError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "PlacesError";
  }
}

const autocompleteCache = new LRUCache<string, Suggestion[]>({
  max: 200,
  ttl: 1000 * 60 * 5, // 5 min
});

const detailsCache = new LRUCache<string, PlaceDetails>({
  max: 500,
  ttl: 1000 * 60 * 60 * 24, // 24 h
});

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new PlacesError("GOOGLE_PLACES_API_KEY no configurada", 500);
  }
  return key;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && i < retries) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
    }
  }
  throw lastErr ?? new PlacesError("fetch failed", 503);
}

export async function autocomplete(
  input: string,
  sessionToken: string
): Promise<Suggestion[]> {
  const trimmed = input.trim();
  if (trimmed.length < 3) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = autocompleteCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const body = {
    input: trimmed,
    languageCode: "es",
    regionCode: "cl",
    includedRegionCodes: ["cl"],
    includedPrimaryTypes: INCLUDED_PRIMARY_TYPES,
    locationRestriction: { rectangle: GRAN_VALPARAISO_RECTANGLE },
    sessionToken,
  };

  const res = await fetchWithRetry(`${PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[places.autocomplete] Google error", res.status, text);
    throw new PlacesError(`Google ${res.status}`, 503);
  }

  const json = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId: string;
        text: { text: string };
        structuredFormat?: {
          mainText?: { text: string };
          secondaryText?: { text: string };
        };
      };
    }>;
  };

  const suggestions: Suggestion[] = (json.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 5)
    .map((p) => ({
      placeId: p.placeId,
      description: p.text?.text ?? "",
      mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
    }));

  autocompleteCache.set(cacheKey, suggestions);
  return suggestions;
}

export async function placeDetails(
  placeId: string,
  sessionToken: string
): Promise<PlaceDetails> {
  if (!placeId) throw new PlacesError("placeId requerido", 400);

  const cached = detailsCache.get(placeId);
  if (cached) return cached;

  const apiKey = getApiKey();
  const url = new URL(`${PLACES_BASE}/places/${placeId}`);
  url.searchParams.set("sessionToken", sessionToken);
  url.searchParams.set("languageCode", "es");
  url.searchParams.set("regionCode", "cl");

  const res = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
    },
  });

  if (res.status === 404) throw new PlacesError("placeId no encontrado", 404);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[places.placeDetails] Google error", res.status, text);
    throw new PlacesError(`Google ${res.status}`, 503);
  }

  const json = (await res.json()) as {
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    addressComponents?: Array<{
      longText: string;
      shortText: string;
      types: string[];
    }>;
  };

  if (!json.location) throw new PlacesError("respuesta sin location", 503);

  const comuna =
    json.addressComponents?.find((c) =>
      c.types.includes("locality") || c.types.includes("administrative_area_level_3")
    )?.longText ?? null;

  const details: PlaceDetails = {
    description: json.formattedAddress ?? "",
    lat: json.location.latitude,
    lng: json.location.longitude,
    comuna,
  };

  detailsCache.set(placeId, details);
  return details;
}
