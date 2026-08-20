/**
 * El hilo principal. Solo mira.
 *
 * No tiene el estado del mundo ni puede tocarlo: le pide instantáneas al Worker
 * y las dibuja. Toda la simulación corre en el Worker, así que dibujar nunca
 * frena al mundo ni el mundo frena al dibujo.
 */

import { NIVEL_DEL_MAR, SEMILLA_POR_DEFECTO } from './sim/constants.js';
import { VistaPlaneta } from './render/planeta.js';
import type { NoticiaDelWorker, OrdenAlWorker, Velocidad } from './shared/protocolo.js';

const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });
const mandar = (o: OrdenAlWorker) => worker.postMessage(o);

const escribir = (id: string, texto: string) => {
  const nodo = document.getElementById(id);
  if (nodo) nodo.textContent = texto;
};

/**
 * La semilla viene en la dirección (?semilla=1234), así que compartir un mundo
 * es compartir un enlace. Sin servidor y sin cuentas: cada persona genera el
 * suyo en su propio aparato.
 */
const parametros = new URLSearchParams(location.search);
const semilla = Number(parametros.get('semilla') ?? SEMILLA_POR_DEFECTO) || SEMILLA_POR_DEFECTO;
const velocidad = (Number(parametros.get('velocidad')) || 1) as Velocidad;

const lienzo = document.getElementById('lienzo') as HTMLCanvasElement;
const vista = new VistaPlaneta(lienzo);

function bucleDeDibujo(): void {
  vista.dibujar();
  requestAnimationFrame(bucleDeDibujo);
}
requestAnimationFrame(bucleDeDibujo);

worker.onmessage = (evento: MessageEvent<NoticiaDelWorker>) => {
  const noticia = evento.data;
  switch (noticia.tipo) {
    case 'INSTANTANEA': {
      vista.actualizar(noticia.nivel, noticia.altura);

      let tierra = 0;
      for (let i = 0; i < noticia.altura.length; i++) {
        if (noticia.altura[i]! >= NIVEL_DEL_MAR) tierra++;
      }
      let atomos = 0;
      for (let i = 0; i < noticia.materia.length; i++) atomos += noticia.materia[i]!;

      escribir('celdas', noticia.nCeldas.toLocaleString('es'));
      escribir('tierra', `${Math.round((tierra / noticia.nCeldas) * 100)} %`);
      escribir('tick', noticia.tick.toLocaleString('es'));
      escribir('materia', `${atomos.toLocaleString('es')} átomos`);
      document.body.classList.add('listo');
      break;
    }
    case 'CATCHUP':
      // Nunca se recorta en silencio: si no se pudieron correr todos los ticks
      // transcurridos, se dice con los dos números a la vista.
      escribir(
        'tick',
        `${noticia.corridos.toLocaleString('es')} de ${noticia.transcurridos.toLocaleString('es')}`,
      );
      break;
    case 'ERROR':
      escribir('tick', `error: ${noticia.mensaje}`);
      break;
  }
};

escribir('semilla', String(semilla));
mandar({ tipo: 'CREAR', semilla, velocidad });
mandar({ tipo: 'ARRANCAR' });

// El dibujo se suspende con la pestaña oculta. No se pierde nada: al volver,
// el catch-up recupera los ticks que faltan.
document.addEventListener('visibilitychange', () => {
  mandar({ tipo: document.hidden ? 'PAUSAR' : 'ARRANCAR' });
});
