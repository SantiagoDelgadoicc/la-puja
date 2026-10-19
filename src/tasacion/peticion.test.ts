import { describe, expect, it } from "vitest";
import { precioDeNota } from "@/lib/precio";
import {
  armarRespuesta,
  esquemaPeticion,
  LARGO_MAXIMO_OFERTA,
  respuestaSinOferta,
} from "@/tasacion/peticion";

const partidaId = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";

describe("esquemaPeticion", () => {
  it("acepta una petición correcta (el reintento lo decide el servidor)", () => {
    expect(esquemaPeticion.parse({ lote: 31, oferta: "okapi", partidaId })).toEqual({
      lote: 31,
      oferta: "okapi",
      partidaId,
    });
  });

  it("acepta la oferta vacía: es 'sin oferta'", () => {
    expect(esquemaPeticion.safeParse({ lote: 31, oferta: "", partidaId }).success).toBe(true);
  });

  it("rechaza lotes no válidos, partidas sin UUID y ofertas demasiado largas", () => {
    expect(esquemaPeticion.safeParse({ lote: 0, oferta: "a", partidaId }).success).toBe(false);
    expect(esquemaPeticion.safeParse({ lote: "31", oferta: "a", partidaId }).success).toBe(false);
    expect(esquemaPeticion.safeParse({ lote: 31, oferta: "a", partidaId: "x" }).success).toBe(
      false,
    );
    const larga = "a".repeat(LARGO_MAXIMO_OFERTA + 1);
    expect(esquemaPeticion.safeParse({ lote: 31, oferta: larga, partidaId }).success).toBe(false);
  });
});

describe("armarRespuesta", () => {
  const comun = { lote: 31, tipo: "cerrado" as const, oferta: "okapi", deCache: false };
  const okapi = {
    valida: true,
    formaCanonica: "okapi",
    rareza: 70,
    ingenio: 20,
    comentario: "¡Joya!",
  };
  const joya = { ...okapi, rareza: 100, ingenio: 100 }; // nota 100 → 7 martillazos
  const mesa = { valida: false, formaCanonica: null, rareza: 0, ingenio: 0, comentario: "¡No!" };

  it("una oferta válida lleva nota, martillazos, nivel y precio, sin reintento", () => {
    const r = armarRespuesta({ ...comun, tasacion: okapi });
    // 0,8 × 70 + 0,2 × 20 = 60 → 4 martillazos.
    expect(r).toMatchObject({
      valida: true,
      nota: 60,
      martillazos: 4,
      nivel: "¡Pujas en la sala!",
      precioCentavos: precioDeNota(60),
      comentario: "¡Joya!",
      puedeReintentar: false,
      esReintento: false,
    });
    expect(r.motivo).toBeUndefined();
    expect(r.tope).toBeUndefined();
  });

  it("la mercancía falsa vale $0 y permite reintentar en el primer intento", () => {
    const r = armarRespuesta({ ...comun, oferta: "mesa", deCache: true, tasacion: mesa });
    expect(r).toMatchObject({
      valida: false,
      motivo: "mercancia-falsa",
      nota: null,
      martillazos: null,
      precioCentavos: 0,
      precio: "$0",
      comentario: "¡No!",
      puedeReintentar: true,
    });
  });

  it("en el reintento, la mercancía falsa ya no permite otro intento", () => {
    const r = armarRespuesta({ ...comun, tasacion: mesa, esReintento: true });
    expect(r).toMatchObject({ valida: false, esReintento: true, puedeReintentar: false });
  });

  it("una palabra ya vendida cuenta como falsa, con la frase de Bartolo", () => {
    const r = armarRespuesta({ ...comun, tasacion: okapi, yaVendida: true });
    expect(r).toMatchObject({
      valida: false,
      motivo: "ya-vendido",
      precioCentavos: 0,
      puedeReintentar: true,
    });
    expect(r.comentario).toMatch(/ya se vendió/);
  });

  it("el tope del reintento deja una joya en 5 martillazos", () => {
    const r = armarRespuesta({ ...comun, tasacion: joya, esReintento: true, tope: 5 });
    expect(r).toMatchObject({
      martillazos: 5,
      nota: 82,
      tope: 5,
      precioCentavos: precioDeNota(82),
    });
  });

  it("el tope del ejemplo del lote deja la oferta en 1 martillazo", () => {
    const r = armarRespuesta({ ...comun, tasacion: joya, tope: 1 });
    expect(r).toMatchObject({ martillazos: 1, nota: 19, tope: 1 });
  });

  it("si la oferta ya estaba por debajo del tope, no se marca tope", () => {
    const r = armarRespuesta({ ...comun, tasacion: okapi, esReintento: true, tope: 5 });
    expect(r.martillazos).toBe(4);
    expect(r.tope).toBeUndefined();
  });

  it("los datos de jugadores bajan el precio de lo que todos dicen", () => {
    const cebra = { ...okapi, formaCanonica: "cebra", rareza: 60, ingenio: 10 };
    const sinDatos = armarRespuesta({ ...comun, tasacion: cebra });
    const conDatos = armarRespuesta({
      ...comun,
      tasacion: cebra,
      datosJugadores: { veces: 400, total: 500 },
    });
    expect(conDatos.precioCentavos).toBeLessThan(sinDatos.precioCentavos);
  });
});

describe("respuestaSinOferta", () => {
  it("vale $0, no permite reintento y Bartolo vende el aire", () => {
    expect(respuestaSinOferta(31, false)).toMatchObject({
      oferta: "",
      valida: false,
      motivo: "sin-oferta",
      precioCentavos: 0,
      puedeReintentar: false,
      comentario: "¡Vendido el aire, por nada!",
    });
  });
});
