/**
 * Las especies, contadas a posteriori.
 *
 * No existe ningún campo "especie" en el estado del mundo y no lo va a haber
 * (CLAUDE.md §1.3). Este archivo no gobierna nada: mira los genomas que hay
 * vivos y cuenta en cuántos grupos caen. Se puede borrar entero y el mundo
 * seguiría exactamente igual — que es la prueba de que no está decidiendo nada.
 *
 * El criterio para agrupar no me lo he inventado aparte: es **el mismo umbral
 * que usa la física** para decidir si dos gametos se funden. Dos criaturas están
 * en el mismo grupo si podrían tener descendencia, y el grupo se cierra por
 * cadenas: si A puede con B y B puede con C, los tres son lo mismo aunque A y C
 * no puedan entre ellos. Esa es la definición de especie que se usa con los
 * seres vivos de verdad, y aquí sale gratis porque la física ya la implementa.
 *
 * Lo honesto sobre lo que cuesta: compara todas las muestras contra todas, así
 * que el coste va al cuadrado. Por eso mira una muestra y no la población
 * entera, y por eso se llama cuando uno quiere mirar, nunca dentro del tick.
 */

import {
  MAX_CADENA_GENOMA,
  MAX_CRIATURAS,
  MUESTRAS_DE_ESPECIES,
  MUESTRAS_DE_GAMETO,
  PARECIDO_MINIMO_PARA_CRUZAR,
} from './constants.js';
import type { EstadoMundo } from './estado.js';
import { parecidoEntreGenomas } from './genoma.js';

/** Lo que se ve al mirar los genomas de un mundo. */
export interface Censo {
  /** Cuántas criaturas se miraron. */
  miradas: number;
  /** En cuántos grupos incompatibles caen. Uno es lo normal; más de uno es la noticia. */
  especies: number;
  /** Cuánta gente hay en cada grupo, de mayor a menor. */
  tamanos: number[];
  /** El parecido más bajo que se ha visto entre dos criaturas vivas. */
  parecidoMinimo: number;
  /** El parecido medio entre las parejas miradas. */
  parecidoMedio: number;
}

/**
 * Coge una muestra repartida de las criaturas vivas.
 *
 * Repartida por número de ranura, que no dice nada de dónde están ni de quiénes
 * son parientes, así que no sesga hacia ningún grupo. Y es determinista, que
 * hace falta para que dos corridas iguales cuenten lo mismo.
 */
function muestrear(estado: EstadoMundo): number[] {
  const vivas: number[] = [];
  for (let c = 0; c < MAX_CRIATURAS; c++) {
    if (estado.criaturaCelda[c]! >= 0) vivas.push(c);
  }
  if (vivas.length <= MUESTRAS_DE_ESPECIES) return vivas;

  const paso = vivas.length / MUESTRAS_DE_ESPECIES;
  const muestra: number[] = [];
  for (let i = 0; i < MUESTRAS_DE_ESPECIES; i++) muestra.push(vivas[Math.floor(i * paso)]!);
  return muestra;
}

/** Busca la raíz de un grupo, aplastando el camino al pasar. */
function raiz(padre: number[], i: number): number {
  while (padre[i] !== i) {
    padre[i] = padre[padre[i]!]!;
    i = padre[i]!;
  }
  return i;
}

/**
 * Cuenta en cuántos grupos que no pueden cruzarse entre sí cae la población.
 *
 * Devolver 1 es el resultado normal y no es un fracaso: quiere decir que todo
 * lo que vive sigue siendo una sola especie. Devolver 2 o más es la noticia, y
 * es el criterio 4 de la fase 3.
 */
export function censarEspecies(estado: EstadoMundo): Censo {
  const muestra = muestrear(estado);
  const n = muestra.length;
  if (n === 0) {
    return { miradas: 0, especies: 0, tamanos: [], parecidoMinimo: 1, parecidoMedio: 1 };
  }

  const padre = muestra.map((_, i) => i);
  const genomas = estado.criaturaGenoma;
  let minimo = 1;
  let suma = 0;
  let parejas = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p = parecidoEntreGenomas(
        genomas,
        muestra[i]! * MAX_CADENA_GENOMA,
        muestra[j]! * MAX_CADENA_GENOMA,
        MUESTRAS_DE_GAMETO,
      );
      suma += p;
      parejas++;
      if (p < minimo) minimo = p;
      if (p >= PARECIDO_MINIMO_PARA_CRUZAR) {
        const ri = raiz(padre, i);
        const rj = raiz(padre, j);
        if (ri !== rj) padre[ri] = rj;
      }
    }
  }

  const cuenta = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const r = raiz(padre, i);
    cuenta.set(r, (cuenta.get(r) ?? 0) + 1);
  }
  const tamanos = [...cuenta.values()].sort((a, b) => b - a);

  return {
    miradas: n,
    especies: tamanos.length,
    tamanos,
    parecidoMinimo: minimo,
    parecidoMedio: parejas > 0 ? suma / parejas : 1,
  };
}
