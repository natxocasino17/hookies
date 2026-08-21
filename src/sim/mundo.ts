/**
 * El mundo: estado más telemetría, con el bucle que lo hace avanzar.
 *
 * Es lo que usan tanto el Web Worker (para jugar) como el laboratorio (para
 * correr cientos de miles de ticks sin dibujar nada). Los dos corren exactamente
 * el mismo código, que es la única forma de que lo que se prueba en el
 * laboratorio sea lo mismo que después se ve en pantalla.
 */

import {
  GENES_PLANTA,
  MAX_CADENA_GENOMA,
  MAX_CRIATURAS,
  MAX_PLANTAS,
  PRESUPUESTO_MS_POR_TICK,
} from './constants.js';
import { leerRasgo, RASGO_TAMANO, tinteDelGenoma } from './genoma.js';
import { GEN_TEMPERATURA } from './plantas.js';
import {
  crearEstado,
  deserializar,
  geometriaDe,
  materiaTotal,
  serializar,
  type EstadoMundo,
} from './estado.js';
import type { Geometria } from './geodesica.js';
import { avanzarUnTick } from './tick.js';
import { muestraVacia, Telemetria } from './telemetria.js';

/** Instantánea para dibujar. Copias, nunca el estado vivo. */
export interface Instantanea {
  tick: number;
  nivel: number;
  nCeldas: number;
  altura: Float32Array;
  temperatura: Float32Array;
  aguaSuelo: Int32Array;
  humedadAire: Int32Array;
  flujoAgua: Int32Array;
  lluvia: Int32Array;
  /** Materia vegetal en cada celda. De aquí sale el tamaño de los árboles. */
  vegetacion: Int32Array;
  /**
   * Gen de temperatura medio de las plantas de cada celda, de 0 a 255.
   * Es el color de la vegetación: dos linajes adaptados a climas distintos se
   * ven de tonos distintos, así que la divergencia se ve con los ojos.
   */
  vegetacionTinte: Uint8Array;
  /**
   * Los cuerpos vivos, uno por uno: en qué celda está cada uno, cómo de grande
   * es (0 a 255) y su color (0 a 255).
   *
   * Uno por uno y no un resumen por celda, al revés que la vegetación, porque lo
   * que se quiere ver aquí es a los bichos moverse. El color sale de proyectar
   * el genoma: no hay tabla de especies (ver `tinteDelGenoma`).
   */
  criaturaCelda: Int32Array;
  criaturaTamano: Uint8Array;
  criaturaTinte: Uint8Array;
}

/**
 * Reloj para medir rendimiento. Se inyecta desde afuera a propósito: dentro de
 * `src/sim/` está prohibido leer la hora, porque cualquier decisión que dependa
 * del tiempo real rompería el determinismo. Esto solo alimenta la telemetría y
 * jamás toca el estado.
 */
export type Reloj = () => number;

export class Mundo {
  readonly telemetria: Telemetria;
  /** La rejilla del planeta. No se guarda con el mundo: se reconstruye. */
  readonly geo: Geometria;
  private readonly reloj: Reloj;
  /** Materia total al nacer el mundo. El test de masa exige que no cambie nunca. */
  private readonly masaDeReferencia: number;

  constructor(
    public estado: EstadoMundo,
    opciones: { telemetria?: Telemetria; reloj?: Reloj } = {},
  ) {
    this.telemetria = opciones.telemetria ?? new Telemetria();
    this.geo = geometriaDe(estado);
    this.reloj = opciones.reloj ?? (() => 0);
    this.masaDeReferencia = materiaTotal(estado);
  }

  static nuevo(semilla?: number, opciones: { reloj?: Reloj } = {}): Mundo {
    return new Mundo(crearEstado(semilla), opciones);
  }

  static desdeBytes(bytes: Uint8Array, opciones: { reloj?: Reloj } = {}): Mundo {
    return new Mundo(deserializar(bytes), opciones);
  }

  get tick(): number {
    return this.estado.tick;
  }

  /** Avanza `cuantos` ticks, tomando muestras de telemetría cuando toca. */
  avanzar(cuantos: number): void {
    for (let i = 0; i < cuantos; i++) {
      const t0 = this.reloj();
      avanzarUnTick(this.estado, this.geo);
      const coste = this.reloj() - t0;

      if (this.telemetria.debeMuestrear(this.estado.tick)) {
        this.muestrear(coste);
      }
    }
  }

