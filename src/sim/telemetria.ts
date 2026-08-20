/**
 * Telemetría: las series temporales del mundo.
 *
 * Un sistema emergente no se ajusta a ojo. Estas curvas son la única forma de
 * saber si un cambio mejoró algo o solo lo movió de lugar, así que se registran
 * desde el tick cero (spec §5.3) aunque en la fase 0 casi todo valga cero.
 *
 * Los campos que todavía no tienen fase están declarados igual, para que las
 * series sean comparables entre fases y no haya que reprocesar corridas viejas.
 */

import { TELEMETRIA_CADA_N_TICKS, TELEMETRIA_MAX_MUESTRAS } from './constants.js';

export interface Muestra {
  tick: number;

  // --- Conservación (fase 0) -------------------------------------------------
  /** Átomos totales del mundo. No puede cambiar jamás. */
  masaTotal: number;
  /** Energía acumulada que entró (sol) menos la que salió (disipación). */
  energiaNeta: number;

  // --- Química (fase 2) ------------------------------------------------------
  moleculasDistintas: number;
  longitudMediaCadena: number;
  ciclosAutocataliticos: number;
  reaccionesPorTick: number;

  // --- Vida (fase 3) ---------------------------------------------------------
  poblacion: number;
  linajesVivos: number;
  mortalidadInfantil: number;
  edadMediaDeMuerte: number;

  // --- Lenguaje (fases 4 y 5) ------------------------------------------------
  /** Señales emitidas por criatura y por tick. */
  tasaEmisionSenales: number;
  /** Nubes estables en el espacio de señales, o sea palabras. */
  clustersSenalEstables: number;
  /**
   * Información mutua entre la señal y su contexto, en bits.
   * Es la métrica que dice si una señal significa algo o es ruido: cero quiere
   * decir que emiten sin que la emisión tenga nada que ver con lo que pasa.
   */
  informacionMutuaSenalContexto: number;

  // --- Rendimiento -----------------------------------------------------------
  /** Milisegundos de CPU que costó el último tick medido. */
  msPorTick: number;
}

/** Un aviso con su tick. No detiene nada: solo queda registrado. */
export interface Aviso {
  tick: number;
  clase: ClaseDeAviso;
  detalle: string;
}

/**
 * Clases de aviso.
 *
 * Los detectores de degeneración NO prohíben nada (CLAUDE.md §3): los bichos
 * que giran en círculo o que emiten sin parar son resultados legítimos. Se
 * avisan porque casi siempre significan que a alguna acción le falta coste.
 */
export type ClaseDeAviso =
  | 'MASA_NO_CONSERVADA'
  | 'PRESUPUESTO_EXCEDIDO'
  | 'TOPE_POBLACION_ALCANZADO'
  | 'DEGENERACION_MOVIMIENTO_CIRCULAR'
  | 'DEGENERACION_SENAL_CONSTANTE'
  | 'DEGENERACION_CANIBALISMO_DE_CRIAS'
  | 'QUIMICA_EN_EQUILIBRIO'
  | 'CANAL_DE_SENALES_MUDO'
  | 'CATCHUP_RECORTADO';

/** Muestra con todo a cero, para no repetir la lista de campos en cada sitio. */
function muestraVacia(tick: number): Muestra {
  return {
    tick,
    masaTotal: 0,
    energiaNeta: 0,
    moleculasDistintas: 0,
    longitudMediaCadena: 0,
    ciclosAutocataliticos: 0,
    reaccionesPorTick: 0,
    poblacion: 0,
    linajesVivos: 0,
    mortalidadInfantil: 0,
    edadMediaDeMuerte: 0,
    tasaEmisionSenales: 0,
    clustersSenalEstables: 0,
    informacionMutuaSenalContexto: 0,
    msPorTick: 0,
  };
}

export class Telemetria {
  private muestras: Muestra[] = [];
  private avisosRegistrados: Aviso[] = [];
  /** Intervalo efectivo entre muestras. Se duplica cada vez que la serie se diezma. */
  private intervalo = TELEMETRIA_CADA_N_TICKS;

  /** ¿Toca tomar muestra en este tick? */
  debeMuestrear(tick: number): boolean {
    return tick % this.intervalo === 0;
  }

  /**
   * Registra una muestra. Cuando la serie llena su cupo se queda con una de
   * cada dos y duplica el intervalo, así una corrida de millones de ticks no se
   * come la memoria pero conserva la forma de la curva.
   */
  registrar(m: Muestra): void {
    this.muestras.push(m);
    if (this.muestras.length >= TELEMETRIA_MAX_MUESTRAS) {
      this.muestras = this.muestras.filter((_, i) => i % 2 === 0);
      this.intervalo *= 2;
    }
  }

  avisar(tick: number, clase: ClaseDeAviso, detalle: string): void {
    this.avisosRegistrados.push({ tick, clase, detalle });
  }

  get series(): readonly Muestra[] {
    return this.muestras;
  }

  get avisos(): readonly Aviso[] {
    return this.avisosRegistrados;
  }

  /** Última muestra registrada, o null si todavía no hay ninguna. */
  get ultima(): Muestra | null {
    return this.muestras.length > 0 ? this.muestras[this.muestras.length - 1]! : null;
  }

  aJSON(): string {
    return JSON.stringify(
      { intervalo: this.intervalo, muestras: this.muestras, avisos: this.avisosRegistrados },
      null,
      2,
    );
  }

  /** Exporta a CSV para poder mirar las curvas en cualquier hoja de cálculo. */
  aCSV(): string {
    if (this.muestras.length === 0) return '';
    const columnas = Object.keys(this.muestras[0]!) as (keyof Muestra)[];
    const lineas = [columnas.join(',')];
    for (const m of this.muestras) {
      lineas.push(columnas.map((c) => String(m[c])).join(','));
    }
    return lineas.join('\n');
  }
}

export { muestraVacia };
