/**
 * El contrato entre el hilo que dibuja y el Worker que simula.
 *
 * Regla de arquitectura (CLAUDE.md §2.5): toda la simulación vive en el Worker.
 * El hilo principal no puede tocar el estado, solo pedir instantáneas y mandar
 * órdenes. Así el render nunca bloquea la simulación ni al revés, y ninguna
 * decisión del mundo depende de si hay una pestaña abierta mirando.
 */

import type { Muestra } from '../sim/telemetria.js';

/** Velocidad del mundo. Se elige al crearlo y queda fija para siempre. */
export type Velocidad = 1 | 10 | 100;

export type OrdenAlWorker =
  | { tipo: 'CREAR'; semilla: number; velocidad: Velocidad }
  | { tipo: 'CARGAR'; bytes: Uint8Array; velocidad: Velocidad }
  | { tipo: 'ARRANCAR' }
  | { tipo: 'PAUSAR' }
  | { tipo: 'AVANZAR'; ticks: number }
  | { tipo: 'PEDIR_INSTANTANEA' }
  | { tipo: 'PEDIR_GUARDADO' };

export type NoticiaDelWorker =
  | {
      tipo: 'INSTANTANEA';
      tick: number;
      nivel: number;
      nCeldas: number;
      altura: Float32Array;
      materia: Int32Array;
    }
  | { tipo: 'TELEMETRIA'; ultima: Muestra | null }
  | { tipo: 'GUARDADO'; bytes: Uint8Array }
  | {
      /**
       * El catch-up al abrir no pudo correr todos los ticks transcurridos.
       * Se avisa con los dos números; nunca se recorta en silencio.
       */
      tipo: 'CATCHUP';
      corridos: number;
      transcurridos: number;
    }
  | { tipo: 'ERROR'; mensaje: string };
