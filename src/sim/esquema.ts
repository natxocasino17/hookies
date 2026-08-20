/**
 * Versión del formato del estado guardado, y sus migraciones.
 *
 * Existe desde el primer commit porque un mundo de meses es lo más valioso del
 * proyecto y **nunca se borra un mundo por un cambio de formato** (CLAUDE.md
 * §2.3). Si falta una migración, se rompe con un mensaje claro en vez de
 * descartar el mundo en silencio.
 *
 * Aviso honesto (decisión D8): el formato va a cambiar mucho entre fases, así
 * que los mundos creados antes de la fase 6 se consideran desechables. La
 * maquinaria está desde ya porque es barata, pero la promesa de conservarlos
 * para siempre empieza a valer cuando el formato se estabilice.
 */

/**
 * Versión actual del formato. Se sube en cada cambio incompatible.
 *
 * v2: la cabecera guarda el cursor de búsqueda de huecos de planta. Sin él,
 * cargar un mundo hacía que las semillas cayeran en huecos distintos y el futuro
 * dejaba de ser el mismo. No lleva migración desde la v1 a propósito: la v1
 * nunca llegó a guardarse en ningún disco — la persistencia es de la fase 6 —
 * así que no hay ningún mundo que rescatar.
 *
 * v3: los dímeros pasan a tener su propio cajón en la sopa, así que el archivo
 * lleva 36 números más por celda. Tampoco lleva migración, y por lo mismo: la
 * persistencia sigue siendo de la fase 6 y no hay ningún mundo guardado en
 * ningún disco todavía.
 *
 * v4: llegan los cuerpos, con su genoma de miles de átomos. Sin migración por lo
 * mismo de siempre.
 */
export const VERSION_ESQUEMA = 4;

/** Marca al principio del archivo, para no intentar abrir cualquier cosa. */
export const MARCA_ARCHIVO = 0x484f4f4b; // "HOOK"

/** Una migración lleva los bytes de una versión a la siguiente. */
export type Migracion = (bytes: Uint8Array) => Uint8Array;

/**
 * Migraciones registradas, indexadas por la versión de la que parten.
 * `MIGRACIONES[3]` convierte un estado de la versión 3 a la 4.
 *
 * Todavía vacío: la versión 1 es la primera que existe.
 */
export const MIGRACIONES: Record<number, Migracion> = {};

/** Error específico para poder distinguirlo y avisar bien en la interfaz. */
export class ErrorDeMigracion extends Error {
  constructor(
    readonly desde: number,
    readonly hasta: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDeMigracion';
  }
}

/**
 * Lleva unos bytes guardados desde su versión hasta la actual, aplicando las
 * migraciones una a una. Devuelve los mismos bytes si ya estaba al día.
 */
export function migrar(bytes: Uint8Array, desde: number): Uint8Array {
  if (desde === VERSION_ESQUEMA) return bytes;

  if (desde > VERSION_ESQUEMA) {
    throw new ErrorDeMigracion(
      desde,
      VERSION_ESQUEMA,
      `Este mundo se guardó con la versión ${desde} del formato y esta app entiende hasta la ${VERSION_ESQUEMA}. ` +
        `El mundo no se toca: hace falta una versión más nueva de la app para abrirlo.`,
    );
  }

  let actuales = bytes;
  for (let v = desde; v < VERSION_ESQUEMA; v++) {
    const migracion = MIGRACIONES[v];
    if (!migracion) {
      throw new ErrorDeMigracion(
        desde,
        VERSION_ESQUEMA,
        `Falta la migración de la versión ${v} a la ${v + 1}. El mundo no se borra ni se modifica; ` +
          `hay que escribir esa migración antes de poder abrirlo.`,
      );
    }
    actuales = migracion(actuales);
  }
  return actuales;
}
