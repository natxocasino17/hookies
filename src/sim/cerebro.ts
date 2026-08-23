/**
 * El cerebro.
 *
 * ── Lo que hay, y lo que NO ─────────────────────────────────────────────────
 *
 * Hay una red por criatura: 24 sentidos entran, 64 neuronas ocultas con
 * recurrencia piensan, y salen los nueve números de los cinco verbos. Los pesos
 * salen del genoma — **un átomo, un peso** — así que una errata al copiar mueve
 * un peso un escalón, y los aciertos y los errores se heredan igual.
 *
 * Lo que NO hay, y esto es lo importante: **ninguna función de este archivo sabe
 * qué es la comida, ni el peligro, ni otra criatura**. La red no tiene una
 * salida que se llame "huir" ni una entrada que se llame "hambre". Tiene números
 * que entran y números que salen, y lo que signifiquen es cosa de la selección.
 * Si un linaje acaba corriendo cuando huele carroña, no habrá una línea de
 * código que lo diga.
 *
 * ── Qué se hereda y qué se aprende ──────────────────────────────────────────
 *
 * La capa oculta y su recurrencia **no cambian nunca dentro de una vida**: eso
 * es el instinto, y lo afina la evolución de generación en generación. Lo que
 * cambia en vida es la capa de salida, que es la que traduce lo que el cerebro
 * está pensando en lo que el cuerpo hace.
 *
 * Ese reparto no es un capricho: guardar una traza de aprendizaje por cada uno
 * de los 6.281 pesos serían 75 MB con tres mil bichos, y por neurona en vez de
 * por peso son 0,9 MB. Pero además tiene sentido de suyo, y es una arquitectura
 * conocida — un cuerpo recurrente heredado con una lectura que se ajusta.
 *
 * Queda apuntado como límite: si los cerebros no despegan, éste es uno de los
 * primeros sitios donde mirar.
 *
 * ── La recompensa ───────────────────────────────────────────────────────────
 *
 * Una sola, y no hay más (CLAUDE.md §1.5): **lo que ha cambiado la energía menos
 * el dolor** de un tick al siguiente. Comer sube la energía y por eso comer sale
 * bien. Que te muerdan sube el dolor y por eso sale mal. No se premia comunicar,
 * ni cooperar, ni explorar, ni reproducirse. Lo que llegue a pasar tendrá que
 * pasar porque lleva a comer y a no sufrir.
 */

import {
  APRENDIZAJE_POR_DIEZ_MIL,
  COSTE_POR_NEURONA,
  IMITACION_POR_MIL,
  INERCIA_DE_NEURONA,
  MEMORIA_DE_LO_NORMAL_POR_MIL,
  MAX_CADENA_GENOMA,
  N_TIPOS_ATOMO,
  OCULTAS_EN_MEMORIA,
  OCULTAS_MINIMAS,
  PERMANENCIA_TRAZA_POR_MIL,
  RANGO_DE_PESO,
  TEMBLOR_DE_LA_SALIDA,
  TOPE_DE_PESO_APRENDIDO,
} from './constants.js';
import type { EstadoMundo } from './estado.js';
import { leerRasgo, RASGO_CEREBRO, ATOMOS_DE_RASGOS } from './genoma.js';
import { VENTANA_DE_TINTE } from './constants.js';
import { dTanh } from './math.js';
import { N_SENTIDOS } from './sentidos.js';
import { N_SALIDAS_CEREBRO } from './verbos.js';
import { siguienteDecimal } from './rng.js';

/**
 * Dónde empiezan los pesos dentro del genoma: justo después de los rasgos y del
 * trozo que se usa para el color.
 */
export const PESOS_EN_EL_GENOMA = ATOMOS_DE_RASGOS + VENTANA_DE_TINTE;

/** Cuántos pesos tiene cada trozo de la red. */
export const N_PESOS_ENTRADA = N_SENTIDOS * OCULTAS_EN_MEMORIA;
export const N_PESOS_RECURRENTES = OCULTAS_EN_MEMORIA * OCULTAS_EN_MEMORIA;
export const N_PESOS_SALIDA = OCULTAS_EN_MEMORIA * N_SALIDAS_CEREBRO;
export const N_SESGOS = OCULTAS_EN_MEMORIA + N_SALIDAS_CEREBRO;
export const N_PESOS_TOTALES =
  N_PESOS_ENTRADA + N_PESOS_RECURRENTES + N_PESOS_SALIDA + N_SESGOS;

/** Desde dónde se lee cada trozo. */
const DESDE_ENTRADA = PESOS_EN_EL_GENOMA;
const DESDE_RECURRENTE = DESDE_ENTRADA + N_PESOS_ENTRADA;
const DESDE_SALIDA = DESDE_RECURRENTE + N_PESOS_RECURRENTES;
const DESDE_SESGOS = DESDE_SALIDA + N_PESOS_SALIDA;

