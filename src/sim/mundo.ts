/**
 * El mundo: estado más telemetría, con el bucle que lo hace avanzar.
 *
 * Es lo que usan tanto el Web Worker (para jugar) como el laboratorio (para
 * correr cientos de miles de ticks sin dibujar nada). Los dos corren exactamente
 * el mismo código, que es la única forma de que lo que se prueba en el
 * laboratorio sea lo mismo que después se ve en pantalla.
 */

import { PRESUPUESTO_MS_POR_TICK } from './constants.js';
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
    };
  }

  aBytes(): Uint8Array {
    return serializar(this.estado);
  }
}
