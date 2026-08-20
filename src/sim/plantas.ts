/**
 * Las plantas.
 *
 * AVISO HONESTO (decisión D19): esto es **andamio provisional**. Un hongo es un
 * ser que no se mueve y come materia muerta; una planta, uno que no se mueve y
 * come luz. Los dos deberían salir del mismo espacio de genomas que las
 * criaturas, porque tener "plantas" por un lado y "bichos" por otro es partir el
 * árbol de la vida a mano — y eso es exactamente la clase de lista predefinida
 * que el proyecto prohíbe. Cuando lleguen los cuerpos de la fase 3, esto se
 * sustituye por cuerpos con genes de no moverse.
 *
 * Dicho eso, lo que hay aquí ya no es decorado:
 *
 *  · La materia de una planta **sale del suelo** y vuelve al suelo al morir, así
 *    que el test de masa cubre también a la vegetación.
 *  · Las semillas heredan los genes de su madre **con erratas**, así que los
 *    linajes se adaptan al sitio donde les tocó caer. Un bosque de secano y uno
 *    de ribera acaban siendo parientes lejanos, y nadie lo escribió.
 *  · No hay lista de especies. Lo que se vea agrupado en el espacio de genes es
 *    lo que llamaremos una especie, a posteriori.
 */

import {
  AGUA_POR_CRECIMIENTO,
  CRECIMIENTO_MAXIMO,
  DESGASTE_POR_INANICION,
  FRUTO_POR_SEMILLA,
  GENES_PLANTA,
  IDONEIDAD_DE_SUPERVIVENCIA,
  LONGEVIDAD_PLANTA,
  MASA_DE_SEMILLA,
  MASA_PARA_FRUCTIFICAR,
  MAX_PLANTAS,
  MAX_PLANTAS_POR_CELDA,
  MASA_MINIMA_PLANTA,
  MASA_POR_GEN_TAMANO,
  MAX_VECINOS,
  MUTACION_POR_MIL,
  NIVEL_DEL_MAR,
  N_TIPOS_ATOMO,
  RANGO_TEMPERATURA_PREFERIDA,
  RETENCION_DEL_SUELO,
  SED_BASE,
  SED_POR_GEN,
  TEMP_CONGELACION,
  TOLERANCIA_BASE,
  TOLERANCIA_POR_GEN,
} from './constants.js';
import type { EstadoMundo } from './estado.js';
import type { Geometria } from './geodesica.js';
import { direccionDelSol, insolacionDeCelda } from './clima.js';
import { siguienteEntero, siguienteU32 } from './rng.js';

/**
 * Qué significa cada gen. No es una tabla de especies: son las perillas que
 * tiene el cuerpo de una planta, y cada linaje lleva las suyas.
 */
export const GEN_TAMANO = 0;
export const GEN_CRECIMIENTO = 1;
export const GEN_SED = 2;
export const GEN_TEMPERATURA = 3;
export const GEN_TOLERANCIA = 4;
/** Tres átomos que forman la cadena del fruto. De aquí sale su color y su efecto. */
export const GEN_FRUTO = 5;

/** Masa máxima a la que puede llegar una planta con este gen de tamaño. */
export function masaMaxima(gen: number): number {
  return MASA_MINIMA_PLANTA + gen * MASA_POR_GEN_TAMANO;
}

/**
 * Si el sitio le sirve a esta planta para vivir, entre 0 y 1.
 *
 * Es el agua por la temperatura, y **la luz no entra aquí a propósito**. Fue un
 * error de bulto la primera vez: metiendo la luz en esta cuenta, una planta veía
 * su idoneidad caer a cero todas las noches y se moría de hambre al anochecer.
 * Se extinguía el planeta entero en menos de un año.
 *
 * Una planta no se muere al ponerse el sol. Se muere de sed o de frío. La luz
 * decide lo que CRECE, no si vive, y eso se calcula aparte.
 */
