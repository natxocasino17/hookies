/**
 * El viento.
 *
 * No es una capa aparte ni un efecto: es la consecuencia de que el aire caliente
 * pese menos que el frío, más el hecho de que el planeta gira. Nada más.
 *
 * Lo que trae, y por lo que vale la pena:
 *
 *  · **Tiempo meteorológico.** Sin viento, la humedad solo se difunde y el
 *    sistema se queda en un equilibrio de llovizna uniforme. Con viento hay
 *    sitios a los que llega aire cargado y sitios a los que llega aire seco.
 *  · **Sombras de lluvia.** El aire que sube una montaña se enfría y descarga
 *    de un lado; al otro lado baja seco. Nadie escribe "desierto": queda detrás.
 *  · **Y lo que de verdad importa al proyecto: el viento lleva el olor.** El
 *    olfato es uno de los sentidos de las criaturas. Un bicho que huele algo que
 *    viene de barlovento sabe algo que el de al lado no sabe, y esa información
 *    asimétrica es el motor de todo lo que queremos que llegue a pasar.
 */

import {
  ARRASTRE_DE_CALOR,
  ARRASTRE_DE_HUMEDAD,
  DESVIO_POR_ROTACION,
  MAX_VECINOS,
  PRESION_POR_ALTURA,
  PRESION_POR_GRADO,
} from './constants.js';
import type { EstadoMundo } from './estado.js';
import type { Geometria } from './geodesica.js';
import { dRaiz } from './math.js';

/**
 * Calcula hacia dónde sopla el viento en cada celda.
 *
 * Va del sitio de más presión al de menos, se desvía por la rotación del
 * planeta, y se aplasta contra el suelo porque el aire no puede salir de la
 * esfera.
 */
export function calcularViento(estado: EstadoMundo, geo: Geometria): void {
  const { temperatura, altura, viento } = estado;
  const { centro, vecinos, nVecinos, nCeldas } = geo;

  // El aire caliente pesa menos, y arriba hay menos aire encima.
  const presion = (c: number): number =>
    -temperatura[c]! * PRESION_POR_GRADO - altura[c]! * PRESION_POR_ALTURA;

  for (let i = 0; i < nCeldas; i++) {
    const nx = centro[i * 3]!;
    const ny = centro[i * 3 + 1]!;
    const nz = centro[i * 3 + 2]!;
    const mia = presion(i);

    // Hacia dónde baja la presión, sumando lo que dice cada vecina.
    let gx = 0;
    let gy = 0;
    let gz = 0;
    for (let k = 0; k < nVecinos[i]!; k++) {
      const j = vecinos[i * MAX_VECINOS + k]!;
      const peso = mia - presion(j);
      gx += (centro[j * 3]! - nx) * peso;
      gy += (centro[j * 3 + 1]! - ny) * peso;
      gz += (centro[j * 3 + 2]! - nz) * peso;
    }

    // Coriolis: lo que se mueve sobre una bola que gira se desvía. El eje del
    // planeta es la vertical, así que la latitud sale directamente de ny: cero
    // en el ecuador, máximo en los polos, y con el signo cambiado en cada
    // hemisferio. Por eso las borrascas giran al revés al cruzar el ecuador.
    //
    // Es el producto vectorial del eje (0,1,0) con el gradiente.
    const desvio = DESVIO_POR_ROTACION * ny;
    let vx = gx + gz * desvio;
    let vy = gy;
    let vz = gz - gx * desvio;

    // El aire no puede salirse de la esfera. Se aplasta contra el suelo AL
    // FINAL, después de la desviación: si se proyecta antes, Coriolis vuelve a
    // sacar el viento fuera de la superficie y deja de correr pegado a ella.
    const haciaFuera = vx * nx + vy * ny + vz * nz;
    vx -= haciaFuera * nx;
    vy -= haciaFuera * ny;
    vz -= haciaFuera * nz;

    viento[i * 3] = vx;
    viento[i * 3 + 1] = vy;
    viento[i * 3 + 2] = vz;
  }
}

/**
 * Arrastra la humedad con el viento.
 *
 * Cada celda reparte una parte de su agua entre las vecinas que tiene a favor
 * del viento, en proporción a lo alineadas que estén. Es un traspaso de enteros,
 * así que lo que sale de una entra en otra exactamente y el agua del planeta
 * sigue sin cambiar.
 */
