/// <reference lib="webworker" />
/**
 * El Worker: acá corre el mundo, y en ningún otro lado.
 *
 * Este archivo es lo único que traduce entre el reloj del navegador y el reloj
 * del mundo. La simulación de `src/sim/` no sabe qué hora es ni si hay alguien
 * mirando, que es justamente lo que la hace determinista.
 */

import { CATCHUP_MAX_TICKS, TICK_MS } from '../sim/constants.js';
import { Mundo } from '../sim/mundo.js';
import type { NoticiaDelWorker, OrdenAlWorker, Velocidad } from '../shared/protocolo.js';

let mundo: Mundo | null = null;
let velocidad: Velocidad = 1;
let corriendo = false;
let temporizador: ReturnType<typeof setInterval> | null = null;
/** Sobrante de tiempo real que todavía no se convirtió en ticks enteros. */
let acumuladorMs = 0;
let ultimoInstanteMs = 0;

const contar = (n: NoticiaDelWorker, transferibles: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(n, transferibles);

function enviarInstantanea(): void {
  if (!mundo) return;
  const i = mundo.instantanea();
  contar(
    {
      tipo: 'INSTANTANEA',
      tick: i.tick,
      nivel: i.nivel,
      nCeldas: i.nCeldas,
      altura: i.altura,
      materia: i.materia,
    },
    [i.altura.buffer, i.materia.buffer],
  );
  contar({ tipo: 'TELEMETRIA', ultima: mundo.telemetria.ultima });
}

/**
 * Convierte el tiempo real transcurrido en ticks enteros.
 *
 * El paso del mundo es fijo: nunca se simula "medio tick" ni se acelera para
 * compensar un frame lento. Si el navegador se atrasa, se corren los ticks que
 * falten; el resultado es idéntico al de no haberse atrasado nunca.
 */
function bombear(): void {
  if (!mundo || !corriendo) return;

  const ahora = Date.now();
  acumuladorMs += ahora - ultimoInstanteMs;
  ultimoInstanteMs = ahora;

  const msPorTick = TICK_MS / velocidad;
  let pendientes = Math.floor(acumuladorMs / msPorTick);
  if (pendientes <= 0) return;
  acumuladorMs -= pendientes * msPorTick;

  if (pendientes > CATCHUP_MAX_TICKS) {
    contar({ tipo: 'CATCHUP', corridos: CATCHUP_MAX_TICKS, transcurridos: pendientes });
    mundo.telemetria.avisar(
      mundo.tick,
      'CATCHUP_RECORTADO',
      `Se corrieron ${CATCHUP_MAX_TICKS} ticks de los ${pendientes} transcurridos.`,
    );
    pendientes = CATCHUP_MAX_TICKS;
  }

  mundo.avanzar(pendientes);
  enviarInstantanea();
}

function arrancarBucle(): void {
  if (temporizador !== null) return;
  ultimoInstanteMs = Date.now();
  acumuladorMs = 0;
  // Se despierta más seguido que el tick para que el acumulador no dé saltos
  // grandes, pero quien decide cuántos ticks corren es el acumulador, no esto.
  temporizador = setInterval(bombear, Math.min(TICK_MS / velocidad, TICK_MS) / 4);
}

function pararBucle(): void {
  if (temporizador === null) return;
  clearInterval(temporizador);
  temporizador = null;
}

self.onmessage = (evento: MessageEvent<OrdenAlWorker>) => {
  const orden = evento.data;
  try {
    switch (orden.tipo) {
      case 'CREAR':
        velocidad = orden.velocidad;
        mundo = Mundo.nuevo(orden.semilla, { reloj: () => performance.now() });
        enviarInstantanea();
        break;

      case 'CARGAR':
        velocidad = orden.velocidad;
        mundo = Mundo.desdeBytes(orden.bytes, { reloj: () => performance.now() });
        enviarInstantanea();
        break;

      case 'ARRANCAR':
        corriendo = true;
        arrancarBucle();
        break;

      case 'PAUSAR':
        corriendo = false;
        pararBucle();
        break;

      case 'AVANZAR':
        if (mundo) {
          mundo.avanzar(orden.ticks);
          enviarInstantanea();
        }
        break;

      case 'PEDIR_INSTANTANEA':
        enviarInstantanea();
        break;

      case 'PEDIR_GUARDADO':
        if (mundo) {
          const bytes = mundo.aBytes();
          contar({ tipo: 'GUARDADO', bytes }, [bytes.buffer]);
        }
        break;
    }
  } catch (e) {
    contar({ tipo: 'ERROR', mensaje: e instanceof Error ? e.message : String(e) });
  }
};