  private muestrear(msPorTick: number): void {
    const masa = materiaTotal(this.estado);
    const m = muestraVacia(this.estado.tick);
    m.masaTotal = masa;
    m.energiaNeta = this.estado.energiaEntrada - this.estado.energiaSalida;
    m.msPorTick = msPorTick;
    this.telemetria.registrar(m);

    // Un fallo de conservación no se corrige ni se disimula: se registra.
    // Si esto salta, hay un error de física, no de contabilidad.
    if (masa !== this.masaDeReferencia) {
      this.telemetria.avisar(
        this.estado.tick,
        'MASA_NO_CONSERVADA',
        `La materia total pasó de ${this.masaDeReferencia} a ${masa} (diferencia ${masa - this.masaDeReferencia}).`,
      );
    }

    if (msPorTick > PRESUPUESTO_MS_POR_TICK) {
      this.telemetria.avisar(
        this.estado.tick,
        'PRESUPUESTO_EXCEDIDO',
        `El tick costó ${msPorTick.toFixed(2)} ms, por encima del presupuesto de ${PRESUPUESTO_MS_POR_TICK} ms.`,
      );
    }
  }

  /** Copia del estado visible, para mandarle al hilo que dibuja. */
  instantanea(): Instantanea {
    return {
      tick: this.estado.tick,
      nivel: this.estado.nivel,
      nCeldas: this.estado.nCeldas,
      altura: new Float32Array(this.estado.altura),
      temperatura: new Float32Array(this.estado.temperatura),
      aguaSuelo: new Int32Array(this.estado.aguaSuelo),
      humedadAire: new Int32Array(this.estado.humedadAire),
      flujoAgua: new Int32Array(this.estado.flujoAgua),
      lluvia: new Int32Array(this.estado.lluvia),
      ...this.resumirVegetacion(),
      ...this.recogerCriaturas(),
    };
  }

  /**
   * Los cuerpos vivos, listos para dibujar: dónde está cada uno, cómo de grande
   * es y de qué color.
   *
   * El color **sale del propio genoma**, igual que el de los frutos (decisión
   * D12). No hay ninguna tabla de especies ni nada que se le parezca: se
   * promedia una ventana de átomos y ese número es el tono. La consecuencia es
   * lo que se quería — dos bichos que pueden cruzarse tienen genomas parecidos,
   * así que salen del mismo color sin que nadie se lo diga, y el día que un
   * grupo se separe lo suficiente como para no poder cruzarse, **se le va a ver
   * cambiar de color**. La especiación se mira, no se consulta.
   */
  private recogerCriaturas(): {
    criaturaCelda: Int32Array;
    criaturaTamano: Uint8Array;
    criaturaTinte: Uint8Array;
  } {
    const vivas: number[] = [];
    for (let c = 0; c < MAX_CRIATURAS; c++) {
      if (this.estado.criaturaCelda[c]! >= 0) vivas.push(c);
    }
    const celda = new Int32Array(vivas.length);
    const tamano = new Uint8Array(vivas.length);
    const tinte = new Uint8Array(vivas.length);
    const g = this.estado.criaturaGenoma;
    for (let i = 0; i < vivas.length; i++) {
      const c = vivas[i]!;
      const base = c * MAX_CADENA_GENOMA;
      celda[i] = this.estado.criaturaCelda[c]!;
      tamano[i] = (leerRasgo(g, base, RASGO_TAMANO) * 255) | 0;
      tinte[i] = (tinteDelGenoma(g, base) * 255) | 0;
    }
    return { criaturaCelda: celda, criaturaTamano: tamano, criaturaTinte: tinte };
  }

  /**
   * Junta las plantas de cada celda en dos números: cuánta materia vegetal hay
   * y de qué tono es. El dibujo no necesita saber de plantas una por una.
   */
  private resumirVegetacion(): { vegetacion: Int32Array; vegetacionTinte: Uint8Array } {
    const vegetacion = new Int32Array(this.estado.nCeldas);
    const sumaTinte = new Float64Array(this.estado.nCeldas);
    const cuenta = new Int32Array(this.estado.nCeldas);

    for (let p = 0; p < MAX_PLANTAS; p++) {
      const celda = this.estado.plantaCelda[p]!;
      if (celda < 0) continue;
      vegetacion[celda] = vegetacion[celda]! + this.estado.plantaMasa[p]!;
      sumaTinte[celda] = sumaTinte[celda]! + this.estado.plantaGenoma[p * GENES_PLANTA + GEN_TEMPERATURA]!;
      cuenta[celda] = cuenta[celda]! + 1;
    }

    const vegetacionTinte = new Uint8Array(this.estado.nCeldas);
    for (let i = 0; i < this.estado.nCeldas; i++) {
      if (cuenta[i]! > 0) vegetacionTinte[i] = (sumaTinte[i]! / cuenta[i]!) | 0;
    }
    return { vegetacion, vegetacionTinte };
  }

  aBytes(): Uint8Array {
    return serializar(this.estado);
  }
}
