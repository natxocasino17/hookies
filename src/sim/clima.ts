/**
 * El clima del planeta.
 *
 * Nada de lo que hay aquí es una fórmula inventada para que "parezca" que hay
 * días y estaciones. Todo sale de dos hechos geométricos:
 *
 *   1. La bola gira, así que el sol le da por un lado y por el otro no.
 *   2. El eje está inclinado, así que el punto donde el sol cae a plomo sube y
 *      baja a lo largo del año.
 *
 * De ahí salen solos el día y la noche, las estaciones, los polos fríos y el
 * ecuador caliente. No hay una función "hacerInvierno" ni una tabla de climas,
 * y no puede haberla: son consecuencias, no reglas.
 *
 * El ciclo del agua funciona igual. No hay ninguna regla que diga "llueve en las
 * montañas": hay una que dice que el aire frío no puede con tanta agua, y como
 * arriba hace frío, allí llueve. Y no hay ninguna que dibuje ríos: hay uná que
 * dice que el agua del suelo baja a la celda vecina más baja, y los ríos son
 * simplemente los sitios por donde pasa mucha.
 */

import {
  ALTURA_POR_GOTA,
  CAPACIDAD_TERMICA_AGUA,
  CAPACIDAD_TERMICA_TIERRA,
  DIFUSION_HUMEDAD_DIVISOR,
  DIFUSION_TEMPERATURA_DIVISOR,
  ESCORRENTIA_DIVISOR,
  EVAPORACION_POR_GRADO,
  EVAPORACION_SUELO_FACTOR,
  GRADIENTE_ALTURA,
  GANANCIA_SOLAR,
  HUMEDAD_POR_GRADO,
  INCLINACION_EJE_VUELTAS,
  LLUVIA_DIVISOR,
  MAX_VECINOS,
  NIVEL_DEL_MAR,
  PERDIDA_RADIACION,
  RETENCION_DEL_SUELO,
  TEMP_CONGELACION,
  TEMP_ESPACIO,
  TICKS_POR_ANO,
  TICKS_POR_DIA,
} from './constants.js';
import type { EstadoMundo } from './estado.js';
import type { Geometria } from './geodesica.js';
import { cosenoDeVuelta, dRaiz, senoDeVuelta } from './math.js';

/**
 * Hacia dónde está el sol, visto desde el planeta.
 *
 * La latitud donde el sol cae a plomo oscila entre los dos trópicos a lo largo
 * del año: **eso, y nada más, es la estación**. La longitud da una vuelta
 * completa cada día: eso es el día y la noche.
 */
export function direccionDelSol(tick: number): [number, number, number] {
  const faseAno = (tick % TICKS_POR_ANO) / TICKS_POR_ANO;
  const faseDia = (tick % TICKS_POR_DIA) / TICKS_POR_DIA;

  const senoLatitudSolar = senoDeVuelta(INCLINACION_EJE_VUELTAS) * senoDeVuelta(faseAno);
  const cosLatitudSolar = dRaiz(1 - senoLatitudSolar * senoLatitudSolar);

  return [
    cosLatitudSolar * cosenoDeVuelta(-faseDia),
    senoLatitudSolar,
    cosLatitudSolar * senoDeVuelta(-faseDia),
  ];
}

/**
 * Cuánto sol recibe una celda: el coseno del ángulo entre su superficie y el
 * sol. Si es negativo, el sol está al otro lado del planeta y es de noche.
 *
 * Esta única línea produce el día, la noche, el verano, el invierno y el que los
 * polos estén helados porque el sol les llega de refilón.
 */
export function insolacionDeCelda(
  geo: Geometria,
  celda: number,
  sol: readonly [number, number, number],
): number {
  const d =
    geo.centro[celda * 3]! * sol[0] +
    geo.centro[celda * 3 + 1]! * sol[1] +
    geo.centro[celda * 3 + 2]! * sol[2];
  return d > 0 ? d : 0;
}

/** Cuánta agua aguanta el aire de una celda antes de soltarla en forma de lluvia. */
export function capacidadDelAire(temperatura: number): number {
  const sobreCongelacion = temperatura - TEMP_CONGELACION;
  return sobreCongelacion > 0 ? sobreCongelacion * HUMEDAD_POR_GRADO : 0;
}

/**
 * Calienta y enfría cada celda según el sol que le toca, y reparte el calor
 * entre vecinas — que es el viento y las corrientes marinas a la vez.
 */
