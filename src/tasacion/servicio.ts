// Servicio de tasación del juego: caché en Postgres + IA + reglas del lote + registro.
// Solo para el servidor (usa la base de datos y las claves de la IA).
import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { lotes, ofertas, tasaciones } from "@/db/schema";
import { normalizarOferta } from "@/lib/normalizar";
import {
  armarRespuesta,
  respuestaSinOferta,
  type PeticionTasacion,
  type RespuestaTasacion,
} from "./peticion";
import {
  esElEjemploDelLote,
  estadoDelLote,
  TOPE_EJEMPLO,
  TOPE_REINTENTO,
  yaSeVendio,
} from "./reglas";
import { tasar } from "./tasar";

export class LoteInexistente extends Error {}
export class LoteCerrado extends Error {}

/** Busca la tasación en la caché o, si no está, la pide a la IA y la guarda. */
async function tasacionCacheada(lote: typeof lotes.$inferSelect, oferta: string) {
  const enCache = await db.query.tasaciones.findFirst({
    where: and(eq(tasaciones.loteId, lote.id), eq(tasaciones.palabraNormalizada, oferta)),
  });
  if (enCache) return { fila: enCache, deCache: true };

  const { tasacion, proveedor, modelo, motivoRespaldo } = await tasar(lote, oferta);
  if (motivoRespaldo) console.info(`[tasar] respondió ${proveedor} (motivo: ${motivoRespaldo})`);

  // Si otra petición guardó la misma oferta mientras tanto, gana la que ya estaba.
  await db
    .insert(tasaciones)
    .values({
      loteId: lote.id,
      palabraNormalizada: oferta,
      valida: tasacion.valida,
      formaCanonica: tasacion.formaCanonica,
      rarezaIa: tasacion.rareza,
      ingenioIa: tasacion.ingenio,
      comentario: tasacion.comentario,
      proveedor,
      modelo,
    })
    .onConflictDoNothing();
  const fila = await db.query.tasaciones.findFirst({
    where: and(eq(tasaciones.loteId, lote.id), eq(tasaciones.palabraNormalizada, oferta)),
  });
  if (!fila) throw new Error("La tasación recién guardada no aparece en la base.");
  return { fila, deCache: false };
}

/** Cuántas ofertas válidas tiene el lote y cuántas tienen esta forma canónica (incluida esta). */
async function datosDeJugadores(loteId: number, formaCanonica: string) {
  const delLote = and(eq(ofertas.loteId, loteId), eq(tasaciones.valida, true));
  const contar = (filtro: typeof delLote) =>
    db
      .select({ n: count() })
      .from(ofertas)
      .innerJoin(tasaciones, eq(ofertas.tasacionId, tasaciones.id))
      .where(filtro);
  const [[{ n: total }], [{ n: veces }]] = await Promise.all([
    contar(delLote),
    contar(and(delLote, eq(tasaciones.formaCanonica, formaCanonica))),
  ]);
  return { veces: veces + 1, total: total + 1 };
}

/** Todo lo ofertado en la partida, en orden, con la forma canónica de lo aceptado. */
async function historialDeLaPartida(partidaId: string) {
  return db
    .select({
      loteId: ofertas.loteId,
      palabraNormalizada: ofertas.palabraNormalizada,
      martillazos: ofertas.martillazos,
      formaCanonica: tasaciones.formaCanonica,
    })
    .from(ofertas)
    .leftJoin(tasaciones, eq(ofertas.tasacionId, tasaciones.id))
    .where(eq(ofertas.partidaId, partidaId))
    .orderBy(asc(ofertas.id));
}

/** Tasa una oferta de una partida aplicando las reglas del lote, y la deja registrada. */
export async function tasarOferta(peticion: PeticionTasacion): Promise<RespuestaTasacion> {
  const lote = await db.query.lotes.findFirst({ where: eq(lotes.numero, peticion.lote) });
  if (!lote) throw new LoteInexistente(`No existe el lote ${peticion.lote}.`);

  const historial = await historialDeLaPartida(peticion.partidaId);
  const estado = estadoDelLote(historial.filter((h) => h.loteId === lote.id));
  if (estado === "cerrado") throw new LoteCerrado(`El lote ${lote.numero} ya está adjudicado.`);
  const esReintento = estado === "reintento";

  const registrar = (valores: Partial<typeof ofertas.$inferInsert>) =>
    db.insert(ofertas).values({
      partidaId: peticion.partidaId,
      loteId: lote.id,
      esReintento,
      ...valores,
    });

  const oferta = normalizarOferta(peticion.oferta);
  if (!oferta) {
    await registrar({ textoEscrito: peticion.oferta.trim() || null, precioCentavos: 0 });
    return respuestaSinOferta(lote.numero, esReintento);
  }

  const { fila, deCache } = await tasacionCacheada(lote, oferta);
  const vendidas = historial
    .filter((h) => h.martillazos !== null && h.formaCanonica)
    .map((h) => h.formaCanonica as string);
  const yaVendida = fila.valida && !!fila.formaCanonica && yaSeVendio(fila.formaCanonica, vendidas);
  const esEjemplo = esElEjemploDelLote(lote.texto, oferta, fila.formaCanonica);
  const tope = esEjemplo ? TOPE_EJEMPLO : esReintento ? TOPE_REINTENTO : undefined;

  const datosJugadores =
    fila.valida && fila.formaCanonica && !yaVendida
      ? await datosDeJugadores(lote.id, fila.formaCanonica)
      : undefined;

  const respuesta = armarRespuesta({
    lote: lote.numero,
    tipo: lote.tipo,
    oferta,
    tasacion: {
      valida: fila.valida,
      formaCanonica: fila.formaCanonica,
      rareza: fila.rarezaIa,
      ingenio: fila.ingenioIa,
      comentario: fila.comentario,
    },
    datosJugadores,
    deCache,
    esReintento,
    yaVendida,
    tope,
  });

  await registrar({
    textoEscrito: peticion.oferta,
    palabraNormalizada: oferta,
    tasacionId: fila.id,
    nota: respuesta.nota,
    martillazos: respuesta.martillazos,
    precioCentavos: respuesta.precioCentavos,
  });

  return respuesta;
}