export function viabilidad(
  genoma: Uint8Array,
  base: number,
  agua: number,
  temperatura: number,
): number {
  // Agua: cuanta más sed tiene el gen, más necesita para estar a gusto.
  const sed = SED_BASE + genoma[base + GEN_SED]! * SED_POR_GEN;
  const disponible = agua - RETENCION_DEL_SUELO;
  if (disponible <= 0) return 0;
  const conAgua = disponible / (disponible + sed);

  // Temperatura: una campana alrededor de la que prefiere el linaje. Cuanto más
  // ancha es la campana, más sitios le valen, pero eso cuesta en otros genes.
  const prefiere =
    TEMP_CONGELACION + (genoma[base + GEN_TEMPERATURA]! / 255) * RANGO_TEMPERATURA_PREFERIDA;
  const aguanta = TOLERANCIA_BASE + (genoma[base + GEN_TOLERANCIA]! / 255) * TOLERANCIA_POR_GEN;
  const desvio = (temperatura - prefiere) / aguanta;
  const conTemperatura = 1 / (1 + desvio * desvio);

  return conAgua * conTemperatura;
}

/** Reparte las primeras plantas por la tierra del planeta. */
export function sembrarPrimerasPlantas(estado: EstadoMundo, geo: Geometria, cuantas: number): void {
  const tierra: number[] = [];
  for (let i = 0; i < geo.nCeldas; i++) {
    if (estado.altura[i]! >= NIVEL_DEL_MAR) tierra.push(i);
  }
  if (tierra.length === 0) return;

  for (let n = 0; n < cuantas && n < MAX_PLANTAS; n++) {
    const celda = tierra[siguienteEntero(estado.rng, tierra.length)]!;
    if (estado.plantasEnCelda[celda]! >= MAX_PLANTAS_POR_CELDA) continue;

    const base = n * GENES_PLANTA;
    for (let g = 0; g < GENES_PLANTA; g++) {
      estado.plantaGenoma[base + g] = siguienteEntero(estado.rng, 256);
    }
    // Los átomos del fruto solo pueden ser de los tipos que existen.
    for (let a = 0; a < 3; a++) {
      estado.plantaGenoma[base + GEN_FRUTO + a] = siguienteEntero(estado.rng, N_TIPOS_ATOMO);
    }

    estado.plantaCelda[n] = celda;
    entrarEnLaCelda(estado, n, celda);
    estado.plantaMasa[n] = MASA_DE_SEMILLA;
    estado.plantaEdad[n] = 0;
    estado.plantaFruto[n] = 0;
    estado.plantasEnCelda[celda] = estado.plantasEnCelda[celda]! + 1;
    // La materia de la semilla sale del suelo, no de la nada.
    estado.materia[celda] = estado.materia[celda]! - MASA_DE_SEMILLA;
  }
}

/**
 * Mete una planta en la lista de su celda, en orden de ranura.
 *
 * Las plantas no se mueven, así que esto solo pasa al brotar. El orden importa
 * poco —quien muerde busca la más grande— salvo para desempatar, y desempatar
 * por ranura es lo que hacía el recorrido completo de antes.
 */
export function entrarEnLaCelda(estado: EstadoMundo, p: number, celda: number): void {
  let previa = -1;
  let actual = estado.cabezaPlantaEnCelda[celda]!;
  while (actual >= 0 && actual < p) {
    previa = actual;
    actual = estado.siguientePlantaEnCelda[actual]!;
  }
  estado.siguientePlantaEnCelda[p] = actual;
  if (previa < 0) estado.cabezaPlantaEnCelda[celda] = p;
  else estado.siguientePlantaEnCelda[previa] = p;
}

/** La saca de la lista de su celda. */
function salirDeLaCelda(estado: EstadoMundo, p: number, celda: number): void {
  let previa = -1;
  let actual = estado.cabezaPlantaEnCelda[celda]!;
  while (actual >= 0 && actual !== p) {
    previa = actual;
    actual = estado.siguientePlantaEnCelda[actual]!;
  }
  if (actual !== p) return;
  const detras = estado.siguientePlantaEnCelda[p]!;
  if (previa < 0) estado.cabezaPlantaEnCelda[celda] = detras;
  else estado.siguientePlantaEnCelda[previa] = detras;
  estado.siguientePlantaEnCelda[p] = -1;
}

