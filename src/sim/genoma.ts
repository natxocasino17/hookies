/**
 * El genoma, y cómo se lee.
 *
 * Un genoma es una cadena larguísima de átomos — miles — de la misma química
 * que todo lo demás (decisión D2). No es una estructura con campos: es una
 * secuencia, y los rasgos del cuerpo salen de leerla por trozos.
 *
 * Por qué una cadena larga y no las de doce átomos de la sopa: en doce átomos
 * caben 31 bits de información, y de ahí tienen que salir once rasgos del cuerpo
 * **más los miles de pesos del cerebro** que llegan en la fase 4. No entra por
 * tres órdenes de magnitud. Con el genoma largo, un átomo es un peso, y la
 * mutación sigue siendo lo que tiene que ser: **una errata al copiar la propia
 * química**, pequeña y local (RIESGOS §3).
 *
 * Cada rasgo se lee promediando una ventana ancha de átomos. Eso importa: una
 * errata sola apenas mueve el rasgo, hacen falta varias. Así el cuerpo cambia
 * despacio a lo largo de generaciones en vez de pegar saltos, que es lo que
 * permite que la selección acumule algo.
 */

import {
  ERRATA_POR_DIEZ_MIL,
  LARGO_DE_TRAMO,
  MAX_CADENA_GENOMA,
  N_TIPOS_ATOMO,
  VENTANA_DE_RASGO,
} from './constants.js';
import { siguienteEntero } from './rng.js';
import type { EstadoRng } from './rng.js';

/**
 * Los rasgos que salen del genoma.
 *
 * No es una lista de tipos de bicho ni una tabla de especies: son las perillas
 * que tiene cualquier cuerpo, y cada linaje lleva las suyas. Una especie será,
 * a posteriori, un montón de genomas parecidos.
 */
export const RASGO_TAMANO = 0;
export const RASGO_VELOCIDAD = 1;
export const RASGO_METABOLISMO = 2;
export const RASGO_LONGEVIDAD = 3;
export const RASGO_VISION = 4;
export const RASGO_OLFATO = 5;
export const RASGO_UMBRAL_DOLOR = 6;
export const RASGO_CEREBRO = 7;
export const RASGO_COSTE_SENAL = 8;
export const RASGO_EDAD_FERTIL = 9;
export const RASGO_DIETA_VEGETAL = 10;
export const RASGO_DIETA_CARNE = 11;
export const RASGO_TEMPERATURA = 12;
export const N_RASGOS = 13;

/** Átomos del genoma que se gastan en rasgos. El resto queda para el cerebro. */
export const ATOMOS_DE_RASGOS = N_RASGOS * VENTANA_DE_RASGO;

/**
 * Lee un rasgo del genoma: un número entre 0 y 1.
 *
 * Es el promedio de una ventana de átomos. Ancha a propósito — ver arriba.
 */
export function leerRasgo(genoma: Uint8Array, base: number, rasgo: number): number {
  const desde = base + rasgo * VENTANA_DE_RASGO;
  let suma = 0;
  for (let i = 0; i < VENTANA_DE_RASGO; i++) suma += genoma[desde + i]!;
  return suma / (VENTANA_DE_RASGO * (N_TIPOS_ATOMO - 1));
}

/**
 * Construye el primer genoma de un linaje a partir de la molécula que se
 * condensó.
 *
 * La cadena del ciclo autocatalítico se repite hasta llenar el genoma. Así, dos
 * ciclos distintos dan cuerpos distintos, y como cada mundo desarrolla sus
 * propios ciclos (fase 2), cada mundo tiene sus propios primeros bichos.
 *
 * El desorden que se le añade viene del azar sembrado del mundo, y queda dicho
 * sin adornos: **es la parte menos emergente de todo el proyecto**. Sin él, todos
 * los cuerpos nacidos del mismo ciclo serían clones exactos y no habría nada que
 * seleccionar.
 */
export function genomaDesdeLaCadena(
  destino: Uint8Array,
  base: number,
  atomosDelCiclo: number[],
  rng: EstadoRng,
): void {
  const largo = atomosDelCiclo.length;
  for (let i = 0; i < MAX_CADENA_GENOMA; i++) {
    let atomo = atomosDelCiclo[i % largo]!;
    // Una errata cada tanto, para que dos cuerpos del mismo ciclo no sean
    // clones. La tasa es la misma que la de copia entre generaciones.
    if (siguienteEntero(rng, 10000) < ERRATA_POR_DIEZ_MIL * 40) {
      atomo = siguienteEntero(rng, N_TIPOS_ATOMO);
    }
    destino[base + i] = atomo;
  }
}

