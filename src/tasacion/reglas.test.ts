import { describe, expect, it } from "vitest";
import catalogo from "../../data/lotes.json";
import { ejemploDelLote, esElEjemploDelLote, estadoDelLote, yaSeVendio } from "@/tasacion/reglas";

const falsa = { palabraNormalizada: "mesa", martillazos: null };
const aceptada = { palabraNormalizada: "okapi", martillazos: 4 };
const sinOferta = { palabraNormalizada: null, martillazos: null };

describe("estadoDelLote", () => {
  it("sin intentos, es el primer intento", () => {
    expect(estadoDelLote([])).toBe("primer-intento");
  });

  it("tras una mercancía falsa, toca el reintento", () => {
    expect(estadoDelLote([falsa])).toBe("reintento");
  });

  it("se cierra si ya se aceptó una oferta", () => {
    expect(estadoDelLote([aceptada])).toBe("cerrado");
    expect(estadoDelLote([falsa, aceptada])).toBe("cerrado");
  });

  it("se cierra si no hubo oferta (sin reintento)", () => {
    expect(estadoDelLote([sinOferta])).toBe("cerrado");
  });

  it("se cierra si el reintento también fue mercancía falsa", () => {
    expect(estadoDelLote([falsa, falsa])).toBe("cerrado");
  });
});

describe("ejemploDelLote", () => {
  it("saca el ejemplo entre paréntesis, sin artículo", () => {
    expect(ejemploDelLote("Un truco de skate (como el ollie)")).toBe("ollie");
    expect(ejemploDelLote("Un objeto del espacio (como un asteroide)")).toBe("asteroide");
    expect(ejemploDelLote("Un personaje de Mario Bros. (como Toad)")).toBe("toad");
    expect(ejemploDelLote('Una palabra en inglés que usamos en español (como "crush")')).toBe(
      "crush",
    );
  });

  it("devuelve null si el lote no da ejemplo", () => {
    expect(ejemploDelLote("Un animal con rayas o manchas")).toBeNull();
  });

  it("encuentra el ejemplo de todos los lotes del catálogo que lo traen", () => {
    const conEjemplo = catalogo.filter((l) => l.texto.includes("(como"));
    expect(conEjemplo.length).toBeGreaterThan(0);
    for (const lote of conEjemplo) expect(ejemploDelLote(lote.texto)).toBeTruthy();
  });
});

describe("esElEjemploDelLote", () => {
  const ollie = "Un truco de skate (como el ollie)";
  const pasta = "Un tipo de pasta (como los espaguetis)";

  it("reconoce el ejemplo, también por su forma canónica", () => {
    expect(esElEjemploDelLote(ollie, "ollie", "ollie")).toBe(true);
    expect(esElEjemploDelLote(ollie, "Ollie!", null)).toBe(true);
  });

  it("acepta singular y plural", () => {
    expect(esElEjemploDelLote(pasta, "espagueti", "espagueti")).toBe(true);
    expect(esElEjemploDelLote(pasta, "espaguetis", "espaguetis")).toBe(true);
  });

  it("no confunde otras ofertas con el ejemplo", () => {
    expect(esElEjemploDelLote(ollie, "kickflip", "kickflip")).toBe(false);
    expect(esElEjemploDelLote("Un animal", "ollie", "ollie")).toBe(false);
  });
});

describe("yaSeVendio", () => {
  it("compara por forma canónica normalizada", () => {
    expect(yaSeVendio("Pingüino", ["okapi", "pingüino"])).toBe(true);
    expect(yaSeVendio("pingüino", ["pinguino"])).toBe(false); // las tildes cuentan (H10)
    expect(yaSeVendio("kiwi", [])).toBe(false);
  });
});
