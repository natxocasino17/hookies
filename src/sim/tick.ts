/**
 * Un tick del mundo.
 *
 * Acá va la física, y solo la física. Ninguna función de este archivo puede
 * describir la intención de una criatura (CLAUDE.md §1.1): no hay "buscar
 * comida" ni "huir", hay fuerzas, difusión y costes.
 *
 * Fase 0: lo único que ocurre es que la materia se reparte entre celdas
 * vecinas. Es poco, pero es física real y exactamente conservativa, así que el
 * test de masa está probando algo de verdad desde el primer día. Las fases
 * siguientes agregan capas encima sin cambiar esta forma.
 */

import { DIFUSION_MATERIA_DIVISOR } from './constants.js';
import type { EstadoMundo } from './estado.js';
import { siguienteU32 } from './rng.js';

/**
 * Reparte materia entre celdas vecinas.
 *
 * Se mueve una fracción entera de la diferencia entre dos celdas contiguas: lo
 * que una pierde es exactamente lo que la otra gana, con lo cual la masa se
 * conserva por construcción y no por aproximación.
 *
 * El barrido alterna de sentido según el azar del mundo porque recorrer siempre
 * en la misma dirección introduce una deriva sistemática hacia ese lado, que
 * sería un artefacto del método y no una corriente del mundo.
 */
function difundirMateria(estado: EstadoMundo, alReves: boolean): void {
  const { materia, ancho, alto } = estado;
  const divisor = DIFUSION_MATERIA_DIVISOR;

  const paso = alReves ? -1 : 1;
  const primeraFila = alReves ? alto - 1 : 0;
  const finFila = alReves ? -1 : alto;
  const primeraCol = alReves ? ancho - 1 : 0;

  // Vecinos horizontales.
  for (let y = primeraFila; y !== finFila; y += paso) {
    const fila = y * ancho;
    for (let n = 0; n < ancho - 1; n++) {
      const x = alReves ? primeraCol - n : primeraCol + n;
      const i = fila + x;
      const j = fila + (alReves ? x - 1 : x + 1);
      const flujo = ((materia[i]! - materia[j]!) / divisor) | 0;
      materia[i] = materia[i]! - flujo;
      materia[j] = materia[j]! + flujo;
    }
  }

  // Vecinos verticales.
  for (let n = 0; n < alto - 1; n++) {
    const y = alReves ? primeraFila - n : primeraFila + n;
    const fila = y * ancho;
    const filaVecina = (alReves ? y - 1 : y + 1) * ancho;
    for (let x = 0; x < ancho; x++) {
      const i = fila + x;
      const j = filaVecina + x;
      const flujo = ((materia[i]! - materia[j]!) / divisor) | 0;
      materia[i] = materia[i]! - flujo;
      materia[j] = materia[j]! + flujo;
    }
  }
}

/** Avanza el mundo un tick. Es la única función que puede modificar el estado. */
export function avanzarUnTick(estado: EstadoMundo): void {
  const alReves = (siguienteU32(estado.rng) & 1) === 1;
  difundirMateria(estado, alReves);
  estado.tick += 1;
}