/**
 * Copia un genoma con erratas.
 *
 * No es ruido añadido a propósito para "dar variedad": es que copiar miles de
 * átomos sale mal de vez en cuando. Los aciertos y los errores se heredan
 * igual, y de ahí sale todo lo demás.
 */
export function copiarConErratas(
  genomas: Uint8Array,
  origen: number,
  destino: number,
  rng: EstadoRng,
): void {
  for (let i = 0; i < MAX_CADENA_GENOMA; i++) {
    let atomo = genomas[origen + i]!;
    if (siguienteEntero(rng, 10000) < ERRATA_POR_DIEZ_MIL) {
      // La errata es local: cambia a un átomo vecino en el alfabeto, no a uno
      // cualquiera. Así el rasgo se mueve un poco, no da un salto.
      atomo = atomo + (siguienteEntero(rng, 2) === 0 ? -1 : 1);
      if (atomo < 0) atomo = 0;
      if (atomo >= N_TIPOS_ATOMO) atomo = N_TIPOS_ATOMO - 1;
    }
    genomas[destino + i] = atomo;
  }
}

/**
 * Mezcla dos genomas en uno, con erratas.
 *
 * Se recorre la cadena copiando de uno de los dos progenitores y, de vez en
 * cuando, se cambia de progenitor. Eso es recombinación: la cría lleva tramos
 * enteros de cada uno, no una media. Importa que sean tramos y no átomos
 * sueltos, porque un rasgo se lee promediando una ventana ancha: mezclando
 * átomo a átomo, cada rasgo de la cría saldría siempre en el punto medio de los
 * padres y no habría nada nuevo. Con tramos largos, un rasgo puede venir entero
 * de uno de los dos, y aparecen combinaciones que ninguno de los dos tenía.
 *
 * Las erratas son las mismas que al copiar: locales y de la misma tasa. Copiar
 * miles de átomos sale mal de vez en cuando, se haga de uno o de dos.
 */
export function recombinarConErratas(
  genomas: Uint8Array,
  padreA: number,
  padreB: number,
  destino: number,
  rng: EstadoRng,
): void {
  let deA = siguienteEntero(rng, 2) === 0;
  for (let i = 0; i < MAX_CADENA_GENOMA; i++) {
    // El cambio de progenitor se tira a cada átomo, así que los tramos salen de
    // largo variable en vez de cortarse siempre por los mismos sitios.
    if (siguienteEntero(rng, LARGO_DE_TRAMO) === 0) deA = !deA;
    let atomo = genomas[(deA ? padreA : padreB) + i]!;
    if (siguienteEntero(rng, 10000) < ERRATA_POR_DIEZ_MIL) {
      atomo = atomo + (siguienteEntero(rng, 2) === 0 ? -1 : 1);
      if (atomo < 0) atomo = 0;
      if (atomo >= N_TIPOS_ATOMO) atomo = N_TIPOS_ATOMO - 1;
    }
    genomas[destino + i] = atomo;
  }
}

/**
 * Cuánto se parecen dos genomas, de 0 (nada) a 1 (idénticos).
 *
 * De aquí sale la compatibilidad para reproducirse, y por tanto las especies.
 * No hay ningún campo "especie" que gobierne nada: dos poblaciones que llevan
 * mucho tiempo separadas acumulan erratas distintas, su parecido baja, y llega
 * un día en que ya no pueden cruzarse. **Eso es una especie nueva**, y se detecta
 * mirando, no se declara.
 *
 * Se compara una muestra repartida por todo el genoma en vez de los ocho mil
 * átomos: con ochocientos puntos el error de muestreo es despreciable y cuesta
 * diez veces menos.
 */
export function parecidoEntreGenomas(
  genomas: Uint8Array,
  a: number,
  b: number,
  muestras = 800,
): number {
  const paso = Math.floor(MAX_CADENA_GENOMA / muestras) || 1;
  let iguales = 0;
  let miradas = 0;
  for (let i = 0; i < MAX_CADENA_GENOMA; i += paso) {
    if (genomas[a + i] === genomas[b + i]) iguales++;
    miradas++;
  }
  return miradas > 0 ? iguales / miradas : 0;
}