function moverElCalor(estado: EstadoMundo, geo: Geometria, alReves: boolean): void {
  const { temperatura, altura } = estado;
  const sol = direccionDelSol(estado.tick);

  let entrada = 0;
  let salida = 0;

  for (let i = 0; i < geo.nCeldas; i++) {
    const esAgua = altura[i]! < NIVEL_DEL_MAR;
    const ganancia = insolacionDeCelda(geo, i, sol) * GANANCIA_SOLAR;

    // Las celdas altas están más frías aunque les dé el mismo sol que al valle
    // de al lado: es el gradiente térmico con la altura.
    const sobreElMar = altura[i]! - NIVEL_DEL_MAR;
    const enfriamientoPorAltura = sobreElMar > 0 ? sobreElMar * GRADIENTE_ALTURA : 0;
    const perdida =
      (temperatura[i]! - TEMP_ESPACIO + enfriamientoPorAltura) * PERDIDA_RADIACION;

    const capacidad = esAgua ? CAPACIDAD_TERMICA_AGUA : CAPACIDAD_TERMICA_TIERRA;
    temperatura[i] = temperatura[i]! + (ganancia - perdida) / capacidad;

    entrada += ganancia;
    salida += perdida;
  }

  // Contabilidad de energía (CLAUDE.md §2.2): lo que entra por el sol y lo que
  // se escapa al espacio quedan registrados en cada tick.
  estado.energiaEntrada += entrada;
  estado.energiaSalida += salida;

  repartirEntreVecinas(temperatura, geo, DIFUSION_TEMPERATURA_DIVISOR, alReves);
}

/**
 * Reparto de una magnitud continua entre celdas vecinas.
 * Cada pareja se toca una sola vez, mirando solo a los vecinos de índice mayor.
 */
function repartirEntreVecinas(
  campo: Float32Array,
  geo: Geometria,
  divisor: number,
  alReves: boolean,
): void {
  const { vecinos, nVecinos, nCeldas } = geo;
  const primera = alReves ? nCeldas - 1 : 0;
  const paso = alReves ? -1 : 1;

  for (let n = 0; n < nCeldas; n++) {
    const i = primera + n * paso;
    for (let k = 0; k < nVecinos[i]!; k++) {
      const j = vecinos[i * MAX_VECINOS + k]!;
      if (j <= i) continue;
      const flujo = (campo[i]! - campo[j]!) / divisor;
      campo[i] = campo[i]! - flujo;
      campo[j] = campo[j]! + flujo;
    }
  }
}

/**
 * Reparto de una magnitud entera. Igual que el de arriba pero con división
 * entera, para que lo que una celda pierde sea exactamente lo que la otra gana
 * y la masa se conserve sin aproximaciones.
 */
function repartirEnteroEntreVecinas(
  campo: Int32Array,
  geo: Geometria,
  divisor: number,
  alReves: boolean,
): void {
  const { vecinos, nVecinos, nCeldas } = geo;
  const primera = alReves ? nCeldas - 1 : 0;
  const paso = alReves ? -1 : 1;

  for (let n = 0; n < nCeldas; n++) {
    const i = primera + n * paso;
    for (let k = 0; k < nVecinos[i]!; k++) {
      const j = vecinos[i * MAX_VECINOS + k]!;
      if (j <= i) continue;
      const flujo = ((campo[i]! - campo[j]!) / divisor) | 0;
      campo[i] = campo[i]! - flujo;
      campo[j] = campo[j]! + flujo;
    }
  }
}

/**
 * El ciclo del agua: se evapora, la lleva el viento, llueve, y vuelve al mar
 * bajando por donde puede.
 *
 * Cada paso es un traspaso de enteros entre dos sitios, así que el agua total
 * del planeta no cambia jamás — y hay un test que lo comprueba.
 */
