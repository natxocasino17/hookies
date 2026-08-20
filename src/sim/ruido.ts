/**
 * Ruido 3D determinista, para generar el terreno del planeta.
 *
 * Tiene que ser 3D y no 2D: sobre una esfera, un ruido plano deja una costura
 * donde el mapa se cierra y un revoltijo en los polos. Evaluándolo en el punto
 * del espacio donde está la celda, no hay ni costura ni polos raros, porque el
 * ruido no sabe que hay una esfera.
 *
 * Es ruido de valor con interpolación suave, y sale del mismo mezclador de
 * enteros que el generador de azar: mismos bits en cualquier navegador.
 */

import { OCTAVAS_TERRENO, PERSISTENCIA_TERRENO, LACUNARIDAD_TERRENO } from './constants.js';

/** Valor pseudoaleatorio en [-1, 1] para un punto entero de la retícula. */
function valorEnRejilla(x: number, y: number, z: number, semilla: number): number {
  let h = semilla | 0;
  h = Math.imul(h ^ (x | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (y | 0), 0x165667b1);
  h = Math.imul(h ^ (z | 0), 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  // A [-1, 1] con una división exacta por una potencia de dos.
  return ((h >>> 0) / 2147483648) - 1;
}

/** Curva suave de Perlin: plana en los dos extremos, sin esquinas visibles. */
function suavizar(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Una octava de ruido en un punto del espacio. */
function ruido3D(x: number, y: number, z: number, semilla: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = suavizar(x - x0);
  const fy = suavizar(y - y0);
  const fz = suavizar(z - z0);

  const mezclar = (a: number, b: number, t: number) => a + (b - a) * t;

  const c000 = valorEnRejilla(x0, y0, z0, semilla);
  const c100 = valorEnRejilla(x0 + 1, y0, z0, semilla);
  const c010 = valorEnRejilla(x0, y0 + 1, z0, semilla);
  const c110 = valorEnRejilla(x0 + 1, y0 + 1, z0, semilla);
  const c001 = valorEnRejilla(x0, y0, z0 + 1, semilla);
  const c101 = valorEnRejilla(x0 + 1, y0, z0 + 1, semilla);
  const c011 = valorEnRejilla(x0, y0 + 1, z0 + 1, semilla);
  const c111 = valorEnRejilla(x0 + 1, y0 + 1, z0 + 1, semilla);

  return mezclar(
    mezclar(mezclar(c000, c100, fx), mezclar(c010, c110, fx), fy),
    mezclar(mezclar(c001, c101, fx), mezclar(c011, c111, fx), fy),
    fz,
  );
}

/**
 * Varias octavas sumadas: la primera pone los continentes, las siguientes van
 * añadiendo cordilleras, colinas y rugosidad. Es lo que hace que un terreno
 * parezca terreno y no una sábana ondulada.
 */
export function ruidoFractal(
  x: number,
  y: number,
  z: number,
  semilla: number,
  frecuencia: number,
): number {
  let suma = 0;
  let amplitud = 1;
  let amplitudTotal = 0;
  let f = frecuencia;

  for (let octava = 0; octava < OCTAVAS_TERRENO; octava++) {
    // Cada octava usa una semilla distinta para que no se calquen entre sí.
    suma += ruido3D(x * f, y * f, z * f, (semilla + octava * 0x9e3779b9) | 0) * amplitud;
    amplitudTotal += amplitud;
    amplitud *= PERSISTENCIA_TERRENO;
    f *= LACUNARIDAD_TERRENO;
  }

  return suma / amplitudTotal;
}
