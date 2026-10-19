// Contrato de la API /api/tasar: qué recibe y qué devuelve (sin base de datos ni IA).
import { z } from "zod";
import { nombreDelNivel, type Martillazos } from "../lib/juego.ts";
import {
  formatearPrecio,
  martillazosDeNota,
  precioDeNota,
  precioDeOferta,
  TRAMOS_DE_NOTA,
  type TipoLote,
} from "../lib/precio.ts";
import type { Tasacion } from "./esquema.ts";
import { FRASES_DE_REGLAS, type MotivoSinPrecio } from "./reglas.ts";

/** Largo máximo de una oferta: da para una frase corta en los lotes abiertos. */
export const LARGO_MAXIMO_OFERTA = 80;

/**
 * Lo que manda el navegador. Si es reintento lo decide el servidor (H17), no el cliente.
 * Una oferta vacía significa que se acabó el tiempo sin ofertar.
 */
export const esquemaPeticion = z.object({
  /** Número del lote en el catálogo (data/lotes.json). */
  lote: z.number().int().positive(),
  oferta: z.string().max(LARGO_MAXIMO_OFERTA),
  partidaId: z.uuid(),
});

export type PeticionTasacion = z.infer<typeof esquemaPeticion>;

export type RespuestaTasacion = {
  lote: number;
  /** La oferta normalizada, tal como se cacheó ("" si no hubo oferta). */
  oferta: string;
  /** true si la oferta se aceptó y tiene precio. */
  valida: boolean;
  /** Por qué no tiene precio; ausente si es válida. */
  motivo?: MotivoSinPrecio;
  formaCanonica: string | null;
  nota: number | null;
  martillazos: Martillazos | null;
  nivel: string | null;
  precioCentavos: number;
  precio: string;
  comentario: string;
  /** true si esta oferta era el reintento del lote. */
  esReintento: boolean;
  /** Martillazos máximos que se aplicaron (reintento o ejemplo del lote); ausente si ninguno. */
  tope?: Martillazos;
  /** true si el jugador puede volver a ofertar en este lote. */
  puedeReintentar: boolean;
  /** true si la tasación salió de la caché, sin llamar a la IA. */
  deCache: boolean;
};

const SIN_PRECIO = {
  valida: false,
  nota: null,
  martillazos: null,
  nivel: null,
  precioCentavos: 0,
  precio: formatearPrecio(0),
} as const;

/** El lote se quedó sin oferta: $0 y sin reintento. */
export function respuestaSinOferta(lote: number, esReintento: boolean): RespuestaTasacion {
  return {
    lote,
    oferta: "",
    ...SIN_PRECIO,
    motivo: "sin-oferta",
    formaCanonica: null,
    comentario: FRASES_DE_REGLAS["sin-oferta"],
    esReintento,
    puedeReintentar: false,
    deCache: false,
  };
}

/**
 * Convierte la opinión de la IA en el resultado del juego, aplicando las reglas del lote:
 * mercancía falsa o ya vendida vale $0 (con reintento si era el primer intento), y el
 * tope rebaja la nota al máximo de ese martillazo.
 */
export function armarRespuesta({
  lote,
  tipo,
  oferta,
  tasacion,
  datosJugadores,
  deCache,
  esReintento = false,
  yaVendida = false,
  tope,
}: {
  lote: number;
  tipo: TipoLote;
  oferta: string;
  tasacion: Pick<Tasacion, "valida" | "formaCanonica" | "rareza" | "ingenio" | "comentario">;
  datosJugadores?: { veces: number; total: number };
  deCache: boolean;
  esReintento?: boolean;
  yaVendida?: boolean;
  tope?: Martillazos;
}): RespuestaTasacion {
  const base = { lote, oferta, formaCanonica: tasacion.formaCanonica, esReintento, deCache };

  if (!tasacion.valida || yaVendida) {
    return {
      ...base,
      ...SIN_PRECIO,
      motivo: yaVendida && tasacion.valida ? "ya-vendido" : "mercancia-falsa",
      comentario:
        yaVendida && tasacion.valida ? FRASES_DE_REGLAS["ya-vendido"] : tasacion.comentario,
      puedeReintentar: !esReintento,
    };
  }

  const calculado = precioDeOferta({
    tipo,
    rarezaIa: tasacion.rareza,
    ingenio: tasacion.ingenio,
    datosJugadores,
  });
  const nota = tope ? Math.min(calculado.nota, TRAMOS_DE_NOTA[tope].hasta) : calculado.nota;
  const martillazos = martillazosDeNota(nota);
  const precioCentavos = precioDeNota(nota);
  return {
    ...base,
    valida: true,
    comentario: tasacion.comentario,
    nota,
    martillazos,
    nivel: nombreDelNivel(martillazos),
    precioCentavos,
    precio: formatearPrecio(precioCentavos),
    ...(tope && calculado.martillazos > tope ? { tope } : {}),
    puedeReintentar: false,
  };
}
