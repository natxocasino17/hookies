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
import {
  leerRasgo,
  RASGO_DIETA_CARNE,
  RASGO_DIETA_VEGETAL,
  RASGO_TAMANO,
  RASGO_VELOCIDAD,
  tinteDelGenoma,
} from './genoma.js';
import { GEN_SED, GEN_TEMPERATURA } from './plantas.js';
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
   * Gen de sed medio de las plantas de cada celda. De aquí sale su porte: un
   * bosque de secano se ve bajo y ancho, y uno de ribera alto y estrecho.
   */
  vegetacionPorte: Uint8Array;
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
  /**
   * De qué lado del gen de la dieta cae cada cuerpo: 0 todo planta, 255 toda
   * carne. De aquí sale lo picuda que se dibuja su forma.
   *
   * **Que un carnívoro salga picudo no es una causa, es una lectura.** La forma
   * no hace nada en el mundo: no muerde mejor por ser puntiaguda ni corre menos
   * por ser redonda. Es una manera de ver un gen con los ojos en vez de tener
   * que abrir un menú.
   */
  criaturaPunta: Uint8Array;
  /** El gen de velocidad, de 0 a 255. De aquí sale si el cuerpo se ve estirado. */
  criaturaEsbeltez: Uint8Array;
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
    criaturaPunta: Uint8Array;
    criaturaEsbeltez: Uint8Array;
  } {
    const vivas: number[] = [];
    for (let c = 0; c < MAX_CRIATURAS; c++) {
      if (this.estado.criaturaCelda[c]! >= 0) vivas.push(c);
    }
    const celda = new Int32Array(vivas.length);
    const tamano = new Uint8Array(vivas.length);
    const tinte = new Uint8Array(vivas.length);
    const punta = new Uint8Array(vivas.length);
    const esbeltez = new Uint8Array(vivas.length);
    const g = this.estado.criaturaGenoma;
    for (let i = 0; i < vivas.length; i++) {
      const c = vivas[i]!;
      const base = c * MAX_CADENA_GENOMA;
      celda[i] = this.estado.criaturaCelda[c]!;
      tamano[i] = (leerRasgo(g, base, RASGO_TAMANO) * 255) | 0;
      tinte[i] = (tinteDelGenoma(g, base) * 255) | 0;

      // De qué lado del gen de la dieta cae este cuerpo. Cero es todo planta,
      // 255 es toda carne. No hay herbívoros ni carnívoros declarados en ningún
      // sitio: son los dos extremos del mismo gen y un linaje puede recorrer el
      // camino entero de uno al otro.
      const carne = leerRasgo(g, base, RASGO_DIETA_CARNE);
      const verde = leerRasgo(g, base, RASGO_DIETA_VEGETAL);
      const suma = carne + verde;
      punta[i] = suma > 0 ? ((carne / suma) * 255) | 0 : 128;

      esbeltez[i] = (leerRasgo(g, base, RASGO_VELOCIDAD) * 255) | 0;
    }
    return {
      criaturaCelda: celda,
      criaturaTamano: tamano,
      criaturaTinte: tinte,
      criaturaPunta: punta,
      criaturaEsbeltez: esbeltez,
    };
  }

  /**
   * Junta las plantas de cada celda en dos números: cuánta materia vegetal hay
   * y de qué tono es. El dibujo no necesita saber de plantas una por una.
   */
  private resumirVegetacion(): {
    vegetacion: Int32Array;
    vegetacionTinte: Uint8Array;
    vegetacionPorte: Uint8Array;
  } {
    const vegetacion = new Int32Array(this.estado.nCeldas);
    const sumaTinte = new Float64Array(this.estado.nCeldas);
    const sumaPorte = new Float64Array(this.estado.nCeldas);
    const cuenta = new Int32Array(this.estado.nCeldas);

    for (let p = 0; p < MAX_PLANTAS; p++) {
      const celda = this.estado.plantaCelda[p]!;
      if (celda < 0) continue;
      vegetacion[celda] = vegetacion[celda]! + this.estado.plantaMasa[p]!;
      sumaTinte[celda] = sumaTinte[celda]! + this.estado.plantaGenoma[p * GENES_PLANTA + GEN_TEMPERATURA]!;
      // El gen de la sed. Un linaje que aguanta seco se ve bajo y ancho, y uno
      // que pide mucha agua, alto y estrecho. Es una lectura del gen, no una
      // causa: la planta no bebe más por ser estrecha.
      sumaPorte[celda] = sumaPorte[celda]! + this.estado.plantaGenoma[p * GENES_PLANTA + GEN_SED]!;
      cuenta[celda] = cuenta[celda]! + 1;
    }

    const vegetacionTinte = new Uint8Array(this.estado.nCeldas);
    const vegetacionPorte = new Uint8Array(this.estado.nCeldas);
    for (let i = 0; i < this.estado.nCeldas; i++) {
      if (cuenta[i]! > 0) {
        vegetacionTinte[i] = (sumaTinte[i]! / cuenta[i]!) | 0;
        vegetacionPorte[i] = (sumaPorte[i]! / cuenta[i]!) | 0;
      }
    }
    return { vegetacion, vegetacionTinte, vegetacionPorte };
  }

  aBytes(): Uint8Array {
    return serializar(this.estado);
  }
}
