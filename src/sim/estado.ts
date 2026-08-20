/**
 * El estado del mundo, y cómo se guarda y se vuelve a cargar.
 *
 * Regla: todo lo que la simulación necesita para continuar está acá dentro y es
 * serializable. Nada vive en variables sueltas de un módulo ni en el navegador.
 * Si algo no está en esta estructura, no existe.
 *
 * Lo que NO se guarda: la rejilla del planeta. No depende de la semilla — es
 * siempre la misma para un mismo nivel de subdivisión — así que se reconstruye
 * al cargar y no ocupa sitio en el archivo.
 */

import {
  AGUA_INICIAL_OCEANO,
  AGUA_INICIAL_SUELO,
  ESCALA_ENERGIA_QUIMICA,
  N_TIPOS_ATOMO,
  TOP_N_MOLECULAS,
  GENES_PLANTA,
  MAX_PLANTAS,
  PLANTAS_INICIALES,
  MATERIA_INICIAL_POR_CELDA,
  NIVEL_DEL_MAR,
  NIVEL_SUBDIVISION,
  SEMILLA_POR_DEFECTO,
  TEMP_INICIAL,
} from './constants.js';
import { crearRng, RNG_PALABRAS, type EstadoRng } from './rng.js';
import { MARCA_ARCHIVO, migrar, VERSION_ESQUEMA } from './esquema.js';
import { celdasDelNivel, construirGeometria, type Geometria } from './geodesica.js';
import { generarAltura } from './terreno.js';
import { materiaEnPlantas, sembrarPrimerasPlantas } from './plantas.js';
import { sembrarLaSopa } from './quimica.js';

export interface EstadoMundo {
  /** Semilla con la que nació este mundo. Junto con las intervenciones, lo define entero. */
  semilla: number;
  /** Ticks transcurridos desde la creación. Un tick = un segundo de mundo. */
  tick: number;
  /** Estado del generador de azar. Viaja con el mundo para que el futuro también sea reproducible. */
  rng: EstadoRng;

  /** Nivel de subdivisión del planeta. Determina cuántas celdas tiene. */
  nivel: number;
  /** Celdas del planeta. Derivado del nivel, se guarda por comodidad de lectura. */
  nCeldas: number;

  /**
   * Altura del terreno de cada celda.
   *
   * Pendiente para cuando llegue la erosión: la altura debería salir de cuánta
   * materia sólida guarda la celda, y así mover tierra conservaría masa sola.
   * Por ahora es un campo aparte, y queda dicho.
   */
  altura: Float32Array;

  /**
   * Átomos en cada celda, en cuentas enteras (decisión D7).
   *
   * Enteros y no decimales porque la conservación de masa tiene que ser exacta:
   * con decimales, cada suma pierde un pelo y a los pocos miles de ticks "la
   * materia total no cambia jamás" sería mentira. Además es lo correcto, los
   * átomos no se parten.
   *
   * En la fase 2 esto se reemplaza por las concentraciones de cada molécula.
   */
  materia: Int32Array;

  /** Temperatura de cada celda, en grados del mundo (0 = se congela el agua). */
  temperatura: Float32Array;

  /**
   * Agua del suelo de cada celda, en gotas enteras. En las celdas de mar es el
   * océano; en las de tierra, lo que hay empapado o encharcado.
   *
   * Enteros por lo mismo que la materia (D7): el ciclo del agua tiene que
   * conservar exactamente, y con decimales cada evaporación perdería un pelo.
   */
  aguaSuelo: Int32Array;

  /** Agua que lleva el aire encima de cada celda. Cuando sobra, llueve. */
  humedadAire: Int32Array;

  /**
   * Agua que pasó por esta celda camino de una más baja, en el último tick.
   * No es un campo que gobierne nada: es la cuenta de la que salen los ríos.
   */
  flujoAgua: Int32Array;

  /**
   * Viento en cada celda: un vector de tres números tangente a la superficie.
   * Se recalcula entero en cada tick a partir de la presión, así que no se
   * guarda en el archivo; vive aquí solo para no pedir memoria en cada vuelta.
   */
  viento: Float32Array;

  /**
   * Agua que cayó del cielo sobre esta celda en el último tick.
   * Tampoco gobierna nada: es de donde salen las nubes que se dibujan. Si ves
   * una nube es porque ahí está lloviendo, no porque quede bonito.
   */
  lluvia: Int32Array;

