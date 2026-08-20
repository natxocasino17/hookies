/**
 * El terreno del planeta, generado desde la semilla.
 *
 * No hay mapa dibujado por nadie: la altura de cada celda sale de evaluar ruido
 * en el punto del espacio donde está esa celda. Misma semilla, mismo planeta,
 * siempre y en cualquier navegador.
 */

import {
  ALZADO_DE_LA_ORILLA,
  COMPRESION_FONDO_MARINO,
  ESCALA_RELIEVE,
  HUNDIDO_DEL_MAR,
  ESCALONES_RELIEVE,
  FRECUENCIA_CONTINENTES,
  NIVEL_DEL_MAR,
} from './constants.js';
import type { Geometria } from './geodesica.js';
import { ruidoFractal } from './ruido.js';

/**
 * Altura cruda de cada celda, entre -1 y 1 más o menos, ya redondeada a
 * escalones. El nivel del mar está en NIVEL_DEL_MAR: por debajo hay agua.
 *
 * Los escalones son los que producen las mesetas y los acantilados. Como cada
 * celda se dibuja con la tapa plana a su altura, dos vecinas en escalones
 * distintos dejan una pared entre ellas.
 */
export function generarAltura(geo: Geometria, semilla: number): Float32Array {
  const altura = new Float32Array(geo.nCeldas);

  for (let i = 0; i < geo.nCeldas; i++) {
    const x = geo.centro[i * 3]!;
    const y = geo.centro[i * 3 + 1]!;
    const z = geo.centro[i * 3 + 2]!;

    const crudo = ruidoFractal(x, y, z, semilla, FRECUENCIA_CONTINENTES);

    // Redondear a escalones. El fondo del mar se deja liso: escalonarlo no se
    // ve y solo mete ruido en el dibujo.
    if (crudo < NIVEL_DEL_MAR) {
      altura[i] = crudo;
    } else {
      const sobreElMar = crudo - NIVEL_DEL_MAR;
      const escalon = Math.round(sobreElMar * ESCALONES_RELIEVE) / ESCALONES_RELIEVE;
      altura[i] = NIVEL_DEL_MAR + escalon;
    }
  }

  return altura;
}

/** ¿Esta celda está bajo el agua? */
export function esAgua(altura: Float32Array, celda: number): boolean {
  return altura[celda]! < NIVEL_DEL_MAR;
}

/**
 * Radio al que dibujar la tapa de una celda, contando su relieve.
 *
 * La tierra más baja queda a un paso del agua —eso es una playa, y por ahí se
 * baja al mar— mientras que el fondo marino se hunde de verdad. Los acantilados
 * salen solos donde una meseta alta se asoma al mar, no en toda la costa.
 */
export function radioDeCelda(alturaCelda: number, radioPlaneta: number): number {
  if (alturaCelda < NIVEL_DEL_MAR) {
    // El fondo del mar tiene que quedar POR DEBAJO del nivel del mar, o el
    // océano no lo tapa y el suelo marino asoma peleándose con la superficie.
    // Se comprime porque el relieve abisal no se aprecia bajo el agua.
    const profundidad =
      HUNDIDO_DEL_MAR + (NIVEL_DEL_MAR - alturaCelda) * COMPRESION_FONDO_MARINO;
    return radioPlaneta * (1 + (NIVEL_DEL_MAR - profundidad) * ESCALA_RELIEVE);
  }
  const sobreElMar = alturaCelda - NIVEL_DEL_MAR;
  return radioPlaneta * (1 + (NIVEL_DEL_MAR + ALZADO_DE_LA_ORILLA + sobreElMar) * ESCALA_RELIEVE);
}

/** Radio de la superficie del océano. La usa el dibujo para poner la bola de agua. */
export function radioDelMar(radioPlaneta: number): number {
  return radioPlaneta * (1 + NIVEL_DEL_MAR * ESCALA_RELIEVE);
}

/** Fracción de celdas que quedaron por encima del nivel del mar. */
export function fraccionDeTierra(altura: Float32Array): number {
  let tierra = 0;
  for (let i = 0; i < altura.length; i++) if (altura[i]! >= NIVEL_DEL_MAR) tierra++;
  return tierra / altura.length;
}
