/**
 * Qué es una molécula.
 *
 * **Su identidad ES su cadena.** No hay tabla de sustancias, ni catálogo, ni
 * enum: una molécula es una secuencia de átomos y punto. Dos cadenas iguales son
 * la misma molécula porque son la misma cadena, no porque compartan una entrada
 * en ningún sitio.
 *
 * Todo cabe en un entero de 32 bits, y eso no es un capricho: el bucle de la
 * química se recorre millones de veces, y si cada molécula fuera un objeto o un
 * texto, el recolector de basura se comería el presupuesto entero.
 *
 *   bits 0-3   longitud, de 1 a 8
 *   bits 4-27  ocho átomos de 3 bits cada uno
 */

import { AFINIDAD_ATOMO, MAX_CADENA_SOPA, N_TIPOS_ATOMO } from './constants.js';

/** Una molécula empaquetada. Cero significa "no hay nada". */
export type Molecula = number;

export const MOLECULA_VACIA = 0;

/** Cuántos átomos tiene. */
export function longitud(m: Molecula): number {
  return m & 0xf;
}

/** Qué átomo hay en la posición i (0 es el primero). */
export function atomoEn(m: Molecula, i: number): number {
  return (m >>> (4 + i * 3)) & 0x7;
}

/** El primero de la cadena. */
export function primerAtomo(m: Molecula): number {
  return (m >>> 4) & 0x7;
}

/** El último de la cadena. */
export function ultimoAtomo(m: Molecula): number {
  return (m >>> (4 + (longitud(m) - 1) * 3)) & 0x7;
}

/** El hueco que le toca a un dímero en el cajón de los dímeros. */
export function indiceDeDimero(a: number, b: number): number {
  return a * N_TIPOS_ATOMO + b;
}

/** La molécula que corresponde a un hueco del cajón de los dímeros. */
export function dimeroDelIndice(indice: number): Molecula {
  const a = (indice / N_TIPOS_ATOMO) | 0;
  const b = indice % N_TIPOS_ATOMO;
  return 2 | (a << 4) | (b << 7);
}

/** Construye una molécula de un solo átomo. */
export function atomoSuelto(tipo: number): Molecula {
  return 1 | (tipo << 4);
}

/**
 * Pega dos moléculas en una. Devuelve MOLECULA_VACIA si el resultado se pasaría
 * del largo máximo — o sea, hay un tope físico a lo que puede crecer una cadena.
 */
export function unir(a: Molecula, b: Molecula): Molecula {
  const la = longitud(a);
  const lb = longitud(b);
  if (la + lb > MAX_CADENA_SOPA) return MOLECULA_VACIA;

  let resultado = la + lb;
  for (let i = 0; i < la; i++) resultado |= atomoEn(a, i) << (4 + i * 3);
  for (let i = 0; i < lb; i++) resultado |= atomoEn(b, i) << (4 + (la + i) * 3);
  return resultado;
}

/** Se queda con los primeros `cuantos` átomos. */
export function prefijo(m: Molecula, cuantos: number): Molecula {
  let resultado = cuantos;
  for (let i = 0; i < cuantos; i++) resultado |= atomoEn(m, i) << (4 + i * 3);
  return resultado;
}

/** Se queda con lo que hay a partir de la posición `desde`. */
export function sufijo(m: Molecula, desde: number): Molecula {
  const cuantos = longitud(m) - desde;
  let resultado = cuantos;
  for (let i = 0; i < cuantos; i++) resultado |= atomoEn(m, desde + i) << (4 + i * 3);
  return resultado;
}

/** Devuelve la misma cadena con otro átomo en la posición i. */
export function sustituir(m: Molecula, i: number, tipo: number): Molecula {
  return (m & ~(0x7 << (4 + i * 3))) | (tipo << (4 + i * 3));
}

/**
 * El átomo que se complementa perfectamente con este.
 *
 * Es la única regla que dice qué encaja con qué. No hay tabla de parejas: hay
 * un número de afinidad por átomo y esta línea.
 */
export function complementoDe(tipo: number): number {
  return AFINIDAD_ATOMO[N_TIPOS_ATOMO - 1 - tipo]!;
}

/**
 * Lo mal que encajan dos átomos: 0 es la pareja perfecta y N-1 la peor.
 *
 * **Esto es lo que arregló que el mundo no explorara.** Antes la regla era de
 * todo o nada: cada átomo encajaba con exactamente uno y con ningún otro. La
 * consecuencia medida fue que solo podían crecer cadenas estrictamente alternas
 * — `EBEB`, `DCDC` — y de las 811.020 cadenas que podían ser autocatalíticas
 * solo aparecían 36, **las mismas en todas las semillas**. El 99,99 % del
 * espacio era inalcanzable.
 *
 * Ahora encajar es cuestión de grado: la pareja perfecta se une fácil, y las
 * demás cada vez menos, pero **ninguna es imposible**. Y hay una consecuencia
 * que sale sola y que me gusta: un enlace mal emparejado, además de raro, es
 * débil, así que se rompe antes. Las cadenas raras existen de forma pasajera —
 * que es exactamente lo que hace falta para explorar sin que el mundo se llene
 * de basura permanente.
 */
export function desajuste(a: number, b: number): number {
  const d = complementoDe(a) - AFINIDAD_ATOMO[b]!;
  return d < 0 ? -d : d;
}

/** ¿Son la pareja perfecta? Solo para mirar y para los tests. */
export function encajan(a: number, b: number): boolean {
  return desajuste(a, b) === 0;
}

/** Para escribirla en pantalla. Solo se usa para mirar, nunca dentro del bucle. */
export function comoTexto(m: Molecula): string {
  const letras = 'ABCDEF';
  let salida = '';
  for (let i = 0; i < longitud(m); i++) salida += letras[atomoEn(m, i)] ?? '?';
  return salida;
}