/** Busca un hueco libre en la lista de plantas. Determinista. */
function huecoLibre(estado: EstadoMundo): number {
  for (let n = 0; n < MAX_PLANTAS; n++) {
    const i = (estado.cursorPlanta + n) % MAX_PLANTAS;
    if (estado.plantaCelda[i]! < 0) {
      estado.cursorPlanta = (i + 1) % MAX_PLANTAS;
      return i;
    }
  }
  return -1;
}

/** Devuelve al suelo toda la materia de una planta y libera su hueco. */
function morir(estado: EstadoMundo, planta: number): void {
  const celda = estado.plantaCelda[planta]!;
  if (celda < 0) return;
  // Nada se pierde: lo que era cuerpo vuelve a ser suelo. Esa es la mitad del
  // trabajo que en un mundo con hongos harían los hongos.
  estado.materia[celda] = estado.materia[celda]! + estado.plantaMasa[planta]! + estado.plantaFruto[planta]!;
  estado.plantaMasa[planta] = 0;
  estado.plantaFruto[planta] = 0;
  salirDeLaCelda(estado, planta, celda);
  estado.plantaCelda[planta] = -1;
  estado.plantasEnCelda[celda] = estado.plantasEnCelda[celda]! - 1;
}

/** Un tick de vegetación. */
export function avanzarLasPlantas(estado: EstadoMundo, geo: Geometria): void {
  const sol = direccionDelSol(estado.tick);
  const { plantaCelda, plantaMasa, plantaEdad, plantaFruto, plantaGenoma } = estado;

  let vivas = 0;
  let masaViva = 0;

  for (let p = 0; p < MAX_PLANTAS; p++) {
    const celda = plantaCelda[p]!;
    if (celda < 0) continue;

    plantaEdad[p] = plantaEdad[p]! + 1;
    const base = p * GENES_PLANTA;

    // Si el sitio le sirve para vivir. No depende de la luz: de noche una
    // planta no crece, pero tampoco se muere.
    const buena = viabilidad(
      plantaGenoma,
      base,
      estado.aguaSuelo[celda]!,
      estado.temperatura[celda]!,
    );
    // La luz solo decide cuánto crece. De noche, cero.
    const luz = insolacionDeCelda(geo, celda, sol);

    if (buena < IDONEIDAD_DE_SUPERVIVENCIA) {
      // Aquí no se vive: se consume. Es lo que seca los bosques cuando el clima
      // les cambia debajo.
      plantaMasa[p] = plantaMasa[p]! - DESGASTE_POR_INANICION;
      estado.materia[celda] = estado.materia[celda]! + DESGASTE_POR_INANICION;
      if (plantaMasa[p]! <= 0) {
        // Devolver lo que se pasó de la cuenta antes de enterrarla.
        estado.materia[celda] = estado.materia[celda]! + plantaMasa[p]!;
        plantaMasa[p] = 0;
        morir(estado, p);
        continue;
      }
    } else {
      const tope = masaMaxima(plantaGenoma[base + GEN_TAMANO]!);
      const empuje = (plantaGenoma[base + GEN_CRECIMIENTO]! / 255) * CRECIMIENTO_MAXIMO;
      let crece = (buena * luz * empuje) | 0;

      // No se crece de la nada: la materia sale de la celda, y el agua también.
      if (crece > estado.materia[celda]!) crece = estado.materia[celda]!;
      const aguaLibre = estado.aguaSuelo[celda]! - RETENCION_DEL_SUELO;
      const tapaAgua = (aguaLibre / AGUA_POR_CRECIMIENTO) | 0;
      if (crece > tapaAgua) crece = tapaAgua;
      if (plantaMasa[p]! + crece > tope) crece = tope - plantaMasa[p]!;

      if (crece > 0) {
        plantaMasa[p] = plantaMasa[p]! + crece;
        estado.materia[celda] = estado.materia[celda]! - crece;
        estado.aguaSuelo[celda] = estado.aguaSuelo[celda]! - crece * AGUA_POR_CRECIMIENTO;
        // El agua que bebe una planta vuelve al aire: transpiración.
        estado.humedadAire[celda] = estado.humedadAire[celda]! + crece * AGUA_POR_CRECIMIENTO;
      }

      // --- Fruto -----------------------------------------------------------
      if (plantaMasa[p]! >= MASA_PARA_FRUCTIFICAR) {
        plantaFruto[p] = plantaFruto[p]! + 1;
        plantaMasa[p] = plantaMasa[p]! - 1;
      }
    }

    // --- Vejez ---------------------------------------------------------------
    if (plantaEdad[p]! > LONGEVIDAD_PLANTA) {
      morir(estado, p);
      continue;
    }

    // --- Sembrar -------------------------------------------------------------
    //
    // La materia de la semilla sale del FRUTO, no del suelo. Este fue un
    // escape de masa de libro: antes se restaba el fruto y aparte se cobraba la
    // semilla al suelo, así que cada siembra hacía desaparecer treinta unidades
    // de materia. El mundo pasó de 2.562.000 a 80.040 en doce años y se quedó
    // sin suelo del que crecer. Lo cazó el test de masa.
    if (plantaFruto[p]! >= FRUTO_POR_SEMILLA) {
      plantaFruto[p] = plantaFruto[p]! - FRUTO_POR_SEMILLA;
      const gastado = sembrar(estado, geo, p, celda);
      // Lo que no se fue en la semilla es fruta caída: se pudre en el suelo.
      estado.materia[celda] = estado.materia[celda]! + (FRUTO_POR_SEMILLA - gastado);
    }

    vivas++;
    masaViva += plantaMasa[p]! + plantaFruto[p]!;
  }

  estado.plantasVivas = vivas;
  estado.masaVegetal = masaViva;
}

