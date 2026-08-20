/**
 * El hilo principal. Solo mira.
 *
 * No tiene el estado del mundo ni puede tocarlo: le pide instantáneas al Worker
 * y las dibuja. Toda la simulación corre en el Worker, así que dibujar nunca
 * frena al mundo ni el mundo frena al dibujo.
 */

import {
  DIAS_POR_ANO,
  NIVEL_DEL_MAR,
  SEMILLA_POR_DEFECTO,
  TICKS_POR_ANO,
  TICKS_POR_DIA,
} from './sim/constants.js';
import { VistaPlaneta } from './render/planeta.js';
import { CAUDAL_DE_RIO } from './render/paleta.js';
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
      vista.actualizar(noticia);

      let tierra = 0;
      let helado = 0;
      let sumaTemp = 0;
      let rios = 0;
      for (let i = 0; i < noticia.nCeldas; i++) {
        if (noticia.altura[i]! >= NIVEL_DEL_MAR) tierra++;
        if (noticia.temperatura[i]! < 0) helado++;
        if (noticia.flujoAgua[i]! > CAUDAL_DE_RIO) rios++;
        sumaTemp += noticia.temperatura[i]!;
      }

      const dia = Math.floor(noticia.tick / TICKS_POR_DIA);
      const ano = Math.floor(noticia.tick / TICKS_POR_ANO);
      escribir('tiempo', `año ${ano}, día ${dia % DIAS_POR_ANO}`);
      escribir('tierra', `${Math.round((tierra / noticia.nCeldas) * 100)} % de ${noticia.nCeldas}`);
      escribir('temperatura', `${(sumaTemp / noticia.nCeldas).toFixed(1)}°`);
      escribir('hielo', `${Math.round((helado / noticia.nCeldas) * 100)} %`);
      escribir('rios', String(rios));
      document.body.classList.add('listo');
      break;
    }
    case 'CATCHUP':
      // Nunca se recorta en silencio: si no se pudieron correr todos los ticks
      // transcurridos, se dice con los dos números a la vista.
      escribir(
        'tiempo',
        `${noticia.corridos.toLocaleString('es')} de ${noticia.transcurridos.toLocaleString('es')} ticks`,
      );
      break;
    case 'ERROR':
      escribir('tiempo', `error: ${noticia.mensaje}`);
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