  // --- Vegetación (andamio provisional, decisión D19) ------------------------
  //
  // Listas paralelas en vez de objetos: un array por campo. Es más incómodo de
  // leer pero es lo que permite recorrer decenas de miles de plantas sin que el
  // recolector de basura se ponga a trabajar en mitad del tick.
  //
  /** En qué celda está cada planta. -1 significa hueco libre. */
  plantaCelda: Int32Array;
  /** Materia que tiene cada planta en el cuerpo. Sale del suelo y vuelve a él. */
  plantaMasa: Int32Array;
  /** Ticks vividos. */
  plantaEdad: Int32Array;
  /** Fruto acumulado, que es de donde salen las semillas. */
  plantaFruto: Int32Array;
  /** Genes de cada planta, GENES_PLANTA seguidos por planta. */
  plantaGenoma: Uint8Array;
  /** Cuántas plantas hay en cada celda, para no amontonar infinitas. */
  plantasEnCelda: Int32Array;
  /** Por dónde va la búsqueda de huecos libres. Se guarda para que sea reproducible. */
  cursorPlanta: number;
  /** Cuentas del último tick, para la telemetría y la pantalla. */
  plantasVivas: number;
  masaVegetal: number;

  // --- La química -----------------------------------------------------------
  //
  /** Átomos sueltos de cada tipo en cada celda: N_TIPOS_ATOMO por celda. */
  atomosLibres: Int32Array;
  /** Las moléculas que sigue cada celda: TOP_N_MOLECULAS por celda, 0 = hueco. */
  sopaMolecula: Int32Array;
  /** Cuántas hay de cada una. */
  sopaCantidad: Int32Array;
  /** Cuánto calienta la química. Se guarda aquí para no leer constantes en el bucle. */
  escalaEnergiaQuimica: number;
  /** Uniones que ocurrieron en el último tick. Solo para la telemetría. */
  reaccionesEsteTick: number;

  /**
   * Memoria de trabajo del arrastre por el viento.
   *
   * El viento tiene que leer el estado de ANTES para que el aire que llega a una
   * celda no vuelva a salir en el mismo tick — si no, correría a velocidades
   * distintas según el orden en que se recorren las celdas. Eso pide una copia,
   * y estos dos buffers se reaprovechan en vez de pedir memoria nueva.
   *
   * Honestidad sobre esto: se hizo pensando que las copias por tick eran las
   * culpables de que el clima costara casi un milisegundo, y **medido, no
   * cambió nada** (1,544 ms antes, 1,544 ms después). El coste está en saltar
   * por la tabla de vecinos de la esfera, que es memoria desordenada. Se deja
   * porque sigue siendo lo correcto para millones de ticks, pero no es una
   * optimización: no aceleró nada.
   *
   * No se guardan en el archivo: son andamio de trabajo.
   */
  copiaEnteros: Int32Array;
  copiaDecimales: Float32Array;

  /** Contabilidad de energía: cuánta entró (sol) y cuánta salió (disipación). */
  energiaEntrada: number;
  energiaSalida: number;
}

/** Bytes de cabecera antes de los datos de las celdas. */
const BYTES_CABECERA = 64;

/** Campos por celda que van al archivo: materia, altura, temperatura, agua, humedad. */
const CAMPOS_POR_CELDA = 5;
/** Bytes por planta: celda, masa, edad y fruto en enteros, más sus genes. */
const BYTES_POR_PLANTA = 16 + GENES_PLANTA;
/** Bytes por celda de la sopa: átomos sueltos más las moléculas con su cantidad. */
const BYTES_SOPA_POR_CELDA = N_TIPOS_ATOMO * 4 + TOP_N_MOLECULAS * 8;

