/**
 * El hilo principal. Solo mira.
 *
 * No tiene el estado del mundo ni puede tocarlo: le pide instantáneas al Worker
 * y las dibuja. En la fase 0 "dibujar" es escribir cuatro números en pantalla;
 * el render cenital con Three.js llega en la fase 1.
 */

import { SEMILLA_POR_DEFECTO } from './sim/constants.js';
import type { NoticiaDelWorker, OrdenAlWorker, Velocidad } from './shared/protocolo.js';

const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });

const mandar = (o: OrdenAlWorker) => worker.postMessage(o);
const escribir = (id: string, texto: string) => {
  const nodo = document.getElementById(id);
  if (nodo) nodo.textContent = texto;
};

/**
 * La semilla puede venir en la dirección (?semilla=1234) para que compartir un
 * mundo sea compartir un link. Sin servidor y sin cuentas: cada persona genera
 * el suyo en su dispositivo.
 */
const parametros = new URLSearchParams(location.search);
const semilla = Number(parametros.get('semilla') ?? SEMILLA_POR_DEFECTO) || SEMILLA_POR_DEFECTO;
const velocidad = (Number(parametros.get('velocidad')) || 1) as Velocidad;

worker.onmessage = (evento: MessageEvent<NoticiaDelWorker>) => {
  const noticia = evento.data;
  switch (noticia.tipo) {
    case 'INSTANTANEA': {
      let total = 0;
      for (let i = 0; i < noticia.materia.length; i++) total += noticia.materia[i]!;
      escribir('tick', noticia.tick.toLocaleString('es'));
      escribir('materia', `${total.toLocaleString('es')} átomos en ${noticia.ancho}×${noticia.alto}`);
      escribir('worker', 'corriendo');
      break;
    }
    case 'CATCHUP':
      // Nunca se recorta en silencio: si no se pudieron correr todos los ticks
      // transcurridos, se dice con los dos números a la vista.
      escribir(
        'worker',
        `catch-up recortado: ${noticia.corridos.toLocaleString('es')} de ${noticia.transcurridos.toLocaleString('es')} ticks`,
      );
      break;
    case 'ERROR':
      escribir('worker', `error: ${noticia.mensaje}`);
      break;
  }
};

escribir('semilla', String(semilla));
mandar({ tipo: 'CREAR', semilla, velocidad });
mandar({ tipo: 'ARRANCAR' });

// El render se suspende con la pestaña oculta (spec §5.8). No se pierde nada:
// al volver, el catch-up recupera los ticks que faltan.
document.addEventListener('visibilitychange', () => {
  mandar({ tipo: document.hidden ? 'PAUSAR' : 'ARRANCAR' });
});