/**
 * Suelta una semilla en una celda vecina, con los genes de la madre y erratas.
 * Devuelve la materia que se llevó la semilla, para que quien llama devuelva el
 * resto al suelo y no se pierda ni un átomo.
 */
function sembrar(estado: EstadoMundo, geo: Geometria, madre: number, celdaMadre: number): number {
  // Una vecina al azar, o la propia celda. Sin regla de "buscar buen sitio":
  // la semilla cae donde cae, y si el sitio no vale, se muere.
  const cuantos = geo.nVecinos[celdaMadre]!;
  const elegida = siguienteEntero(estado.rng, cuantos + 1);
  const destino =
    elegida === cuantos ? celdaMadre : geo.vecinos[celdaMadre * MAX_VECINOS + elegida]!;

  if (estado.altura[destino]! < NIVEL_DEL_MAR) return 0; // al agua no
  if (estado.plantasEnCelda[destino]! >= MAX_PLANTAS_POR_CELDA) return 0;

  const hija = huecoLibre(estado);
  if (hija < 0) return 0; // el mundo está lleno de plantas

  const origen = madre * GENES_PLANTA;
  const nueva = hija * GENES_PLANTA;
  for (let g = 0; g < GENES_PLANTA; g++) {
    let valor = estado.plantaGenoma[origen + g]!;
    // Erratas de copia. No es ruido añadido a propósito para "dar variedad":
    // es que copiar sale mal de vez en cuando, y de ahí sale la evolución.
    if (siguienteEntero(estado.rng, 1000) < MUTACION_POR_MIL) {
      const salto = (siguienteU32(estado.rng) & 15) - 7;
      valor = valor + salto;
      if (valor < 0) valor = 0;
      if (valor > 255) valor = 255;
      if (g >= GEN_FRUTO) valor = valor % N_TIPOS_ATOMO;
    }
    estado.plantaGenoma[nueva + g] = valor;
  }

  estado.plantaCelda[hija] = destino;
  entrarEnLaCelda(estado, hija, destino);
  estado.plantaMasa[hija] = MASA_DE_SEMILLA;
  estado.plantaEdad[hija] = 0;
  estado.plantaFruto[hija] = 0;
  estado.plantasEnCelda[destino] = estado.plantasEnCelda[destino]! + 1;
  return MASA_DE_SEMILLA;
}

/** Materia que está dentro de plantas. Hace falta para el test de masa. */
export function materiaEnPlantas(estado: EstadoMundo): number {
  let total = 0;
  for (let p = 0; p < MAX_PLANTAS; p++) {
    if (estado.plantaCelda[p]! < 0) continue;
    total += estado.plantaMasa[p]! + estado.plantaFruto[p]!;
  }
  return total;
}