/**
 * Un átomo del genoma leído como peso.
 *
 * Seis valores repartidos entre -RANGO y +RANGO, porque un átomo solo puede ser
 * uno de seis tipos. Es una resolución basta y se dice sin adornos: es la
 * consecuencia directa de que el genoma sea química de verdad y no un vector de
 * decimales. La finura sale de tener miles de pesos, no de que cada uno sea fino.
 */
export function pesoDelAtomo(atomo: number): number {
  return ((atomo / (N_TIPOS_ATOMO - 1)) * 2 - 1) * RANGO_DE_PESO;
}

/**
 * Cuántas neuronas usa de verdad este cerebro.
 *
 * Entre el mínimo y todas las que hay en memoria, según su gen. Las apagadas no
 * se calculan, así que un cerebro grande cuesta tiempo y energía de verdad, y el
 * gen tiene algo contra lo que equilibrarse.
 */
export function ocultasActivas(genomas: Uint8Array, base: number): number {
  const cuantas =
    OCULTAS_MINIMAS +
    Math.floor(leerRasgo(genomas, base, RASGO_CEREBRO) * (OCULTAS_EN_MEMORIA - OCULTAS_MINIMAS));
  return cuantas > OCULTAS_EN_MEMORIA ? OCULTAS_EN_MEMORIA : cuantas;
}

/** Lo que cuesta por tick tener encendido este cerebro. */
export function costeDePensar(activas: number): number {
  return activas * COSTE_POR_NEURONA;
}

/**
 * Copia los pesos de salida del genoma al sitio donde el cuerpo los va a ir
 * cambiando durante su vida.
 *
 * Se hace al nacer. A partir de ahí, los del genoma se quedan como estaban —son
 * lo que le va a pasar a sus crías— y los de la copia son los que aprende.
 * O sea: **lo que uno aprende en vida no se hereda**, solo se hereda lo que
 * traía escrito. Que es como funciona esto.
 */
export function estrenarCerebro(estado: EstadoMundo, c: number): void {
  const genoma = c * MAX_CADENA_GENOMA + DESDE_SALIDA;
  const mio = c * N_PESOS_SALIDA;
  for (let i = 0; i < N_PESOS_SALIDA; i++) {
    estado.criaturaPesosSalida[mio + i] = pesoDelAtomo(estado.criaturaGenoma[genoma + i]!);
  }
  const oculta = c * OCULTAS_EN_MEMORIA;
  for (let i = 0; i < OCULTAS_EN_MEMORIA; i++) {
    estado.criaturaOculta[oculta + i] = 0;
    estado.criaturaTrazaOculta[oculta + i] = 0;
  }
  const salida = c * N_SALIDAS_CEREBRO;
  for (let i = 0; i < N_SALIDAS_CEREBRO; i++) estado.criaturaTrazaSalida[salida + i] = 0;

  // El bienestar arranca en lo que el cuerpo tiene AHORA, no en cero.
  //
  // Esto fue un fallo de los gordos y costó entenderlo. La recompensa es cuánto
  // ha cambiado la energía menos el dolor de un tick al siguiente; si se arranca
  // de cero, el primer tick de vida ve un premio fantasma de +120 —toda la
  // energía con la que se nace— y el aprendizaje lanza todos los pesos de salida
  // contra su tope en la primera vuelta. Cada cerebro nacía ya deformado, con
  // todos los verbos a tope, y el mundo entero se extinguía: pico de 17
  // criaturas contra las 1.682 del control.
  //
  // Por eso `estrenarCerebro` se llama DESPUÉS de darle su energía al cuerpo, y
  // no antes.
  estado.criaturaBienestar[c] = estado.criaturaEnergia[c]! - estado.criaturaDano[c]!;
  estado.criaturaEsperado[c] = 0;
}

/**
 * Un paso de pensamiento: entran los sentidos, sale lo que el cuerpo va a hacer.
 *
 * La capa oculta se lee a sí misma del tick anterior. Eso es la recurrencia, y
 * es lo que permite que un cuerpo pueda hacer algo que dependa de lo que pasó
 * antes y no solo de lo que tiene delante — sin eso, no habría manera de que
 * nada durase más de un instante.
 *
 * `dTanh` y no `Math.tanh`: las trascendentes del motor de JavaScript no están
 * especificadas bit a bit, y aquí se usan miles de veces por tick. Dos
 * navegadores darían mundos distintos (CLAUDE.md §2.1).
 */
