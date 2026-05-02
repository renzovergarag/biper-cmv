import jwt from "jsonwebtoken";

const NEXT_API_URL = process.env.NEXT_API_URL || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET;
const FETCH_TIMEOUT_MS = 10000;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

function getSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return JWT_SECRET;
}

function getInternalToken(): string {
  return jwt.sign(
    { sub: "socket-server", rol: "INTERNAL" },
    getSecret(),
    { expiresIn: "5m", algorithm: "HS256" }
  );
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export async function callNextAPI<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const token = getInternalToken();

  const response = await fetchWithTimeout(`${NEXT_API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  }, FETCH_TIMEOUT_MS);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function asignarEventoAtomico(
  eventoId: string,
  agenteId: string
) {
  return callNextAPI<{ evento: unknown; success: boolean }>(
    "/api/internal/assign",
    "POST",
    { eventoId, agenteId }
  );
}

export async function actualizarEstadoEvento(
  eventoId: string,
  nuevoEstado: string,
  usuarioId: string
) {
  return callNextAPI<{ evento: unknown; success: boolean }>(
    "/api/internal/update-status",
    "PATCH",
    { eventoId, nuevoEstado, usuarioId }
  );
}
