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

  /** Contabilidad de energía: cuánta entró (sol) y cuánta salió (disipación). */
  energiaEntrada: number;
  energiaSalida: number;
}

/** Bytes de cabecera antes de los datos de las celdas. */
const BYTES_CABECERA = 60;

/** Campos por celda que van al archivo: materia, altura, temperatura, agua, humedad. */
const CAMPOS_POR_CELDA = 5;

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

  return {
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
    energiaEntrada: 0,
    energiaSalida: 0,
  };
}

/**
 * Materia total del mundo, como entero exacto.
 * Es el número que el test de masa exige que no cambie jamás.
 */
export function materiaTotal(estado: EstadoMundo): number {
  let total = 0;
  const m = estado.materia;
  for (let i = 0; i < m.length; i++) total += m[i]!;
  return total;
}

/** Convierte el mundo entero a bytes, listo para guardar o exportar a archivo. */
export function serializar(estado: EstadoMundo): Uint8Array {
  const n = estado.nCeldas;
  const bytes = new Uint8Array(BYTES_CABECERA + n * 4 * CAMPOS_POR_CELDA);
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

  // El caudal y la lluvia no se guardan: se recalculan enteros en cada tick.
  for (let i = 0; i < n; i++) {
    const c = BYTES_CABECERA + i * 4;
    vista.setInt32(c, estado.materia[i]!, true);
    vista.setFloat32(c + n * 4, estado.altura[i]!, true);
    vista.setFloat32(c + n * 8, estado.temperatura[i]!, true);
    vista.setInt32(c + n * 12, estado.aguaSuelo[i]!, true);
    vista.setInt32(c + n * 16, estado.humedadAire[i]!, true);
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
  if (bytes.byteLength < BYTES_CABECERA + n * 4 * CAMPOS_POR_CELDA) {
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