/** Crea un mundo nuevo. Determinista: la misma semilla da siempre el mismo mundo. */
export function crearEstado(
  semilla: number = SEMILLA_POR_DEFECTO,
  nivel: number = NIVEL_SUBDIVISION,
): EstadoMundo {
  const geo = construirGeometria(nivel);
  const materia = new Int32Array(geo.nCeldas);
  materia.fill(MATERIA_INICIAL_POR_CELDA);

  const altura = generarAltura(geo, semilla);
  const temperatura = new Float32Array(geo.nCeldas);
  temperatura.fill(TEMP_INICIAL);

  // El agua empieza donde corresponde: casi toda en el mar, un poco en la
  // tierra. A partir de aquí solo se mueve; no aparece ni desaparece nunca.
  const aguaSuelo = new Int32Array(geo.nCeldas);
  for (let i = 0; i < geo.nCeldas; i++) {
    aguaSuelo[i] = altura[i]! < NIVEL_DEL_MAR ? AGUA_INICIAL_OCEANO : AGUA_INICIAL_SUELO;
  }

  const plantaCelda = new Int32Array(geo.nCeldas > 0 ? MAX_PLANTAS : 0);
  plantaCelda.fill(-1);

  const estado: EstadoMundo = {
    semilla,
    tick: 0,
    rng: crearRng(semilla),
    nivel,
    nCeldas: geo.nCeldas,
    altura,
    materia,
    temperatura,
    aguaSuelo,
    humedadAire: new Int32Array(geo.nCeldas),
    flujoAgua: new Int32Array(geo.nCeldas),
    lluvia: new Int32Array(geo.nCeldas),
    viento: new Float32Array(geo.nCeldas * 3),
    plantaCelda,
    plantaMasa: new Int32Array(MAX_PLANTAS),
    plantaEdad: new Int32Array(MAX_PLANTAS),
    plantaFruto: new Int32Array(MAX_PLANTAS),
    plantaGenoma: new Uint8Array(MAX_PLANTAS * GENES_PLANTA),
    plantasEnCelda: new Int32Array(geo.nCeldas),
    cursorPlanta: 0,
    plantasVivas: 0,
    masaVegetal: 0,
    atomosLibres: new Int32Array(geo.nCeldas * N_TIPOS_ATOMO),
    sopaMolecula: new Int32Array(geo.nCeldas * TOP_N_MOLECULAS),
    sopaCantidad: new Int32Array(geo.nCeldas * TOP_N_MOLECULAS),
    escalaEnergiaQuimica: ESCALA_ENERGIA_QUIMICA,
    reaccionesEsteTick: 0,
    copiaEnteros: new Int32Array(geo.nCeldas),
    copiaDecimales: new Float32Array(geo.nCeldas),
    energiaEntrada: 0,
    energiaSalida: 0,
  };

  // La sopa arranca con átomos sueltos en cada celda. A partir de aquí solo se
  // reordenan: no nace ni desaparece ni uno.
  sembrarLaSopa(estado);

  // Las primeras plantas se reparten por la tierra. Su materia sale del suelo,
  // no de la nada, así que la masa total del mundo no cambia por sembrarlas.
  sembrarPrimerasPlantas(estado, geo, PLANTAS_INICIALES);
  return estado;
}

/**
 * Materia total del mundo, como entero exacto.
 * Es el número que el test de masa exige que no cambie jamás.
 */
export function materiaTotal(estado: EstadoMundo): number {
  let total = 0;
  const m = estado.materia;
  for (let i = 0; i < m.length; i++) total += m[i]!;
  // La materia que está dentro de una planta sigue siendo materia del mundo:
  // salió del suelo y volverá a él cuando la planta muera.
  return total + materiaEnPlantas(estado);
}

