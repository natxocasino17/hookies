/**
 * El planeta: que la rejilla esté bien hecha y salga siempre igual.
 *
 * Una esfera no se puede cubrir con hexágonos iguales — hacen falta doce
 * pentágonos, como en un balón de fútbol. Estos tests comprueban que la
 * geometría cumple lo que tiene que cumplir, porque encima de ella se van a
 * apoyar la difusión, el movimiento y la vista de todo lo demás.
 */

import { describe, expect, it } from 'vitest';
import { celdasDelNivel, construirGeometria } from '../src/sim/geodesica.js';
import { MAX_VECINOS, NIVEL_SUBDIVISION } from '../src/sim/constants.js';
import { crearEstado } from '../src/sim/estado.js';
import { fraccionDeTierra } from '../src/sim/terreno.js';

const geo = construirGeometria(NIVEL_SUBDIVISION);

describe('la rejilla del planeta', () => {
  it('tiene las celdas que le tocan por su nivel', () => {
    expect(geo.nCeldas).toBe(celdasDelNivel(NIVEL_SUBDIVISION));
    expect(geo.nCeldas).toBe(2562);
  });

  it('tiene exactamente doce pentágonos y el resto hexágonos', () => {
    // Los doce no son un defecto del método: son inevitables en cualquier
    // esfera cubierta de hexágonos. Si salieran más, la malla está rota.
    let pentagonos = 0;
    for (let i = 0; i < geo.nCeldas; i++) {
      const n = geo.nVecinos[i]!;
      expect(n === 5 || n === 6, `la celda ${i} tiene ${n} vecinos`).toBe(true);
      if (n === 5) pentagonos++;
    }
    expect(pentagonos).toBe(12);
  });

  it('la vecindad es recíproca: si yo soy tu vecino, tú eres el mío', () => {
    // Si esto fallara, la difusión movería materia en un sentido y no en el
    // otro, y la masa dejaría de conservarse.
    for (let i = 0; i < geo.nCeldas; i++) {
      for (let k = 0; k < geo.nVecinos[i]!; k++) {
        const j = geo.vecinos[i * MAX_VECINOS + k]!;
        const suyos = [];
        for (let m = 0; m < geo.nVecinos[j]!; m++) suyos.push(geo.vecinos[j * MAX_VECINOS + m]);
        expect(suyos, `${i} dice ser vecina de ${j}`).toContain(i);
      }
    }
  });

  it('no hay celdas sueltas ni celdas vecinas de sí mismas', () => {
    for (let i = 0; i < geo.nCeldas; i++) {
      const suyos = new Set<number>();
      for (let k = 0; k < geo.nVecinos[i]!; k++) suyos.add(geo.vecinos[i * MAX_VECINOS + k]!);
      expect(suyos.has(i), `la celda ${i} es vecina de sí misma`).toBe(false);
      expect(suyos.size).toBe(geo.nVecinos[i]!);
    }
  });

  it('todas las celdas están sobre la superficie de la esfera', () => {
    for (let i = 0; i < geo.nCeldas; i++) {
      const x = geo.centro[i * 3]!;
      const y = geo.centro[i * 3 + 1]!;
      const z = geo.centro[i * 3 + 2]!;
      expect(Math.abs(Math.sqrt(x * x + y * y + z * z) - 1)).toBeLessThan(1e-6);
    }
  });

  it('las celdas son de tamaño parecido', () => {
    // Es la razón de usar esta rejilla y no una de latitud y longitud: si unas
    // celdas fueran mucho más grandes que otras, la difusión daría resultados
    // distintos según dónde estés, que es física falsa.
    const areas: number[] = [];
    for (let i = 0; i < geo.nCeldas; i++) {
      let suma = 0;
      const lados = geo.nVecinos[i]!;
      for (let k = 0; k < lados; k++) {
        const a = (i * MAX_VECINOS + k) * 3;
        const b = (i * MAX_VECINOS + ((k + 1) % lados)) * 3;
        const dx = geo.esquinas[a]! - geo.esquinas[b]!;
        const dy = geo.esquinas[a + 1]! - geo.esquinas[b + 1]!;
        const dz = geo.esquinas[a + 2]! - geo.esquinas[b + 2]!;
        suma += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      areas.push(suma);
    }
    const menor = Math.min(...areas);
    const mayor = Math.max(...areas);
    // Los pentágonos son algo más chicos; más allá de un 30 % sería un problema.
    expect(mayor / menor).toBeLessThan(1.3);
  });

  it('sale idéntica cada vez que se construye', () => {
    // No depende de la semilla: es siempre la misma para un mismo nivel. Por eso
    // no se guarda en el archivo del mundo, y por eso tiene que salir igual.
    const otra = construirGeometria(NIVEL_SUBDIVISION);
    expect(Array.from(otra.vecinos)).toEqual(Array.from(geo.vecinos));
    expect(Array.from(otra.centro)).toEqual(Array.from(geo.centro));
    expect(Array.from(otra.esquinas)).toEqual(Array.from(geo.esquinas));
  });
});

describe('el terreno', () => {
  it('la misma semilla da el mismo planeta', () => {
    expect(Array.from(crearEstado(4242).altura)).toEqual(Array.from(crearEstado(4242).altura));
  });

  it('semillas distintas dan planetas distintos', () => {
    expect(Array.from(crearEstado(1).altura)).not.toEqual(Array.from(crearEstado(2).altura));
  });

  it('sale un mundo con tierra y con mar, no todo uno ni todo lo otro', () => {
    // Si saliera un planeta entero de agua o entero de roca, no habría costas,
    // y las costas son donde se junta todo.
    for (const semilla of [1, 42, 777, 1234, 99999]) {
      const fraccion = fraccionDeTierra(crearEstado(semilla).altura);
      expect(fraccion, `semilla ${semilla}: ${(fraccion * 100).toFixed(0)} % de tierra`)
        .toBeGreaterThan(0.1);
      expect(fraccion, `semilla ${semilla}: ${(fraccion * 100).toFixed(0)} % de tierra`)
        .toBeLessThan(0.75);
    }
  });
});
