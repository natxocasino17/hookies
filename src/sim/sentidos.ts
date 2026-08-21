/**
 * Lo que un cuerpo puede llegar a saber del mundo.
 *
 * Un vector de números entre -1 y 1, y **ni uno solo de ellos es una decisión**.
 * Aquí no hay "hay comida al norte" ni "viene un peligro": hay cuánta materia
 * comestible hay hacia un lado y hacia el otro, cuántos cuerpos hay cerca, qué
 * suena en el aire y qué hay rascado en el suelo. Que alguno de esos números
 * quiera decir peligro es cosa de quien lo lea, y hoy no lo lee nadie.
 *
 * ── Por qué existe esto antes que el cerebro ────────────────────────────────
 *
 * En la fase 3 no hay nadie que consuma estos números: los verbos salen del
 * azar. Se construye ahora igualmente y a propósito, porque si llegara junto con
 * el cerebro en la fase 4 y las criaturas no espabilaran, no habría manera de
 * saber si el fallo es del cerebro o es que los sentidos no llevan información.
 * Separado, se puede medir una cosa sin la otra — y se mide: hay un test que
 * comprueba que el olfato apunta de verdad hacia donde hay comida.
 *
 * ── El marco local, y por qué no es arbitrario ──────────────────────────────
 *
 * En una bola no hay norte y sur que valgan para todos. Cada celda arma sus dos
 * direcciones a partir de dónde está, siempre igual, así que "hacia la derecha"
 * quiere decir lo mismo para un cuerpo cada vez que pasa por el mismo sitio.
 * Sin eso, el olfato sería un número distinto cada vez y no habría nada que
 * aprender.
 */

import {
  DANO_MORTAL,
  EJES_DEMASIADO_JUNTOS,
  ESCALA_DE_ABUNDANCIA,
  ESCALA_DE_GENTIO,
  ESCALA_DE_OLFATO,
  MATERIA_DE_LA_CRIA,
  MAX_CADENA_GENOMA,
  MAX_VECINOS,
  NIVEL_DEL_MAR,
  RETENCION_DEL_SUELO,
  TEMP_CONGELACION,
  RANGO_TEMPERATURA_PREFERIDA,
  ENERGIA_PARA_GEMAR,
} from './constants.js';
import type { EstadoMundo } from './estado.js';
import type { Geometria } from './geodesica.js';
import { leerRasgo, RASGO_LONGEVIDAD, RASGO_TAMANO } from './genoma.js';
import { LONGEVIDAD_MINIMA, RANGO_DE_LONGEVIDAD, TAMANO_MINIMO, RANGO_DE_TAMANO } from './constants.js';

/**
 * Qué ocupa cada cosa dentro del vector, y en qué orden.
 *
 * Va como tabla y no como números sueltos por lo mismo que la tabla de verbos:
 * para que el tamaño del vector salga de sumar, y no se pueda meter un sentido
 * nuevo sin que se note.
 */
export const SENTIDOS = [
  /** Cómo está uno por dentro: energía, materia, daño, vejez, temperatura. */
  'INTEROCEPCION',
  /** Dónde está: temperatura, agua, si es mar o tierra. */
  'ENTORNO',
  /** Hacia dónde hay más comida, y cuánta. Dos direcciones y una fuerza. */
  'OLFATO',
  /** Hacia dónde hay más cuerpos, y cuántos. Dos direcciones y una fuerza. */
  'VISTA',
  /** Con cuántos está uno pegado, y de qué tamaño son. */
  'TACTO',
  /** Los cuatro números que suenan en el aire de su celda. */
  'CANAL',
  /** Los cuatro números que hay rascados en el suelo de su celda. */
  'MARCA',
] as const;

export type Sentido = (typeof SENTIDOS)[number];

export const ANCHO_SENTIDO: Record<Sentido, number> = {
  INTEROCEPCION: 5,
  ENTORNO: 3,
  OLFATO: 3,
  VISTA: 3,
  TACTO: 2,
  CANAL: 4,
  MARCA: 4,
};

/** Tamaño del vector de sentidos. Derivado de la tabla, nunca escrito a mano. */
export const N_SENTIDOS = SENTIDOS.reduce((total, s) => total + ANCHO_SENTIDO[s], 0);

/** Dónde empieza cada sentido dentro del vector. */
export const DESPLAZAMIENTO_SENTIDO: Record<Sentido, number> = (() => {
  const mapa = {} as Record<Sentido, number>;
  let cursor = 0;
  for (const s of SENTIDOS) {
    mapa[s] = cursor;
    cursor += ANCHO_SENTIDO[s];
  }
  return mapa;
})();

