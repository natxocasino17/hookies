/**
 * LOS CINCO VERBOS. Única fuente de verdad.
 *
 * Todo lo que una criatura puede hacer en el mundo está en esta lista y no hay
 * nada más. No se agrega un sexto (CLAUDE.md §1.2). El test de ausencia de
 * guion falla si esta lista crece o si crece el vector de salida del cerebro.
 *
 * Lo que la gente esperaría encontrar acá y NO está, porque ya se puede hacer
 * con lo que hay:
 *
 *   comer      → es MORDER algo que resulta comestible
 *   atacar     → es MORDER algo que resulta vivo
 *   aparearse  → es AGARRAR: el contacto pone en juego la química de los gametos
 *   hablar     → es EMITIR_SENAL
 *   escribir   → es RASCAR_SUELO, si alguna vez le encuentran significado
 *   construir  → es AGARRAR y SOLTAR cosas en algún lado
 *   huir       → es MOVER en la dirección contraria
 *
 * Ninguno de esos siete tiene código propio, y por eso ninguno está garantizado.
 * Pueden pasar o no pasar nunca.
 */

export const VERBOS = ['MOVER', 'AGARRAR_SOLTAR', 'MORDER', 'EMITIR_SENAL', 'RASCAR_SUELO'] as const;

export type Verbo = (typeof VERBOS)[number];

/** Cuántos números ocupa cada verbo en el vector de salida del cerebro. */
export const ANCHO_SALIDA: Record<Verbo, number> = {
  /** Dirección del movimiento: dos componentes, x e y. */
  MOVER: 2,
  /** Un solo número: por encima de su umbral agarra, por debajo suelta. */
  AGARRAR_SOLTAR: 1,
  /** Un solo número: por encima de su umbral, muerde lo que tenga delante. */
  MORDER: 1,
  /** La señal es un vector de cuatro números. No es una palabra de una lista. */
  EMITIR_SENAL: 4,
  /** Un solo número: por encima de su umbral, rasca la celda donde está parado. */
  RASCAR_SUELO: 1,
};

/**
 * Tamaño total del vector de salida del cerebro. Derivado de la tabla de
 * arriba, nunca escrito a mano: si alguien intentara meter un verbo nuevo, este
 * número cambiaría y el test saltaría.
 */
export const N_SALIDAS_CEREBRO = VERBOS.reduce((total, v) => total + ANCHO_SALIDA[v], 0);

/** Posición donde empieza cada verbo dentro del vector de salida. */
export const DESPLAZAMIENTO_SALIDA: Record<Verbo, number> = (() => {
  const mapa = {} as Record<Verbo, number>;
  let cursor = 0;
  for (const v of VERBOS) {
    mapa[v] = cursor;
    cursor += ANCHO_SALIDA[v];
  }
  return mapa;
})();