export function pensar(
  estado: EstadoMundo,
  c: number,
  sentidos: Float32Array,
  salida: Float32Array,
  activas: number,
): void {
  const g = estado.criaturaGenoma;
  const base = c * MAX_CADENA_GENOMA;
  const oculta = c * OCULTAS_EN_MEMORIA;
  const pesosSalida = c * N_PESOS_SALIDA;

  // Las ocultas nuevas se calculan a partir de los sentidos de ahora y de las
  // ocultas de antes, así que hacen falta las de antes enteras antes de pisar
  // ninguna.
  const antes = estado.copiaOculta;
  for (let h = 0; h < activas; h++) antes[h] = estado.criaturaOculta[oculta + h]!;

  // Cada suma se reparte entre la raíz de cuántas cosas se están sumando.
  //
  // Sin esto el cerebro no sirve para nada, y se vio midiendo: con cuarenta
  // entradas de peso hasta 1,2 y signos al azar, la suma antes del tanh se va a
  // ±7, y tanh(7) es 1. Las nueve salidas salían clavadas en +1 o -1, sin un
  // solo valor intermedio: un interruptor binario en vez de un cerebro.
  //
  // Repartir por la raíz no es un truco de afinado, es lo que mantiene la suma
  // en la zona donde el tanh todavía distingue. Y que sea por la raíz de las
  // ACTIVAS y no de las que hay en memoria importa: si no, un cerebro pequeño
  // saldría flojo y uno grande saturado, y el gen del tamaño estaría decidiendo
  // algo que no tiene que decidir.
  const escalaEntrada = 1 / Math.sqrt(N_SENTIDOS);
  const escalaOculta = 1 / Math.sqrt(activas);

  for (let h = 0; h < activas; h++) {
    let deFuera = 0;
    const filaEntrada = base + DESDE_ENTRADA + h * N_SENTIDOS;
    for (let s = 0; s < N_SENTIDOS; s++) {
      deFuera += pesoDelAtomo(g[filaEntrada + s]!) * sentidos[s]!;
    }
    let deDentro = 0;
    const filaRec = base + DESDE_RECURRENTE + h * OCULTAS_EN_MEMORIA;
    for (let k = 0; k < activas; k++) {
      deDentro += pesoDelAtomo(g[filaRec + k]!) * antes[k]!;
    }
    const suma =
      pesoDelAtomo(g[base + DESDE_SESGOS + h]!) + deFuera * escalaEntrada + deDentro * escalaOculta;
    // Inercia: la neurona arrastra parte de lo que traía en vez de recalcularse
    // de cero. Sin esto el bucle recurrente se realimenta y todas acaban
    // clavadas en ±1 (ver INERCIA_DE_NEURONA).
    estado.criaturaOculta[oculta + h] =
      antes[h]! * INERCIA_DE_NEURONA + dTanh(suma) * (1 - INERCIA_DE_NEURONA);
  }

  const traza = c * N_SALIDAS_CEREBRO;
  for (let o = 0; o < N_SALIDAS_CEREBRO; o++) {
    let deDentro = 0;
    for (let h = 0; h < activas; h++) {
      deDentro +=
        estado.criaturaPesosSalida[pesosSalida + h * N_SALIDAS_CEREBRO + o]! *
        estado.criaturaOculta[oculta + h]!;
    }
    // El temblor: cada salida sale movida un poco de donde el cerebro la puso.
    // Es lo que hace que el bicho pruebe cosas, y sin probar cosas no hay nada
    // que aprender (ver TEMBLOR_DE_LA_SALIDA). Se guarda **el temblor**, no la
    // salida, porque lo que el aprendizaje tiene que reforzar es la desviación
    // que salió bien, no lo que el bicho ya hacía de todas formas.
    const tiembla = (siguienteDecimal(estado.rng) * 2 - 1) * TEMBLOR_DE_LA_SALIDA;
    estado.criaturaTrazaSalida[traza + o] =
      (estado.criaturaTrazaSalida[traza + o]! * PERMANENCIA_TRAZA_POR_MIL) / 1000 +
      tiembla * (1 - PERMANENCIA_TRAZA_POR_MIL / 1000);
    salida[o] = dTanh(
      pesoDelAtomo(g[base + DESDE_SESGOS + OCULTAS_EN_MEMORIA + o]!) +
        deDentro * escalaOculta +
        tiembla,
    );
  }
}

/**
 * Aprender de lo que acaba de pasar.
 *
 * La recompensa es lo que ha cambiado la energía menos el dolor, y no hay otra.
 * Se multiplica por la traza —qué neuronas venían estando activas— y eso decide
 * cuánto se mueve cada peso de salida. Sin backpropagation y sin nada que sepa
 * qué es bueno: solo "esto que estaba pasando salió bien, refuérzalo un poco".
 *
 * La traza guarda por neurona en vez de por peso. Es una aproximación, y se dice:
 * la elegibilidad del peso que va de la oculta h a la salida o se estima como el
 * producto de las dos trazas. Por peso serían 75 MB con tres mil bichos.
 */