/**
 * Aplasta cualquier número al rango -1 a 1 sin cortarlo de golpe.
 *
 * `x / (1 + |x|)`, que es suave, barata y —esto es lo que importa— solo usa
 * sumas y divisiones. Nada de `tanh` ni de `exp`: las funciones trascendentes
 * del motor de JavaScript no están especificadas bit a bit y meterían una
 * diferencia entre navegadores justo en la entrada del cerebro (CLAUDE.md §2.1).
 */
function aplastar(x: number): number {
  return x / (1 + (x < 0 ? -x : x));
}

/**
 * Las dos direcciones de la superficie en una celda: siempre las mismas para la
 * misma celda, en cualquier corrida y en cualquier máquina.
 *
 * Se arman cruzando la vertical del sitio con un eje fijo. En los polos ese
 * cruce se queda en nada, y ahí se usa otro eje — no es un caso especial del
 * mundo, es que en un punto de una esfera hace falta elegir de dónde medir.
 *
 * Solo lleva multiplicaciones, restas y una raíz cuadrada, y las tres están
 * especificadas al bit por el estándar. No hay nada aquí que pueda dar distinto
 * en dos navegadores.
 */
function marcoLocal(geo: Geometria, celda: number, salida: Float64Array): void {
  const ax = geo.centro[celda * 3]!;
  const ay = geo.centro[celda * 3 + 1]!;
  const az = geo.centro[celda * 3 + 2]!;

  // eje × arriba. Con el eje Y salvo cerca de los polos, donde se usa el X.
  let ux = az;
  let uy = 0;
  let uz = -ax;
  if (ux * ux + uz * uz < EJES_DEMASIADO_JUNTOS) {
    ux = 0;
    uy = -az;
    uz = ay;
  }
  const nu = Math.sqrt(ux * ux + uy * uy + uz * uz);
  ux /= nu;
  uy /= nu;
  uz /= nu;

  // arriba × u, que ya sale unitario porque los dos lo son y son perpendiculares.
  const vx = ay * uz - az * uy;
  const vy = az * ux - ax * uz;
  const vz = ax * uy - ay * ux;

  salida[0] = ux;
  salida[1] = uy;
  salida[2] = uz;
  salida[3] = vx;
  salida[4] = vy;
  salida[5] = vz;
}

/**
 * Comida que hay en una celda: la carroña tirada más lo que pesan sus plantas.
 *
 * Recorre la lista de plantas de la celda, que tiene doce como mucho. Sin ese
 * índice esto costaría mirar las dieciséis mil ranuras de planta por cada
 * vecina de cada bicho, y sería imposible de pagar.
 */
function comidaEn(estado: EstadoMundo, celda: number): number {
  let total = estado.carrona[celda]!;
  for (let p = estado.cabezaPlantaEnCelda[celda]!; p >= 0; p = estado.siguientePlantaEnCelda[p]!) {
    total += estado.plantaMasa[p]! + estado.plantaFruto[p]!;
  }
  return total;
}

/** Cuántos cuerpos hay en una celda. */
function cuerposEn(estado: EstadoMundo, celda: number): number {
  let n = 0;
  for (let o = estado.cabezaEnCelda[celda]!; o >= 0; o = estado.siguienteEnCelda[o]!) n++;
  return n;
}

/**
 * Llena el vector de sentidos de una criatura.
 *
 * Escribe sobre un vector que se le pasa en vez de crear uno nuevo, porque en la
 * fase 4 esto se va a llamar una vez por bicho y por tick, y crear miles de
 * arrays por segundo llenaría la basura del navegador de trabajo inútil.
 */
