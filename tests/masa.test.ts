/**
 * TEST 1 DE 3 — MASA.
 *
 * La materia total del mundo no cambia jamás (CLAUDE.md §2.2).
 *
 * No es una comprobación aproximada con margen de tolerancia: la materia se
 * cuenta en enteros justamente para que esto sea exacto (decisión D7). Si este
 * test falla, hay materia apareciendo o desapareciendo de la nada, y eso invalida
 * cualquier conclusión sobre lo que pase en el mundo.
 */

import { describe, expect, it } from 'vitest';
import { crearEstado, geometriaDe, materiaTotal } from '../src/sim/estado.js';
import { avanzarUnTick } from '../src/sim/tick.js';
import { celdasDelNivel } from '../src/sim/geodesica.js';
import { MATERIA_INICIAL_POR_CELDA } from '../src/sim/constants.js';

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

describe('conservación de masa', () => {
  it('el mundo nace con la materia que dicen las constantes', () => {
    const estado = crearEstado(1, NIVEL_DE_PRUEBA);
    expect(materiaTotal(estado)).toBe(celdasDelNivel(NIVEL_DE_PRUEBA) * MATERIA_INICIAL_POR_CELDA);
  });

  it('la materia total es idéntica tras 10.000 ticks', () => {
    const estado = crearEstado(1, NIVEL_DE_PRUEBA);
    const geo = geometriaDe(estado);
    const inicial = materiaTotal(estado);
    for (let i = 0; i < 10_000; i++) avanzarUnTick(estado, geo);
    expect(materiaTotal(estado)).toBe(inicial);
  });

  it('se conserva con cualquier semilla', () => {
    for (const semilla of [1, 7, 42, 1234, 987654321]) {
      const estado = crearEstado(semilla, NIVEL_DE_PRUEBA);
      const geo = geometriaDe(estado);
      const inicial = materiaTotal(estado);
      for (let i = 0; i < 1000; i++) avanzarUnTick(estado, geo);
      expect(materiaTotal(estado), `semilla ${semilla}`).toBe(inicial);
    }
  });

  it('se conserva partiendo de un reparto desigual', () => {
    // El caso interesante no es el mundo uniforme, donde la difusión no mueve
    // nada, sino uno con todo amontonado en una esquina: ahí los flujos son
    // grandes y es donde un redondeo mal hecho perdería átomos.
    const estado = crearEstado(3, NIVEL_DE_PRUEBA);
    const geo = geometriaDe(estado);
    estado.materia.fill(0);
    estado.materia[0] = 1_000_000;
    // La materia que está dentro de las plantas también es materia del mundo,
    // así que el total de partida es el amontonamiento más lo que ya sostienen
    // las primeras plantas.
    const inicial = materiaTotal(estado);
    expect(inicial).toBeGreaterThanOrEqual(1_000_000);

    for (let i = 0; i < 5000; i++) avanzarUnTick(estado, geo);
    expect(materiaTotal(estado)).toBe(inicial);
  });

  it('ninguna celda queda con materia negativa', () => {
    const estado = crearEstado(5, NIVEL_DE_PRUEBA);
    const geo = geometriaDe(estado);
    estado.materia.fill(0);
    estado.materia[estado.materia.length - 1] = 500_000;

    for (let i = 0; i < 2000; i++) avanzarUnTick(estado, geo);
    for (let i = 0; i < estado.materia.length; i++) {
      expect(estado.materia[i]!, `celda ${i}`).toBeGreaterThanOrEqual(0);
    }
  });
});
