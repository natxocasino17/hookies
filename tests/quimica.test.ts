/**
 * La química: que conserve átomos, que no se pare, y que las reglas permitan
 * autocatálisis.
 *
 * Los que necesitan correr miles de ticks están en tests/lentos.
 */

import { describe, expect, it } from 'vitest';
import { MAX_CADENA_SOPA, N_TIPOS_ATOMO } from '../src/sim/constants.js';
import {
  atomoEn,
  atomoSuelto,
  comoTexto,
  complementoDe,
  encajan,
  longitud,
  prefijo,
  primerAtomo,
  sufijo,
  sustituir,
  ultimoAtomo,
  unir,
  MOLECULA_VACIA,
} from '../src/sim/molecula.js';
import { autocataliticasPosibles, esAutocatalitica } from '../src/sim/autocatalisis.js';

describe('una molécula es su cadena', () => {
  it('lo que se guarda es lo que se lee', () => {
    let m = atomoSuelto(3);
    for (const t of [1, 5, 0, 2, 4]) m = unir(m, atomoSuelto(t));
    expect(longitud(m)).toBe(6);
    expect([...Array(6).keys()].map((i) => atomoEn(m, i))).toEqual([3, 1, 5, 0, 2, 4]);
    expect(primerAtomo(m)).toBe(3);
    expect(ultimoAtomo(m)).toBe(4);
    expect(comoTexto(m)).toBe('DBFACE');
  });

  it('cabe entera en un entero de 32 bits', () => {
    // Es la razón de que el largo máximo sea ocho: si no cupiera, el bucle
    // caliente tendría que tocar objetos y el recolector de basura se comería
    // el presupuesto.
    let m = atomoSuelto(N_TIPOS_ATOMO - 1);
    for (let i = 1; i < MAX_CADENA_SOPA; i++) m = unir(m, atomoSuelto(N_TIPOS_ATOMO - 1));
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThanOrEqual(0x7fffffff);
    expect(m | 0).toBe(m);
  });

  it('partir y volver a unir devuelve lo mismo', () => {
    let m = atomoSuelto(1);
    for (const t of [4, 2, 3, 0]) m = unir(m, atomoSuelto(t));
    for (let corte = 1; corte < longitud(m); corte++) {
      expect(unir(prefijo(m, corte), sufijo(m, corte))).toBe(m);
    }
  });

  it('no se puede pasar del largo máximo', () => {
    let m = atomoSuelto(0);
    for (let i = 1; i < MAX_CADENA_SOPA; i++) m = unir(m, atomoSuelto(0));
    expect(longitud(m)).toBe(MAX_CADENA_SOPA);
    expect(unir(m, atomoSuelto(0))).toBe(MOLECULA_VACIA);
  });

  it('sustituir cambia un átomo y deja el resto igual', () => {
    let m = atomoSuelto(1);
    for (const t of [2, 3]) m = unir(m, atomoSuelto(t));
    const cambiada = sustituir(m, 1, 5);
    expect(longitud(cambiada)).toBe(3);
    expect([atomoEn(cambiada, 0), atomoEn(cambiada, 1), atomoEn(cambiada, 2)]).toEqual([1, 5, 3]);
  });
});

describe('la regla de afinidad', () => {
  it('el complemento del complemento es uno mismo', () => {
    for (let t = 0; t < N_TIPOS_ATOMO; t++) {
      expect(complementoDe(complementoDe(t))).toBe(t);
    }
  });

  it('cada átomo encaja con exactamente uno', () => {
    // No hay tabla de qué se une con qué: hay un número por átomo y una regla.
    for (let a = 0; a < N_TIPOS_ATOMO; a++) {
      const parejas = [...Array(N_TIPOS_ATOMO).keys()].filter((b) => encajan(a, b));
      expect(parejas.length, `el átomo ${a}`).toBe(1);
    }
  });
});

describe('las reglas permiten la autocatálisis', () => {
  it('hay cadenas que pueden catalizar su propia formación', () => {
    // Si esto diera cero, no habría nada que esperar de la fase 2 y habría que
    // cambiar la regla de catálisis antes de seguir. No es que las vaya a haber
    // en el mundo: es que las reglas no lo prohíben.
    expect(autocataliticasPosibles(MAX_CADENA_SOPA)).toBeGreaterThan(1000);
  });

  it('una cadena alterna simple se cataliza a sí misma, y una sola letra no', () => {
    // EBEB contiene "EB", que es justo lo que hace falta para sujetar el enlace
    // entre la B del final de EB y la E del principio del siguiente EB.
    const eb = unir(atomoSuelto(4), atomoSuelto(1));
    const ebeb = unir(eb, eb);
    expect(esAutocatalitica(ebeb)).toBe(true);

    // Una cadena de un solo tipo de átomo no puede: no lleva dentro el
    // complemento de su propio enlace.
    let aaaa = atomoSuelto(0);
    for (let i = 0; i < 3; i++) aaaa = unir(aaaa, atomoSuelto(0));
    expect(esAutocatalitica(aaaa)).toBe(false);
  });
});