export function sentir(
  estado: EstadoMundo,
  geo: Geometria,
  c: number,
  salida: Float32Array,
  marco = new Float64Array(6),
): void {
  const celda = estado.criaturaCelda[c]!;
  const base = c * MAX_CADENA_GENOMA;
  const g = estado.criaturaGenoma;

  // --- Cómo está uno por dentro ---------------------------------------------
  let i = DESPLAZAMIENTO_SENTIDO.INTEROCEPCION;
  salida[i] = aplastar(estado.criaturaEnergia[c]! / ENERGIA_PARA_GEMAR);
  salida[i + 1] = aplastar(estado.criaturaMateria[c]! / MATERIA_DE_LA_CRIA);
  salida[i + 2] = aplastar(estado.criaturaDano[c]! / DANO_MORTAL);
  const vejez =
    estado.criaturaEdad[c]! /
    (LONGEVIDAD_MINIMA + leerRasgo(g, base, RASGO_LONGEVIDAD) * RANGO_DE_LONGEVIDAD);
  salida[i + 3] = aplastar(vejez);
  salida[i + 4] = aplastar(
    (estado.criaturaTemperatura[c]! - TEMP_CONGELACION) / RANGO_TEMPERATURA_PREFERIDA,
  );

  // --- Dónde está -----------------------------------------------------------
  i = DESPLAZAMIENTO_SENTIDO.ENTORNO;
  salida[i] = aplastar((estado.temperatura[celda]! - TEMP_CONGELACION) / RANGO_TEMPERATURA_PREFERIDA);
  salida[i + 1] = aplastar(estado.aguaSuelo[celda]! / RETENCION_DEL_SUELO);
  salida[i + 2] = estado.altura[celda]! >= NIVEL_DEL_MAR ? 1 : -1;

  // --- Hacia dónde hay comida, y hacia dónde hay cuerpos ---------------------
  //
  // Los dos se calculan igual: se mira cuánto hay en cada vecina de más que en
  // la propia y se suma tirando hacia donde está esa vecina. Lo que sale es una
  // flecha. Nadie dice qué hacer con ella.
  marcoLocal(geo, celda, marco);
  const aquiComida = comidaEn(estado, celda);
  const aquiCuerpos = cuerposEn(estado, celda);
  let olfatoU = 0;
  let olfatoV = 0;
  let sumaComida = 0;
  let vistaU = 0;
  let vistaV = 0;
  let sumaCuerpos = 0;

  const vecinos = geo.nVecinos[celda]!;
  for (let k = 0; k < vecinos; k++) {
    const j = geo.vecinos[celda * MAX_VECINOS + k]!;
    const dx = geo.centro[j * 3]! - geo.centro[celda * 3]!;
    const dy = geo.centro[j * 3 + 1]! - geo.centro[celda * 3 + 1]!;
    const dz = geo.centro[j * 3 + 2]! - geo.centro[celda * 3 + 2]!;
    const largo = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (largo <= 0) continue;
    const hu = (dx * marco[0]! + dy * marco[1]! + dz * marco[2]!) / largo;
    const hv = (dx * marco[3]! + dy * marco[4]! + dz * marco[5]!) / largo;

    const dComida = comidaEn(estado, j) - aquiComida;
    olfatoU += hu * dComida;
    olfatoV += hv * dComida;
    sumaComida += comidaEn(estado, j);

    const dCuerpos = cuerposEn(estado, j) - aquiCuerpos;
    vistaU += hu * dCuerpos;
    vistaV += hv * dCuerpos;
    sumaCuerpos += cuerposEn(estado, j);
  }

  i = DESPLAZAMIENTO_SENTIDO.OLFATO;
  salida[i] = aplastar(olfatoU / ESCALA_DE_OLFATO);
  salida[i + 1] = aplastar(olfatoV / ESCALA_DE_OLFATO);
  salida[i + 2] = aplastar(sumaComida / ESCALA_DE_ABUNDANCIA);

  i = DESPLAZAMIENTO_SENTIDO.VISTA;
  salida[i] = aplastar(vistaU);
  salida[i + 1] = aplastar(vistaV);
  salida[i + 2] = aplastar(sumaCuerpos / ESCALA_DE_GENTIO);

  // --- Con quién está pegado -------------------------------------------------
  i = DESPLAZAMIENTO_SENTIDO.TACTO;
  let vecinosAqui = 0;
  let tamanoVecinos = 0;
  for (let o = estado.cabezaEnCelda[celda]!; o >= 0; o = estado.siguienteEnCelda[o]!) {
    if (o === c) continue;
    vecinosAqui++;
    tamanoVecinos +=
      TAMANO_MINIMO + leerRasgo(g, o * MAX_CADENA_GENOMA, RASGO_TAMANO) * RANGO_DE_TAMANO;
  }
  salida[i] = aplastar(vecinosAqui);
  salida[i + 1] = aplastar(tamanoVecinos / ESCALA_DE_GENTIO);

  // --- Lo que suena y lo que hay escrito ------------------------------------
  //
  // Tal cual, sin interpretar. Cuatro números del aire y cuatro del suelo.
  i = DESPLAZAMIENTO_SENTIDO.CANAL;
  for (let k = 0; k < 4; k++) salida[i + k] = aplastar(estado.senalAire[celda * 4 + k]!);
  i = DESPLAZAMIENTO_SENTIDO.MARCA;
  for (let k = 0; k < 4; k++) salida[i + k] = aplastar(estado.marcaSuelo[celda * 4 + k]!);
}
