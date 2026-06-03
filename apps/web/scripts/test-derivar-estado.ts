import assert from "node:assert/strict";
import { EstadoAsignacion, EstadoEvento } from "@prisma/client";
import { derivarEstadoEvento } from "../src/lib/asignaciones";

const A = EstadoAsignacion;
const E = EstadoEvento;

// Sin asignaciones activas → PENDIENTE
assert.equal(derivarEstadoEvento([]), E.PENDIENTE);

// Solo ASIGNADO → ASIGNADO
assert.equal(derivarEstadoEvento([{ estado: A.ASIGNADO }]), E.ASIGNADO);

// Mezcla ASIGNADO + EN_RUTA → EN_RUTA
assert.equal(
    derivarEstadoEvento([{ estado: A.ASIGNADO }, { estado: A.EN_RUTA }]),
    E.EN_RUTA
);

// Todas RESUELTO → RESUELTO
assert.equal(
    derivarEstadoEvento([{ estado: A.RESUELTO }, { estado: A.RESUELTO }]),
    E.RESUELTO
);

// Una RESUELTO y otra ASIGNADO (no todas cerradas) → EN_RUTA
assert.equal(
    derivarEstadoEvento([{ estado: A.RESUELTO }, { estado: A.ASIGNADO }]),
    E.EN_RUTA
);

// ABANDONADO se ignora: queda solo una ASIGNADO → ASIGNADO
assert.equal(
    derivarEstadoEvento([{ estado: A.ABANDONADO }, { estado: A.ASIGNADO }]),
    E.ASIGNADO
);

// Todas ABANDONADO → PENDIENTE
assert.equal(
    derivarEstadoEvento([{ estado: A.ABANDONADO }, { estado: A.ABANDONADO }]),
    E.PENDIENTE
);

// Mezcla EN_RUTA + EN_EL_LUGAR -> EN_EL_LUGAR
assert.equal(
    derivarEstadoEvento([{ estado: A.EN_RUTA }, { estado: A.EN_EL_LUGAR }]),
    E.EN_EL_LUGAR
);

// Mezcla RESUELTO + EN_EL_LUGAR -> EN_EL_LUGAR
assert.equal(
    derivarEstadoEvento([{ estado: A.RESUELTO }, { estado: A.EN_EL_LUGAR }]),
    E.EN_EL_LUGAR
);

// Mezcla ASIGNADO + EN_EL_LUGAR -> EN_EL_LUGAR
assert.equal(
    derivarEstadoEvento([{ estado: A.ASIGNADO }, { estado: A.EN_EL_LUGAR }]),
    E.EN_EL_LUGAR
);

console.log("✓ derivarEstadoEvento: todos los casos pasaron");
