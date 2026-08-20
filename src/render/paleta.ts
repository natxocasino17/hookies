/**
 * De qué color se pinta cada celda.
 *
 * Regla del proyecto: **nada de lo que se ve es decorativo**. Cada color de la
 * pantalla es la lectura de un número que la simulación calculó de verdad. Si
 * una zona está verde es que tiene agua; si está blanca es que está bajo cero;
 * si hay una nube encima es que ahí va a llover. No hay ni un pixel puesto
 * porque quede bonito.
 */

import { NIVEL_DEL_MAR, RETENCION_DEL_SUELO, TEMP_CONGELACION } from '../sim/constants.js';

/** Interpolación de color entre dos tripletas. */
function mezclar(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
  destino: [number, number, number],
): void {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  destino[0] = a[0] + (b[0] - a[0]) * k;
  destino[1] = a[1] + (b[1] - a[1]) * k;
  destino[2] = a[2] + (b[2] - a[2]) * k;
}

const ARIDO: [number, number, number] = [0.76, 0.68, 0.44];
const PRADERA: [number, number, number] = [0.47, 0.68, 0.29];
const SELVA: [number, number, number] = [0.17, 0.44, 0.19];
const ROCA: [number, number, number] = [0.50, 0.46, 0.40];
const HIELO: [number, number, number] = [0.93, 0.95, 0.97];
const RIO: [number, number, number] = [0.26, 0.55, 0.78];
const BAJIO: [number, number, number] = [0.20, 0.48, 0.60];
const FONDO: [number, number, number] = [0.07, 0.20, 0.40];
const FOSA: [number, number, number] = [0.04, 0.10, 0.23];

/** Con cuánta agua en el suelo una celda está todo lo verde que puede estar. */
const AGUA_PARA_VERDE_PLENO = 220;
/** Caudal a partir del cual una celda se lee como río. */
const CAUDAL_DE_RIO = 15;
/** Altura desde la que la roca asoma por encima de la vegetación. */
const ALTURA_DE_ROCA = 0.42;

export function colorDeCelda(
  altura: number,
  temperatura: number,
  aguaSuelo: number,
  flujoAgua: number,
  destino: [number, number, number],
): void {
  // --- Mar -----------------------------------------------------------------
  if (altura < NIVEL_DEL_MAR) {
    const hondura = NIVEL_DEL_MAR - altura;
    if (hondura > 0.42) destino.splice(0, 3, ...FOSA);
    else if (hondura > 0.14) mezclar(BAJIO, FONDO, (hondura - 0.14) / 0.28, destino);
    else mezclar(BAJIO, BAJIO, 0, destino);
    // Banquisa: el mar helado se ve blanco, y sale de la temperatura de verdad.
    if (temperatura < TEMP_CONGELACION) mezclar(destino as never, HIELO, 0.85, destino);
    return;
  }

  // --- Tierra: el verde ES el agua del suelo -------------------------------
  const humedad = (aguaSuelo - RETENCION_DEL_SUELO) / AGUA_PARA_VERDE_PLENO;
  if (humedad < 0.5) mezclar(ARIDO, PRADERA, humedad * 2, destino);
  else mezclar(PRADERA, SELVA, (humedad - 0.5) * 2, destino);

  // La roca asoma en lo alto, donde el suelo no aguanta vegetación.
  const sobreElMar = altura - NIVEL_DEL_MAR;
  if (sobreElMar > ALTURA_DE_ROCA) {
    mezclar(destino as never, ROCA, (sobreElMar - ALTURA_DE_ROCA) / 0.3, destino);
  }

  // Los ríos: donde pasa mucha agua camino del mar. Nadie los dibujó.
  if (flujoAgua > CAUDAL_DE_RIO) {
    const fuerza = flujoAgua / (CAUDAL_DE_RIO * 6);
    mezclar(destino as never, RIO, fuerza > 0.8 ? 0.8 : fuerza, destino);
  }

  // Nieve: bajo cero, se ve. Por eso las cumbres y los polos son blancos.
  if (temperatura < TEMP_CONGELACION) {
    const cuanto = -temperatura / 12;
    mezclar(destino as never, HIELO, cuanto > 0.9 ? 0.9 : cuanto, destino);
  }
}
