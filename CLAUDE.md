# La Puja — Instrucciones para Claude

Juego web en español, un "Krillion sin fin". Bartolo Vendelotodo, un subastador de chistera y bigote enorme, saca a subasta un lote, que es una categoría o una consigna. El jugador ofrece una sola palabra y Bartolo la tasa a martillazos (de 1 a 7). Cuanto más rara o ingeniosa sea la palabra, más golpes da y más dinero vale. Lema: "¿Cuánto vale tu palabra?".

Historia: el 15 de octubre de 2026 el juego pasó a llamarse "Graffímetro", con Mika. El 16 de octubre volvió a ser La Puja, y Mika, su música y su estética pasaron a un juego aparte para Steam, que no se desarrolla en este repositorio. Por eso parte del trabajo de H01-H08 nació con nombres de Graffímetro.

## Documentos de referencia

Son la fuente de verdad del diseño. Consúltalos ante cualquier duda antes de inventar nada.

| Documento                                                                                   | Contenido                                                                        |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Ficha de identidad](https://claude.ai/code/artifact/62430798-9f33-4d9d-b22b-738ebda18d63)  | Concepto, mecánica, reglas, martillazos, Bartolo, vocabulario, estética y sonido |
| [Decisiones técnicas](https://claude.ai/code/artifact/f8d56113-368d-4411-b196-54c0e330f7e2) | Stack, arquitectura, dependencias, modelo de datos y alcance de la demo          |
| [Hoja de ruta](https://claude.ai/code/artifact/6f6ab045-a3dd-41ce-a3d2-9906697744ec)        | Fases e hitos (vista compartible)                                                |
| [Catálogo de lotes](https://claude.ai/code/artifact/5501aa23-1c68-496d-afec-2d0788dd0943)   | Los 100 lotes validados y sus criterios; los datos viven en `data/lotes.json`    |
| `ROADMAP.md`                                                                                | Estado de cada hito: **fuente de verdad del avance**                             |

La [ficha de Graffímetro](https://claude.ai/code/artifact/a02b8e71-f70c-4577-a2cb-16edae01f250) ya no se usa en este proyecto: es el punto de partida del juego de Mika para Steam.

Los documentos de Claude se leen y editan con las herramientas del conector de documentos, nunca con fetch. Si en una sesión no está ese conector, basta con `ROADMAP.md` para trabajar; en ese caso, avisa al usuario de que el documento compartido no se ha actualizado.

## Protocolo de cada ronda de desarrollo

Se sigue siempre, en este orden:

1. **Lee `ROADMAP.md`** y localiza el hito activo: el primer `[~]` (a medias) o, si no hay ninguno, el primer `[ ]` (pendiente). Dile al usuario qué hito toca y en qué estado está.
2. **Pregunta antes de empezar** si el hito tiene "Preguntar antes" o si surge una decisión que los documentos no cierran. Usa preguntas de selección (AskUserQuestion), con la opción recomendada en primer lugar y marcada como "(Recomendado)". No empieces a construir hasta tener las respuestas.
3. **Marca el hito `[~]`** en `ROADMAP.md` y desarróllalo. Trabaja solo en ese hito; lo que quede fuera de su alcance se anota como nota, no se hace.
4. **Comprueba el entregable** del hito (tests, compilación o prueba en el navegador) y enséñaselo al usuario. Un hito nunca se marca como completado sin haber comprobado su entregable.
5. **Cierra el hito** solo con el visto bueno del usuario:
   - Márcalo `[x]` en `ROADMAP.md` y añade una línea en "Registro de rondas".
   - Haz un commit con el mensaje `H<nn>: <nombre del hito>` y súbelo a GitHub (`git push`).
   - Cambia su estado a "Completado" en el documento de la hoja de ruta.
6. Si la ronda termina sin acabar el hito, déjalo en `[~]` y anota en el registro qué falta.

Si una decisión nueva cambia el diseño, actualiza también la ficha o el documento técnico correspondiente, para que nunca contradigan al código.

## Decisiones clave (resumen; el detalle está en los documentos)

- **Stack:** TypeScript, Next.js (App Router), React + PixiJS, `motion`, Tone.js (música adaptativa y martillazos a tempo), `howler` (efectos sueltos), Postgres en Docker + Drizzle y Vitest.
- **IA:** AI SDK de Vercel. El modelo principal es Groq `openai/gpt-oss-120b`; Gemini Flash-Lite hace de respaldo cuando Groq da error de límite. Todo en capas gratuitas.
- **Demo:** solo en local, con la partida de 6 lotes. Coste: $0.
- **Tasación:**
  - Validez + rareza + ingenio dan una nota de 0 a 100.
  - La nota se convierte en martillazos (1 Basura de mercadillo, 2 Algo es algo, 3 Buena pieza, 4 ¡Pujas en la sala!, 5 ¡Subasta caliente!, 6 ¡Locura en la sala!, 7 ¡Se me rompió el martillo!).
  - También se convierte en un precio de martillo de $0,05 a $2.500.000, con escala logarítmica dentro de cada nivel.
  - Pesos: 80/20 en los lotes cerrados y 40/60 en los abiertos.
  - La IA devuelve la forma canónica de la palabra y el comentario de Bartolo en la misma llamada.
  - La caché se guarda por lote y palabra normalizada.
- **Reglas:**
  - Cuenta atrás de 25 s (15 s en el reintento).
  - "¡Mercancía falsa!" da un reintento con un tope de 5 martillazos.
  - "Eso ya se vendió": una palabra repetida en la partida cuenta como mercancía falsa.
  - Sin oferta, el lote vale $0.
  - Modo infinito: Bartolo cobra una comisión que sube cada 3 lotes.
- **Límite:** 10 peticiones por minuto y 300 al día por IP.
- **Base de datos:** tablas `lotes`, `tasaciones` (la opinión de la IA) y `ofertas` (el resultado: nota, martillazos y `precio_centavos`). El dinero se guarda siempre en centavos enteros.

## Next.js 16

El proyecto usa **Next.js 16.4** (App Router, Turbopack, `cacheComponents`), React 19 y Tailwind CSS 4. Esta versión trae cambios importantes respecto a versiones anteriores. Antes de escribir código de Next, lee `AGENTS.md` y la guía correspondiente en `node_modules/next/dist/docs/`.

- Arrancar en desarrollo: `npm run dev` (http://localhost:3000). También está la configuración `la-puja-dev` en `.claude/launch.json`.
- **Comprobación completa:** `npm run check` (tipos + ESLint + formato de Prettier + tests de Vitest). Tiene que pasar en verde antes de cerrar cualquier hito.
- Por separado: `npm run typecheck`, `npm run lint`, `npm run format` (aplica el formato) y `npm test`.
- **Base de datos:** Postgres 18 en Docker (`docker-compose.yml`, contenedor `la-puja-db`, solo en 127.0.0.1:5432). Necesita Docker Desktop abierto. Usa `npm run db:up` para arrancarla, `npm run db:down` para pararla (los datos se conservan en el volumen) y `npm run db:check` para comprobar la conexión desde Drizzle. El cliente del juego está en `src/db/index.ts` y es solo para el servidor.
- **Catálogo:** los lotes viven en `data/lotes.json`. Para cambiarlos, edita el JSON y ejecuta `npm run db:seed`: valida el catálogo (`src/db/catalogo.ts`, con tests) e inserta o actualiza cada lote según su `numero`, sin duplicar.
- **Tasar desde la terminal:** `npm run tasar -- <número de lote> "<oferta>"` tasa una oferta real (sin caché ni base de datos); sin argumentos prueba 4 casos; con `--gemini` usa solo Gemini. Cada tasación gasta ~2.000 tokens del límite gratuito de Groq (8.000 por minuto), así que no lances más de 3-4 seguidas.
- **Lógica de tasación** (`src/tasacion/tasar.ts`): `tasar` prueba Groq y, ante cualquier fallo, responde Gemini. Tras un 429, Groq queda en pausa el `retry-after` que indique (1 s – 10 min). Cada proveedor reintenta una vez si la IA se equivoca de formato, nunca ante un 429.
- **API de tasación:** `POST /api/tasar` con `{ lote, oferta, partidaId }` (`src/app/api/tasar/route.ts`). Una oferta vacía significa "sin oferta" (se acabó el tiempo). Las reglas del lote (`src/tasacion/reglas.ts`) las aplica el servidor a partir de lo registrado en la partida: si es reintento (tope de 5 martillazos), "eso ya se vendió" (misma forma canónica aceptada en otro lote), sin oferta ($0, sin reintento), el ejemplo del lote (1 martillazo) y lote cerrado (409). La lógica está en `src/tasacion/servicio.ts` (solo servidor, con `server-only`): normaliza, busca en la caché `tasaciones`, si no está tasa con la IA y la guarda, calcula el precio y registra la oferta en `ofertas`. El contrato (petición y respuesta) vive en `src/tasacion/peticion.ts`, con tests. Antes de todo, la ruta aplica el límite por IP (`src/lib/limite.ts`: 10/min y 300/día, ventanas deslizantes en memoria, 429 con `Retry-After`); cuenta cualquier oferta, salga o no de la caché.
- **Scripts de Node** (`scripts/*.mts`): el proyecto es `"type": "module"` y los scripts importan código de `src/` con la extensión `.ts` explícita (`allowImportingTsExtensions`), porque Node ejecuta TypeScript directamente y no resuelve imports sin extensión.
- **Esquema y migraciones:** el esquema vive en `src/db/schema.ts`. Al cambiarlo, ejecuta `npm run db:generate -- --name <descripcion>` (crea el SQL en `drizzle/`, que no se edita a mano) y luego `npm run db:migrate`. Para ver los datos, `npm run db:studio`. La caché (`tasaciones`) guarda solo la opinión de la IA; los martillazos y el precio se calculan al jugar y se guardan en `ofertas`.
- Variables de entorno: plantilla en `.env.example` (sin secretos); los valores reales van en `.env.local`.
- Los tests van junto al código, como `src/**/*.test.ts`. El alias `@/` apunta a `src/`.
- `npm audit` marca 5 alertas "high" en la cadena de ESLint (`braces`). Son solo de desarrollo; las dependencias de producción tienen 0 vulnerabilidades. No apliques `npm audit fix --force`, porque baja eslint-config-next a la v14 y la rompe.
- En Windows PowerShell 5.1, no escribas archivos con `Set-Content` ni `Out-File`, porque añaden BOM y estropean las tildes. Usa las herramientas de edición o Node. Los mensajes de commit con comillas dobles se rompen al pasarlos con `-m`: escríbelos en un archivo y usa `git commit -F <archivo>`.

## Convenciones

- Todo el texto del juego va en **español neutro panhispano**, con la voz de Bartolo y el vocabulario de la ficha:
  - Voz: picante pero cariñosa. Llama al jugador "campeón" y "Pillo", y abre con "Damas y caballeros".
  - Vocabulario: lote, oferta, mercancía, martillazos, precio de martillo, fortuna, estrado.
  - La moneda es el dólar genérico ($).
- **Paleta de billete antiguo** como variables CSS:

  | Color         | Hex       | Uso                           |
  | ------------- | --------- | ----------------------------- |
  | Verde billete | `#2E5E4E` | Principal                     |
  | Crema moneda  | `#F1E9D2` | Fondo de las cartas           |
  | Sepia tinta   | `#4A3A2A` | Texto y contornos             |
  | Dorado        | `#C2A15A` | Sellos, monedas y martillo    |
  | Lacre rojo    | `#9E2B25` | ¡VENDIDO!, alertas y comisión |

- **Estética:**
  - Pixel art hi-bit elegante y muy fluido, con referencia a Balatro.
  - Cada lote es una carta tipo título de propiedad.
  - Tipografía pixel con remates, como la de un billete grabado.
- **Sonido:**
  - Cada martillazo suena con un golpe de mazo de madera y un _power stab_ propio, con el carácter del de Jet Set Radio. El stab se sintetiza desde cero y sube de Do a Si.
  - Música: ragtime de salón adaptativo. Un piano gana capas y velocidad con los martillazos, y con 7 entra la banda completa.
  - Monedas y billetes con sonido realista pero con brillo, y un tic-tic de caja registradora antigua cuando sube la cifra.
- Las claves de API viven solo en `.env.local` (nunca en Git ni en el navegador). Las llamadas a la IA se hacen solo en el servidor.
- No uses recursos con derechos de terceros: sonidos, muestras, fuentes y música tienen que ser propios o con licencia libre comprobada. Nunca uses muestras de Jet Set Radio ni de librerías comerciales como Zero-G.
- Si en fases futuras se trabaja con la API de Claude, consulta los modelos y precios actuales en lugar de fiarte de la memoria.

## Comunicación con el usuario

- Responde en español.
- Las decisiones se consultan con preguntas de selección; las explicaciones, breves y en lenguaje claro.
