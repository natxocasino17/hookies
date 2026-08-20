/**
 * Un tick del mundo.
 *
 * Acá va la física, y solo la física. Ninguna función de este archivo puede
 * describir la intención de una criatura (CLAUDE.md §1.1): no hay "buscar
 * comida" ni "huir", hay fuerzas, difusión y costes.
 *
 * Fase 1b: la materia se reparte entre celdas vecinas, y el planeta gira bajo
 * el sol — de ahí salen el día, las estaciones, la temperatura y el ciclo del
 * agua. Nada de eso está escrito como regla: son consecuencias de que la bola
 * gire con el eje torcido.
 */

import { DIFUSION_MATERIA_DIVISOR, MAX_VECINOS } from './constants.js';
import type { EstadoMundo } from './estado.js';
import type { Geometria } from './geodesica.js';
import { siguienteU32 } from './rng.js';
import { avanzarElClima } from './clima.js';
import { avanzarLasPlantas } from './plantas.js';

/**
 * Reparte materia entre celdas vecinas del planeta.
 *
 * Se mueve una fracción entera de la diferencia entre dos celdas contiguas: lo
 * que una pierde es exactamente lo que la otra gana, con lo cual la masa se
 * conserva por construcción y no por aproximación.
 *
 * Cada pareja se toca una sola vez, mirando solo a los vecinos de índice mayor.
 * Si se recorrieran todos los vecinos, cada pareja se procesaría dos veces y la
 * difusión iría al doble de velocidad en unas direcciones que en otras.
 *
 * El barrido alterna de sentido según el azar del mundo porque recorrer siempre
 * en el mismo orden introduce una deriva sistemática, que sería un artefacto
 * del método y no una corriente del planeta.
 */
function difundirMateria(estado: EstadoMundo, geo: Geometria, alReves: boolean): void {
  const { materia } = estado;
  const { vecinos, nVecinos, nCeldas } = geo;
  const divisor = DIFUSION_MATERIA_DIVISOR;

  const primera = alReves ? nCeldas - 1 : 0;
  const paso = alReves ? -1 : 1;

  for (let n = 0; n < nCeldas; n++) {
    const i = primera + n * paso;
    const cuantos = nVecinos[i]!;
    for (let k = 0; k < cuantos; k++) {
      const j = vecinos[i * MAX_VECINOS + k]!;
      if (j <= i) continue;
      const flujo = ((materia[i]! - materia[j]!) / divisor) | 0;
      materia[i] = materia[i]! - flujo;
      materia[j] = materia[j]! + flujo;
    }
  }
}

/** Avanza el mundo un tick. Es la única función que puede modificar el estado. */
export function avanzarUnTick(estado: EstadoMundo, geo: Geometria): void {
  const alReves = (siguienteU32(estado.rng) & 1) === 1;
  difundirMateria(estado, geo, alReves);
  avanzarElClima(estado, geo, alReves);
  avanzarLasPlantas(estado, geo);
  estado.tick += 1;
}
