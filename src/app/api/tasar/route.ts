// POST /api/tasar — tasa una oferta: { lote, oferta, partidaId }. Oferta vacía = sin oferta.
// Los errores llevan un mensaje en la voz de Bartolo para poder mostrarlo tal cual.
import { crearLimitador, ipDeLaPeticion, VENTANAS_DEL_JUEGO } from "@/lib/limite";
import { esquemaPeticion } from "@/tasacion/peticion";
import { LoteCerrado, LoteInexistente, tasarOferta } from "@/tasacion/servicio";

// Un solo limitador por servidor. En desarrollo se guarda en globalThis para que las
// recargas de Next no reinicien los contadores.
const global = globalThis as unknown as { limitadorTasar?: ReturnType<typeof crearLimitador> };
const limitador = (global.limitadorTasar ??= crearLimitador(VENTANAS_DEL_JUEGO));

function error(status: number, mensaje: string, headers?: HeadersInit) {
  return Response.json({ error: mensaje }, { status, headers });
}

export async function POST(request: Request) {
  // Cuenta toda oferta, válida o no, antes de hacer nada más (decidido en el H16).
  const limite = limitador(ipDeLaPeticion(request.headers));
  if (!limite.permitido) {
    const segundos = Math.ceil(limite.reintentarEnMs / 1000);
    const mensaje =
      limite.ventana === "minuto"
        ? `¡Calma, campeón! Esta sala admite diez pujas por minuto. Vuelva en ${segundos} s.`
        : "Por hoy la sala cierra para usted, pillo: trescientas pujas son muchas. Vuelva mañana.";
    return error(429, mensaje, { "Retry-After": String(segundos) });
  }

  const cuerpo = await request.json().catch(() => null);
  const peticion = esquemaPeticion.safeParse(cuerpo);
  if (!peticion.success) {
    return error(400, "Esa puja viene mal escrita, campeón: no la entiendo.");
  }

  try {
    return Response.json(await tasarOferta(peticion.data));
  } catch (e) {
    if (e instanceof LoteInexistente) return error(404, "Ese lote no está en mi catálogo.");
    if (e instanceof LoteCerrado) {
      return error(409, "Ese lote ya está adjudicado, campeón. Pase al siguiente.");
    }
    console.error("[tasar] fallo al tasar:", e);
    return error(503, "El tasador salió a tomar aire. Vuelva a pujar en un momento.");
  }
}