export function aprender(estado: EstadoMundo, c: number, activas: number): void {
  const ahora = estado.criaturaEnergia[c]! - estado.criaturaDano[c]!;
  const cambio = ahora - estado.criaturaBienestar[c]!;
  estado.criaturaBienestar[c] = ahora;

  // Lo que se premia es que le vaya MEJOR DE LO QUE LE SUELE IR, no que le vaya
  // bien a secas. Sigue siendo energía menos dolor y nada más: no hay ninguna
  // recompensa nueva, solo se le ha quitado el suelo.
  //
  // Sin esto el aprendizaje no funciona, y no es un detalle de afinado. Estar
  // vivo cuesta, así que el cambio de energía es negativo casi todos los ticks;
  // el aprendizaje se pasaba la vida castigando lo que el bicho hiciera, fuera
  // lo que fuera, hasta apagarlo. Medido: se movían el 1,3 % de los ticks contra
  // el 35 % del control. Es lo mismo que hace la dopamina, que no señala el
  // premio sino la sorpresa.
  const recompensa = cambio - estado.criaturaEsperado[c]!;
  estado.criaturaEsperado[c] =
    estado.criaturaEsperado[c]! * (MEMORIA_DE_LO_NORMAL_POR_MIL / 1000) +
    cambio * (1 - MEMORIA_DE_LO_NORMAL_POR_MIL / 1000);

  const oculta = c * OCULTAS_EN_MEMORIA;
  const salida = c * N_SALIDAS_CEREBRO;
  const pesos = c * N_PESOS_SALIDA;

  // La traza envejece y recoge lo que está activo ahora.
  for (let h = 0; h < activas; h++) {
    // Media que envejece, no suma. Como suma, la traza se estabilizaba en cuatro
    // veces y media el valor de la neurona, y multiplicada por la otra traza
    // amplificaba el paso de aprendizaje por siete sin que se viera de dónde
    // salía.
    estado.criaturaTrazaOculta[oculta + h] =
      (estado.criaturaTrazaOculta[oculta + h]! * PERMANENCIA_TRAZA_POR_MIL) / 1000 +
      estado.criaturaOculta[oculta + h]! * (1 - PERMANENCIA_TRAZA_POR_MIL / 1000);
  }

  if (recompensa === 0) return;
  const paso = (recompensa * APRENDIZAJE_POR_DIEZ_MIL) / 10000;

  for (let h = 0; h < activas; h++) {
    const trazaH = estado.criaturaTrazaOculta[oculta + h]!;
    if (trazaH === 0) continue;
    for (let o = 0; o < N_SALIDAS_CEREBRO; o++) {
      const i = pesos + h * N_SALIDAS_CEREBRO + o;
      let w = estado.criaturaPesosSalida[i]! + paso * trazaH * estado.criaturaTrazaSalida[salida + o]!;
      if (w > TOPE_DE_PESO_APRENDIDO) w = TOPE_DE_PESO_APRENDIDO;
      if (w < -TOPE_DE_PESO_APRENDIDO) w = -TOPE_DE_PESO_APRENDIDO;
      estado.criaturaPesosSalida[i] = w;
    }
  }
}

/**
 * Copiarle un poco a alguien que acaba de tener suerte.
 *
 * No hay verbo "enseñar" ni verbo "mirar", y nadie decide imitar: si en tu celda
 * alguien acaba de darse un atracón, algo de cómo lo estaba haciendo se te pega.
 *
 * **Nada evita que se pegue una asociación equivocada.** Si al de al lado le
 * llegó la suerte mientras rascaba el suelo, se copia también lo de rascar el
 * suelo. Las supersticiones que salgan de ahí son contenido, no bugs — y se
 * heredan como todo lo demás.
 *
 * Funciona porque todos los cerebros tienen el mismo tamaño en memoria y solo
 * cambia cuántas neuronas usan (riesgo §5): sin eso, los índices no se
 * corresponderían y copiar sería ruido destructivo en vez de cultura.
 */
export function imitar(estado: EstadoMundo, quien: number, aQuien: number, activas: number): void {
  const mios = quien * N_PESOS_SALIDA;
  const suyos = aQuien * N_PESOS_SALIDA;
  for (let h = 0; h < activas; h++) {
    for (let o = 0; o < N_SALIDAS_CEREBRO; o++) {
      const i = h * N_SALIDAS_CEREBRO + o;
      const diferencia = estado.criaturaPesosSalida[suyos + i]! - estado.criaturaPesosSalida[mios + i]!;
      estado.criaturaPesosSalida[mios + i] =
        estado.criaturaPesosSalida[mios + i]! + (diferencia * IMITACION_POR_MIL) / 1000;
    }
  }
}