/** Convierte el mundo entero a bytes, listo para guardar o exportar a archivo. */
export function serializar(estado: EstadoMundo): Uint8Array {
  const n = estado.nCeldas;
  const bytes = new Uint8Array(
    BYTES_CABECERA + n * 4 * CAMPOS_POR_CELDA + MAX_PLANTAS * BYTES_POR_PLANTA + n * BYTES_SOPA_POR_CELDA,
  );
  const vista = new DataView(bytes.buffer);

  vista.setUint32(0, MARCA_ARCHIVO, true);
  vista.setUint32(4, VERSION_ESQUEMA, true);
  vista.setUint32(8, estado.semilla >>> 0, true);
  // El contador de ticks se parte en dos mitades de 32 bits: a x100 durante
  // años, un solo entero de 32 bits se quedaría corto.
  vista.setUint32(12, Math.floor(estado.tick / 4294967296) >>> 0, true);
  vista.setUint32(16, estado.tick >>> 0, true);
  vista.setUint32(20, estado.nivel, true);
  vista.setUint32(24, n, true);
  for (let i = 0; i < RNG_PALABRAS; i++) {
    vista.setUint32(28 + i * 4, estado.rng[i]!, true);
  }
  vista.setFloat64(44, estado.energiaEntrada, true);
  vista.setFloat64(52, estado.energiaSalida, true);
  // Sin esto, cargar un mundo cambiaba su futuro: la búsqueda de huecos libres
  // para las semillas empezaba desde cero y las plantas caían en otro sitio.
  vista.setUint32(60, estado.cursorPlanta, true);

  // El caudal y la lluvia no se guardan: se recalculan enteros en cada tick.
  for (let i = 0; i < n; i++) {
    const c = BYTES_CABECERA + i * 4;
    vista.setInt32(c, estado.materia[i]!, true);
    vista.setFloat32(c + n * 4, estado.altura[i]!, true);
    vista.setFloat32(c + n * 8, estado.temperatura[i]!, true);
    vista.setInt32(c + n * 12, estado.aguaSuelo[i]!, true);
    vista.setInt32(c + n * 16, estado.humedadAire[i]!, true);
  }

  const plantas = BYTES_CABECERA + n * 4 * CAMPOS_POR_CELDA;
  for (let p = 0; p < MAX_PLANTAS; p++) {
    const c = plantas + p * 16;
    vista.setInt32(c, estado.plantaCelda[p]!, true);
    vista.setInt32(c + 4, estado.plantaMasa[p]!, true);
    vista.setInt32(c + 8, estado.plantaEdad[p]!, true);
    vista.setInt32(c + 12, estado.plantaFruto[p]!, true);
  }
  bytes.set(estado.plantaGenoma, plantas + MAX_PLANTAS * 16);

  const sopa = plantas + MAX_PLANTAS * BYTES_POR_PLANTA;
  for (let i = 0; i < n * N_TIPOS_ATOMO; i++) {
    vista.setInt32(sopa + i * 4, estado.atomosLibres[i]!, true);
  }
  const moleculas = sopa + n * N_TIPOS_ATOMO * 4;
  for (let i = 0; i < n * TOP_N_MOLECULAS; i++) {
    vista.setInt32(moleculas + i * 8, estado.sopaMolecula[i]!, true);
    vista.setInt32(moleculas + i * 8 + 4, estado.sopaCantidad[i]!, true);
  }

  return bytes;
}

/**
 * Reconstruye un mundo desde sus bytes, migrándolo antes si viene de una
 * versión vieja del formato.
 */