/** Reparto entre vecinas, reaprovechado para no pedir memoria en cada tick. */
const repartoDeTrabajo = new Float64Array(MAX_VECINOS);

export function arrastrarHumedad(estado: EstadoMundo, geo: Geometria): void {
  const { humedadAire, viento } = estado;
  const { centro, vecinos, nVecinos, nCeldas } = geo;

  // Se lee de una copia para que el aire que llega a una celda no vuelva a
  // salir en el mismo tick: si no, el viento correría a velocidades distintas
  // según el orden en que se recorren las celdas. El buffer se reaprovecha en
  // vez de pedir memoria nueva cada tick.
  const antes = estado.copiaEnteros;
  antes.set(humedadAire);
  const reparto = repartoDeTrabajo;

  for (let i = 0; i < nCeldas; i++) {
    const carga = antes[i]!;
    if (carga <= 0) continue;

    const vx = viento[i * 3]!;
    const vy = viento[i * 3 + 1]!;
    const vz = viento[i * 3 + 2]!;

    let total = 0;
    const cuantos = nVecinos[i]!;
    for (let k = 0; k < cuantos; k++) {
      const j = vecinos[i * MAX_VECINOS + k]!;
      const proyeccion =
        (centro[j * 3]! - centro[i * 3]!) * vx +
        (centro[j * 3 + 1]! - centro[i * 3 + 1]!) * vy +
        (centro[j * 3 + 2]! - centro[i * 3 + 2]!) * vz;
      const aFavor = proyeccion > 0 ? proyeccion : 0;
      reparto[k] = aFavor;
      total += aFavor;
    }
    if (total <= 0) continue; // sin viento a favor, el aire se queda quieto

    const seVa = (carga * ARRASTRE_DE_HUMEDAD) | 0;
    if (seVa <= 0) continue;

    let repartido = 0;
    for (let k = 0; k < cuantos; k++) {
      const trozo = ((seVa * reparto[k]!) / total) | 0;
      if (trozo <= 0) continue;
      const j = vecinos[i * MAX_VECINOS + k]!;
      humedadAire[j] = humedadAire[j]! + trozo;
      repartido += trozo;
    }
    humedadAire[i] = humedadAire[i]! - repartido;
  }
}

/** Arrastra el calor con el viento, que es de donde salen los frentes. */
export function arrastrarCalor(estado: EstadoMundo, geo: Geometria): void {
  const { temperatura, viento } = estado;
  const { centro, vecinos, nVecinos, nCeldas } = geo;
  const antes = estado.copiaDecimales;
  antes.set(temperatura);

  for (let i = 0; i < nCeldas; i++) {
    const vx = viento[i * 3]!;
    const vy = viento[i * 3 + 1]!;
    const vz = viento[i * 3 + 2]!;

    for (let k = 0; k < nVecinos[i]!; k++) {
      const j = vecinos[i * MAX_VECINOS + k]!;
      const proyeccion =
        (centro[j * 3]! - centro[i * 3]!) * vx +
        (centro[j * 3 + 1]! - centro[i * 3 + 1]!) * vy +
        (centro[j * 3 + 2]! - centro[i * 3 + 2]!) * vz;
      if (proyeccion <= 0) continue;

      // La celda de sotavento se acerca a la temperatura del aire que le llega.
      // Lo que una gana lo pierde la otra, así que el calor total no cambia.
      const cuanto = (antes[i]! - antes[j]!) * proyeccion * ARRASTRE_DE_CALOR;
      temperatura[j] = temperatura[j]! + cuanto;
      temperatura[i] = temperatura[i]! - cuanto;
    }
  }
}

/** Fuerza media del viento, para la telemetría. */
export function vientoMedio(estado: EstadoMundo): number {
  const { viento } = estado;
  let suma = 0;
  const n = viento.length / 3;
  for (let i = 0; i < n; i++) {
    const x = viento[i * 3]!;
    const y = viento[i * 3 + 1]!;
    const z = viento[i * 3 + 2]!;
    suma += dRaiz(x * x + y * y + z * z);
  }
  return suma / n;
}