function moverElAgua(estado: EstadoMundo, geo: Geometria, alReves: boolean): void {
  const { temperatura, altura, aguaSuelo, humedadAire, flujoAgua, lluvia } = estado;

  lluvia.fill(0);

  for (let i = 0; i < geo.nCeldas; i++) {
    const esAgua = altura[i]! < NIVEL_DEL_MAR;
    const calor = temperatura[i]! - TEMP_CONGELACION;

    // --- Evaporación: el agua helada no se evapora ---------------------------
    if (calor > 0) {
      const ritmo = esAgua ? EVAPORACION_POR_GRADO : EVAPORACION_POR_GRADO * EVAPORACION_SUELO_FACTOR;
      let cuanto = (calor * ritmo) | 0;
      if (cuanto > aguaSuelo[i]!) cuanto = aguaSuelo[i]!;
      if (cuanto > 0) {
        aguaSuelo[i] = aguaSuelo[i]! - cuanto;
        humedadAire[i] = humedadAire[i]! + cuanto;
      }
    }

    // --- Lluvia: el aire frío no puede con tanta agua y suelta el exceso ------
    const cabe = capacidadDelAire(temperatura[i]!) | 0;
    const sobra = humedadAire[i]! - cabe;
    if (sobra > 0) {
      const cae = ((sobra / LLUVIA_DIVISOR) | 0) + 1;
      const cuanto = cae > humedadAire[i]! ? humedadAire[i]! : cae;
      humedadAire[i] = humedadAire[i]! - cuanto;
      aguaSuelo[i] = aguaSuelo[i]! + cuanto;
      lluvia[i] = cuanto;
    }
  }

  // --- El viento reparte la humedad -----------------------------------------
  repartirEnteroEntreVecinas(humedadAire, geo, DIFUSION_HUMEDAD_DIVISOR, alReves);

  // --- Escorrentía: el agua del suelo busca la celda vecina más baja ---------
  // De aquí salen los ríos. Nadie los dibuja: son los sitios por donde pasa
  // mucha agua camino del mar.
  //
  // El agua no baja mirando la altura del TERRENO sino la de su propia
  // SUPERFICIE. Es la diferencia entre un charco que se queda quieto en una
  // llanura y uno que se extiende hasta encontrar la salida — y en un planeta
  // de mesetas, donde media tierra tiene los vecinos a su misma altura, es la
  // diferencia entre que haya ríos y que no haya ninguno.
  //
  // El mar cuenta como una superficie plana al nivel del mar: es un solo cuerpo
  // de agua enorme y conectado, no una celda con mucha agua encima.
  const superficieDe = (c: number): number =>
    altura[c]! < NIVEL_DEL_MAR ? NIVEL_DEL_MAR : altura[c]! + aguaSuelo[c]! * ALTURA_POR_GOTA;

  flujoAgua.fill(0);
  for (let i = 0; i < geo.nCeldas; i++) {
    if (altura[i]! < NIVEL_DEL_MAR) continue; // el mar ya está abajo del todo
    const sobrante = aguaSuelo[i]! - RETENCION_DEL_SUELO;
    if (sobrante <= 0) continue;

    const miSuperficie = superficieDe(i);
    let masBaja = -1;
    let superficieMasBaja = miSuperficie;
    for (let k = 0; k < geo.nVecinos[i]!; k++) {
      const j = geo.vecinos[i * MAX_VECINOS + k]!;
      const suya = superficieDe(j);
      if (suya < superficieMasBaja) {
        superficieMasBaja = suya;
        masBaja = j;
      }
    }
    if (masBaja < 0) continue; // un hoyo sin salida: aquí se queda, y es un lago

    // Nunca más de la mitad del desnivel, o el agua rebotaría de una celda a
    // otra en vez de asentarse.
    const mitadDelDesnivel = (((miSuperficie - superficieMasBaja) / ALTURA_POR_GOTA) / 2) | 0;
    let baja = (sobrante / ESCORRENTIA_DIVISOR) | 0;
    if (baja > mitadDelDesnivel) baja = mitadDelDesnivel;
    if (baja <= 0) continue;

    aguaSuelo[i] = aguaSuelo[i]! - baja;
    aguaSuelo[masBaja] = aguaSuelo[masBaja]! + baja;
    flujoAgua[i] = flujoAgua[i]! + baja;
  }
}

/** Un tick de clima. */
export function avanzarElClima(estado: EstadoMundo, geo: Geometria, alReves: boolean): void {
  moverElCalor(estado, geo, alReves);
  moverElAgua(estado, geo, alReves);
}

/** Agua total del planeta, en gotas enteras. El test exige que no cambie jamás. */
export function aguaTotal(estado: EstadoMundo): number {
  let total = 0;
  for (let i = 0; i < estado.aguaSuelo.length; i++) {
    total += estado.aguaSuelo[i]! + estado.humedadAire[i]!;
  }
  return total;
}
