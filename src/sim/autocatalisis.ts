/**
 * Buscar ciclos autocatalíticos.
 *
 * Un ciclo autocatalítico es un grupo de moléculas que se catalizan unas a otras
 * en círculo, de forma que el grupo entero se ayuda a producirse a sí mismo.
 * **Eso es un microbio**, y es lo único que la fase 2 tiene que encontrar.
 *
 * Y lo importante de cómo está hecho esto: **no hay ninguna entidad "microbio"
 * en el modelo** (CLAUDE.md §1.3). Nada en la química sabe que existe tal cosa.
 * Esto es un observador que mira las cadenas que hay y las reglas que rigen, y
 * comprueba si se da la condición. Si un día no encuentra nada, la respuesta es
 * "no ha aparecido", no "hay que programarlo".
 *
 * Lo que se detecta:
 *
 *  · **Autocatálisis directa**: una molécula que cataliza la reacción que la
 *    produce a ella misma. Es el caso más limpio.
 *  · **Ciclos de dos**: A ayuda a fabricar B y B ayuda a fabricar A. Ninguna se
 *    basta sola, pero juntas se sostienen.
 *
 * Lo que NO se detecta todavía, y queda dicho: ciclos de tres o más. Son más
 * raros de encontrar y mucho más caros de buscar. Si algún día hacen falta,
 * el sitio es este archivo.
 */

import { N_TIPOS_ATOMO, TOP_N_MOLECULAS } from './constants.js';
import type { EstadoMundo } from './estado.js';
import {
  atomoEn,
  comoTexto,
  encajan,
  longitud,
  MOLECULA_VACIA,
  prefijo,
  primerAtomo,
  sufijo,
  ultimoAtomo,
  unir,
  type Molecula,
} from './molecula.js';

/** ¿La cadena `catalizador` sujeta el enlace entre los átomos `a` y `b`? */
function catalizaEnlace(catalizador: Molecula, a: number, b: number): boolean {
  const largo = longitud(catalizador);
  for (let i = 0; i + 1 < largo; i++) {
    if (encajan(atomoEn(catalizador, i), a) && encajan(atomoEn(catalizador, i + 1), b)) return true;
  }
  return false;
}

/**
 * ¿Esta molécula cataliza alguna de las reacciones que la producen a ella misma?
 *
 * Se prueban todas las formas de partirla en dos: si al volver a unir esas dos
 * mitades el enlace que se forma es justo uno que ella misma sabe sujetar,
 * entonces se está ayudando a nacer.
 */
export function esAutocatalitica(m: Molecula): boolean {
  const largo = longitud(m);
  for (let corte = 1; corte < largo; corte++) {
    const a = atomoEn(m, corte - 1);
    const b = atomoEn(m, corte);
    if (catalizaEnlace(m, a, b)) return true;
  }
  return false;
}

/** ¿`ayudante` cataliza alguna reacción que produce `producto`? */
function ayudaAProducir(ayudante: Molecula, producto: Molecula): boolean {
  const largo = longitud(producto);
  for (let corte = 1; corte < largo; corte++) {
    if (catalizaEnlace(ayudante, atomoEn(producto, corte - 1), atomoEn(producto, corte))) {
      return true;
    }
  }
  return false;
}

export interface Hallazgo {
  /** Moléculas que se catalizan a sí mismas y están presentes de verdad. */
  directas: { molecula: Molecula; texto: string; copias: number }[];
  /** Parejas que se ayudan mutuamente. */
  parejas: { a: string; b: string; copias: number }[];
  /** Cuántas moléculas distintas se examinaron. */
  examinadas: number;
}

/**
 * Busca ciclos entre las moléculas que existen ahora mismo en el planeta.
 *
 * Solo se miran las que superan un mínimo de copias: una molécula que aparece
 * una vez y desaparece no sostiene nada, y contarla sería inflar el resultado.
 */
export function buscarCiclos(estado: EstadoMundo, minimoDeCopias = 200): Hallazgo {
  const copias = new Map<Molecula, number>();
  for (let c = 0; c < estado.nCeldas; c++) {
    const base = c * TOP_N_MOLECULAS;
    for (let k = 0; k < TOP_N_MOLECULAS; k++) {
      const m = estado.sopaMolecula[base + k]!;
      if (m === MOLECULA_VACIA) continue;
      const cuantas = estado.sopaCantidad[base + k]!;
      if (cuantas <= 0) continue;
      copias.set(m, (copias.get(m) ?? 0) + cuantas);
    }
  }

  const presentes = [...copias.entries()]
    .filter(([, n]) => n >= minimoDeCopias)
    .sort((x, y) => y[1] - x[1]);

  const directas: Hallazgo['directas'] = [];
  for (const [m, n] of presentes) {
    if (esAutocatalitica(m)) directas.push({ molecula: m, texto: comoTexto(m), copias: n });
  }

  // Parejas: A ayuda a fabricar B y B ayuda a fabricar A, y además las dos
  // mitades de cada una están disponibles en el mundo.
  const parejas: Hallazgo['parejas'] = [];
  for (let i = 0; i < presentes.length; i++) {
    for (let j = i + 1; j < presentes.length; j++) {
      const a = presentes[i]![0];
      const b = presentes[j]![0];
      if (esAutocatalitica(a) || esAutocatalitica(b)) continue; // ya contadas arriba
      if (ayudaAProducir(a, b) && ayudaAProducir(b, a)) {
        parejas.push({
          a: comoTexto(a),
          b: comoTexto(b),
          copias: Math.min(presentes[i]![1], presentes[j]![1]),
        });
      }
    }
  }

  return { directas, parejas, examinadas: presentes.length };
}

/**
 * Cuántas moléculas autocatalíticas serían posibles en abstracto, sin mirar el
 * mundo. Sirve para saber si las reglas las permiten siquiera: si esto diera
 * cero, no habría nada que esperar y habría que cambiar la regla de catálisis.
 */
export function autocataliticasPosibles(largoMaximo: number): number {
  let encontradas = 0;
  const explorar = (m: Molecula, largo: number): void => {
    if (largo >= 2 && esAutocatalitica(m)) encontradas++;
    if (largo >= largoMaximo) return;
    for (let t = 0; t < N_TIPOS_ATOMO; t++) {
      explorar(unir(m, 1 | (t << 4)), largo + 1);
    }
  };
  for (let t = 0; t < N_TIPOS_ATOMO; t++) explorar(1 | (t << 4), 1);
  return encontradas;
}

/** Para el visor de química: de qué dos mitades puede salir una molécula. */
export function partesDe(m: Molecula): { izquierda: string; derecha: string }[] {
  const salida: { izquierda: string; derecha: string }[] = [];
  for (let corte = 1; corte < longitud(m); corte++) {
    const izq = prefijo(m, corte);
    const der = sufijo(m, corte);
    if (encajan(ultimoAtomo(izq), primerAtomo(der))) {
      salida.push({ izquierda: comoTexto(izq), derecha: comoTexto(der) });
    }
  }
  return salida;
}