export function deserializar(bytesEntrada: Uint8Array): EstadoMundo {
  if (bytesEntrada.byteLength < BYTES_CABECERA) {
    throw new Error('El archivo es demasiado corto para ser un mundo.');
  }

  const cabecera = new DataView(
    bytesEntrada.buffer,
    bytesEntrada.byteOffset,
    bytesEntrada.byteLength,
  );
  if (cabecera.getUint32(0, true) !== MARCA_ARCHIVO) {
    throw new Error('Este archivo no es un mundo de este proyecto.');
  }

  const bytes = migrar(bytesEntrada, cabecera.getUint32(4, true));
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const tickAlto = vista.getUint32(12, true);
  const tickBajo = vista.getUint32(16, true);
  const nivel = vista.getUint32(20, true);
  const n = vista.getUint32(24, true);

  if (n !== celdasDelNivel(nivel)) {
    throw new Error(`El archivo dice ${n} celdas, pero el nivel ${nivel} tiene ${celdasDelNivel(nivel)}.`);
  }
  if (
    bytes.byteLength <
    BYTES_CABECERA + n * 4 * CAMPOS_POR_CELDA + MAX_PLANTAS * BYTES_POR_PLANTA + n * BYTES_SOPA_POR_CELDA
  ) {
    throw new Error('El archivo del mundo está incompleto o cortado.');
  }

  const rng = new Uint32Array(RNG_PALABRAS);
  for (let i = 0; i < RNG_PALABRAS; i++) {
    rng[i] = vista.getUint32(28 + i * 4, true);
  }

  const materia = new Int32Array(n);
  const altura = new Float32Array(n);
  const temperatura = new Float32Array(n);
  const aguaSuelo = new Int32Array(n);
  const humedadAire = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const c = BYTES_CABECERA + i * 4;
    materia[i] = vista.getInt32(c, true);
    altura[i] = vista.getFloat32(c + n * 4, true);
    temperatura[i] = vista.getFloat32(c + n * 8, true);
    aguaSuelo[i] = vista.getInt32(c + n * 12, true);
    humedadAire[i] = vista.getInt32(c + n * 16, true);
  }

  const plantasEn = BYTES_CABECERA + n * 4 * CAMPOS_POR_CELDA;
  const plantaCelda = new Int32Array(MAX_PLANTAS);
  const plantaMasa = new Int32Array(MAX_PLANTAS);
  const plantaEdad = new Int32Array(MAX_PLANTAS);
  const plantaFruto = new Int32Array(MAX_PLANTAS);
  const plantasEnCelda = new Int32Array(n);
  let vivas = 0;
  let masaVegetal = 0;
  for (let p = 0; p < MAX_PLANTAS; p++) {
    const c = plantasEn + p * 16;
    const celda = vista.getInt32(c, true);
    plantaCelda[p] = celda;
    plantaMasa[p] = vista.getInt32(c + 4, true);
    plantaEdad[p] = vista.getInt32(c + 8, true);
    plantaFruto[p] = vista.getInt32(c + 12, true);
    if (celda >= 0) {
      plantasEnCelda[celda] = plantasEnCelda[celda]! + 1;
      vivas++;
      masaVegetal += plantaMasa[p]! + plantaFruto[p]!;
    }
  }
  const genomaEn = plantasEn + MAX_PLANTAS * 16;
  const plantaGenoma = bytes.slice(genomaEn, genomaEn + MAX_PLANTAS * GENES_PLANTA);

  const sopaEn = plantasEn + MAX_PLANTAS * BYTES_POR_PLANTA;
  const atomosLibres = new Int32Array(n * N_TIPOS_ATOMO);
  for (let i = 0; i < atomosLibres.length; i++) {
    atomosLibres[i] = vista.getInt32(sopaEn + i * 4, true);
  }
  const moleculasEn = sopaEn + n * N_TIPOS_ATOMO * 4;
  const sopaMolecula = new Int32Array(n * TOP_N_MOLECULAS);
  const sopaCantidad = new Int32Array(n * TOP_N_MOLECULAS);
  for (let i = 0; i < sopaMolecula.length; i++) {
    sopaMolecula[i] = vista.getInt32(moleculasEn + i * 8, true);
    sopaCantidad[i] = vista.getInt32(moleculasEn + i * 8 + 4, true);
  }

  return {
    semilla: vista.getUint32(8, true),
    tick: tickAlto * 4294967296 + tickBajo,
    rng,
    nivel,
    nCeldas: n,
    altura,
    materia,
    temperatura,
    aguaSuelo,
    humedadAire,
    flujoAgua: new Int32Array(n),
    lluvia: new Int32Array(n),
    viento: new Float32Array(n * 3),
    plantaCelda,
    plantaMasa,
    plantaEdad,
    plantaFruto,
    plantaGenoma,
    plantasEnCelda,
    cursorPlanta: vista.getUint32(60, true),
    plantasVivas: vivas,
    masaVegetal,
    atomosLibres,
    sopaMolecula,
    sopaCantidad,
    escalaEnergiaQuimica: ESCALA_ENERGIA_QUIMICA,
    reaccionesEsteTick: 0,
    copiaEnteros: new Int32Array(n),
    copiaDecimales: new Float32Array(n),
    energiaEntrada: vista.getFloat64(44, true),
    energiaSalida: vista.getFloat64(52, true),
  };
}

/**
 * Huella del mundo entero (FNV-1a de 32 bits sobre sus bytes).
 *
 * Es lo que usa el test de determinismo: dos corridas con la misma semilla
 * tienen que dar la misma huella tras diez mil ticks. Si difieren en un solo
 * bit, la huella lo delata.
 */
export function huellaEstado(estado: EstadoMundo): number {
  const bytes = serializar(estado);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** La rejilla del planeta para este estado. No se guarda: se reconstruye. */
export function geometriaDe(estado: EstadoMundo): Geometria {
  return construirGeometria(estado.nivel);
}
