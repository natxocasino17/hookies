/**
 * TEST 2 DE 3 — DETERMINISMO.
 *
 * Mismo estado y misma semilla, mismo resultado tras 10.000 ticks
 * (CLAUDE.md §2.1).
 *
 * Sin esto no se puede volver a visitar un mundo, ni compartir una semilla, ni
 * confiar en que un cambio de parámetro fue la causa de lo que se vio: cada
 * corrida sería distinta y no habría forma de comparar nada.
 */

import { describe, expect, it } from 'vitest';
import {
  crearEstado,
  deserializar,
  geometriaDe,
  huellaEstado,
  serializar,
} from '../src/sim/estado.js';
import { avanzarUnTick } from '../src/sim/tick.js';
import { crearRng, siguienteU32 } from '../src/sim/rng.js';
import { dExp, dLog, dSeno, dTanh, senoDeVuelta } from '../src/sim/math.js';

/**
 * Estos tests corren sobre un planeta pequeño (nivel 3, 642 celdas) en vez del
 * de siempre (nivel 4, 2.562).
 *
 * No es hacer trampa: **el determinismo y la conservación son propiedades del
 * algoritmo, no del tamaño del mundo** — se recorre el mismo código, las mismas
 * reglas y las mismas rutas. Lo que cambia es que caben los 10.000 ticks que
 * exige CLAUDE.md §2.1 en segundos en vez de en minutos.
 *
 * Y esa es la razón de fondo: con el planeta grande estos tests tardaban tanto
 * que dejaban de correrse, y un test que no se corre es un test que no existe.
 * Los tres centrales son justamente los que nunca pueden dejar de comprobarse.
 */
const NIVEL_DE_PRUEBA = 3;

function correr(semilla: number, ticks: number) {
  const estado = crearEstado(semilla, NIVEL_DE_PRUEBA);
  const geo = geometriaDe(estado);
  for (let i = 0; i < ticks; i++) avanzarUnTick(estado, geo);
  return estado;
}

describe('determinismo', () => {
  it('dos corridas con la misma semilla dan la misma huella tras 10.000 ticks', () => {
    expect(huellaEstado(correr(1234, 10_000))).toBe(huellaEstado(correr(1234, 10_000)));
  });

  it('semillas distintas dan mundos distintos', () => {
    // Si esto fallara, la semilla no estaría haciendo nada y todos los mundos
    // serían el mismo.
    const huellas = new Set([1, 2, 3, 4, 5].map((s) => huellaEstado(correr(s, 500))));
    expect(huellas.size).toBe(5);
  });

  it('guardar y volver a cargar en el medio no cambia el resultado', () => {
    // Este es el que de verdad importa para el juego: es lo que pasa cada vez
    // que alguien cierra la app y la vuelve a abrir.
    const entera = correr(777, 10_000);

    const partida = crearEstado(777, NIVEL_DE_PRUEBA);
    const geo = geometriaDe(partida);
    for (let i = 0; i < 4000; i++) avanzarUnTick(partida, geo);
    // Se reconstruye desde los bytes, igual que al abrir la app otro día.
    const revivida = deserializar(serializar(partida));
    const geoRevivida = geometriaDe(revivida);
    for (let i = 0; i < 6000; i++) avanzarUnTick(revivida, geoRevivida);

    expect(huellaEstado(revivida)).toBe(huellaEstado(entera));
  });

  it('serializar y deserializar devuelve exactamente el mismo mundo', () => {
    const estado = correr(99, 1234);
    const copia = deserializar(serializar(estado));

    expect(copia.tick).toBe(estado.tick);
    expect(copia.semilla).toBe(estado.semilla);
    expect(Array.from(copia.rng)).toEqual(Array.from(estado.rng));
    expect(Array.from(copia.materia)).toEqual(Array.from(estado.materia));
    expect(Array.from(copia.altura)).toEqual(Array.from(estado.altura));
  });

  it('el generador de azar da siempre la misma secuencia', () => {
    const a = crearRng(42);
    const b = crearRng(42);
    for (let i = 0; i < 1000; i++) expect(siguienteU32(a)).toBe(siguienteU32(b));
  });

  it('el generador no se queda pegado ni se repite enseguida', () => {
    const rng = crearRng(8);
    const vistos = new Set<number>();
    for (let i = 0; i < 100_000; i++) vistos.add(siguienteU32(rng));
    // Con 100.000 tiradas sobre 2^32 valores, las colisiones esperadas son
    // poquísimas: si aparecieran muchas, el generador tendría un ciclo corto.
    expect(vistos.size).toBeGreaterThan(99_990);
  });
});

describe('matemática determinista', () => {
  // No se comprueba contra `Math.exp` bit a bit a propósito: la razón de existir
  // de estas funciones es no depender del motor. Se comprueba que sean correctas
  // dentro de una tolerancia estrecha, y sobre todo que sean estables.
  //
  // El error se mide relativo al valor esperado, pero acotando el divisor a uno:
  // el error relativo no está definido donde el resultado vale cero (log(1), por
  // ejemplo) y ahí lo que importa es el error absoluto.
  const casi = (obtenido: number, esperado: number, tol = 1e-13) => {
    const escala = Math.max(1, Math.abs(esperado));
    expect(Math.abs(obtenido - esperado) / escala).toBeLessThan(tol);
  };

  it('la exponencial es correcta', () => {
    casi(dExp(0), 1);
    for (const x of [-20, -3.5, -1, -0.1, 0.1, 1, 3.5, 20, 100]) {
      expect(Math.abs(dExp(x) / Math.exp(x) - 1), `exp(${x})`).toBeLessThan(1e-13);
    }
  });

  it('el logaritmo es correcto y es el inverso de la exponencial', () => {
    casi(dLog(1), 0);
    for (const x of [1e-8, 0.5, 1, 2, 7, 1000, 1e12]) {
      casi(dLog(x), Math.log(x));
      expect(Math.abs(dExp(dLog(x)) / x - 1), `exp(log(${x}))`).toBeLessThan(1e-13);
    }
  });

  it('la tangente hiperbólica se mantiene entre -1 y 1', () => {
    casi(dTanh(0), 0);
    for (const x of [-50, -2, -0.5, 0.5, 2, 50]) {
      casi(dTanh(x), Math.tanh(x));
      expect(dTanh(x)).toBeGreaterThanOrEqual(-1);
      expect(dTanh(x)).toBeLessThanOrEqual(1);
    }
  });

  it('el seno es correcto', () => {
    for (const x of [-6, -1, -0.1, 0, 0.1, 1, 3, 6, 100]) {
      casi(dSeno(x), Math.sin(x), 1e-11);
    }
  });

  it('el seno por vueltas no se degrada por muchos ciclos que pasen', () => {
    // Es la forma en que se escriben el día y el año: la fase se envuelve entre
    // 0 y 1 y nunca crece, así que tras un millón de vueltas sigue siendo exacto.
    casi(senoDeVuelta(0), 0, 1e-11);
    casi(senoDeVuelta(0.25), 1, 1e-11);
    casi(senoDeVuelta(1_000_000.25), 1, 1e-11);
    casi(senoDeVuelta(0.5), 0, 1e-11);
    casi(senoDeVuelta(0.75), -1, 1e-11);
  });

  it('da exactamente el mismo bit al repetir la llamada', () => {
    for (const x of [0.1, 1, 7.25, -3.5]) {
      expect(dExp(x)).toBe(dExp(x));
      expect(dTanh(x)).toBe(dTanh(x));
      expect(dSeno(x)).toBe(dSeno(x));
    }
  });
});
