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
import { MATERIA_INICIAL_POR_CELDA, NIVEL_SUBDIVISION } from '../src/sim/constants.js';

describe('conservación de masa', () => {
  it('el mundo nace con la materia que dicen las constantes', () => {
    const estado = crearEstado(1);
    expect(materiaTotal(estado)).toBe(celdasDelNivel(NIVEL_SUBDIVISION) * MATERIA_INICIAL_POR_CELDA);
  });

  it('la materia total es idéntica tras 10.000 ticks', () => {
    const estado = crearEstado(1);
    const geo = geometriaDe(estado);
    const inicial = materiaTotal(estado);
    for (let i = 0; i < 10_000; i++) avanzarUnTick(estado, geo);
    expect(materiaTotal(estado)).toBe(inicial);
  });

  it('se conserva con cualquier semilla', () => {
    for (const semilla of [1, 7, 42, 1234, 987654321]) {
      const estado = crearEstado(semilla);
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
    const estado = crearEstado(3);
    const geo = geometriaDe(estado);
    estado.materia.fill(0);
    estado.materia[0] = 1_000_000;
    const inicial = materiaTotal(estado);
    expect(inicial).toBe(1_000_000);

    for (let i = 0; i < 5000; i++) avanzarUnTick(estado, geo);
    expect(materiaTotal(estado)).toBe(inicial);
  });

  it('ninguna celda queda con materia negativa', () => {
    const estado = crearEstado(5);
    const geo = geometriaDe(estado);
    estado.materia.fill(0);
    estado.materia[estado.materia.length - 1] = 500_000;

    for (let i = 0; i < 2000; i++) avanzarUnTick(estado, geo);
    for (let i = 0; i < estado.materia.length; i++) {
      expect(estado.materia[i]!, `celda ${i}`).toBeGreaterThanOrEqual(0);
    }
  });
});
