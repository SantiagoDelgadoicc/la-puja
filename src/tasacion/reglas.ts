// Reglas del lote (H17), sin base de datos: el servicio les pasa lo que ya pasó en la partida.
// Las aplica el servidor; el navegador no decide si una oferta es reintento ni si vale.
import type { Martillazos } from "../lib/juego.ts";
import { normalizarOferta } from "../lib/normalizar.ts";

/** Martillazos máximos en el reintento tras una mercancía falsa. */
export const TOPE_REINTENTO: Martillazos = 5;
/** Martillazos máximos si la oferta es el propio ejemplo del lote. */
export const TOPE_EJEMPLO: Martillazos = 1;

export type MotivoSinPrecio = "mercancia-falsa" | "ya-vendido" | "sin-oferta";

/** Lo que ya se registró en un lote de esta partida, en orden. */
export type IntentoPrevio = {
  /** null si el jugador no ofreció nada (se acabó el tiempo). */
  palabraNormalizada: string | null;
  /** null si la oferta no se aceptó (mercancía falsa, ya vendida o sin oferta). */
  martillazos: number | null;
};

export type EstadoDelLote = "primer-intento" | "reintento" | "cerrado";

/**
 * En qué punto está el lote para la próxima oferta. Se cierra si ya se aceptó una oferta,
 * si el jugador se quedó sin ofertar o si ya gastó el reintento.
 */
export function estadoDelLote(intentos: IntentoPrevio[]): EstadoDelLote {
  if (intentos.length === 0) return "primer-intento";
  const cierra = intentos.some((i) => i.martillazos !== null || i.palabraNormalizada === null);
  if (cierra || intentos.length >= 2) return "cerrado";
  return "reintento";
}

/** El ejemplo que da el lote entre paréntesis ("Un truco de skate (como el ollie)" → "ollie"). */
export function ejemploDelLote(textoLote: string): string | null {
  const encontrado = /\(como (?:(?:el|la|los|las|un|una|unos|unas) )?([^)]+)\)/i.exec(textoLote);
  return encontrado ? normalizarOferta(encontrado[1]) || null : null;
}

/** true si la oferta (o su forma canónica) es el ejemplo del lote, en singular o plural. */
export function esElEjemploDelLote(
  textoLote: string,
  oferta: string,
  formaCanonica: string | null,
): boolean {
  const ejemplo = ejemploDelLote(textoLote);
  if (!ejemplo) return false;
  const variantes = new Set([ejemplo, ejemplo.replace(/e?s$/, "")]);
  return [oferta, formaCanonica ?? ""].some((t) => {
    const n = normalizarOferta(t);
    return variantes.has(n) || variantes.has(n.replace(/e?s$/, ""));
  });
}

/** true si esa forma canónica ya se aceptó en otro lote de la partida. */
export function yaSeVendio(formaCanonica: string, vendidasEnLaPartida: string[]): boolean {
  const buscada = normalizarOferta(formaCanonica);
  return vendidasEnLaPartida.some((v) => normalizarOferta(v) === buscada);
}

/** Frases fijas de Bartolo para las reglas que no pasan por la IA. */
export const FRASES_DE_REGLAS = {
  "ya-vendido": "¡Eso ya se vendió en esta partida, campeón! Ofrezca otra mercancía.",
  "sin-oferta": "¡Vendido el aire, por nada!",
} as const;
