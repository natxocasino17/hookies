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
import {
  MAX_VECINOS,
  NIVEL_SUBDIVISION,
  TICKS_POR_ANO,
  TICKS_POR_DIA,
} from '../src/sim/constants.js';
import { crearEstado, geometriaDe } from '../src/sim/estado.js';
import { avanzarUnTick } from '../src/sim/tick.js';
import { aguaTotal, direccionDelSol } from '../src/sim/clima.js';
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

describe('el clima', () => {
  it('el agua del planeta no cambia jamás', () => {
    // El ciclo del agua mueve enteros de un sitio a otro: lo que se evapora sale
    // de una celda y entra en otra. Si esto falla, hay agua naciendo o
    // desapareciendo, y cualquier conclusión sobre el mundo deja de valer.
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    const inicial = aguaTotal(estado);
    for (let i = 0; i < 8_000; i++) avanzarUnTick(estado, geo);
    expect(aguaTotal(estado)).toBe(inicial);
  });

  it('ninguna celda queda con agua negativa', () => {
    const estado = crearEstado(7);
    const geo = geometriaDe(estado);
    for (let i = 0; i < 5000; i++) avanzarUnTick(estado, geo);
    for (let i = 0; i < estado.nCeldas; i++) {
      expect(estado.aguaSuelo[i]!, `suelo de la celda ${i}`).toBeGreaterThanOrEqual(0);
      expect(estado.humedadAire[i]!, `aire de la celda ${i}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('el sol da una vuelta al día y sube y baja con el año', () => {
    // Las estaciones no son una regla: son la latitud donde el sol cae a plomo
    // subiendo y bajando entre los trópicos.
    const mediodia = direccionDelSol(0);
    const medianoche = direccionDelSol(TICKS_POR_DIA / 2);
    // Medio día después, el sol está justo al otro lado.
    expect(mediodia[0]! * medianoche[0]! + mediodia[2]! * medianoche[2]!).toBeLessThan(0);

    // A lo largo del año el sol cruza de un hemisferio al otro.
    const alturas = [0, 0.25, 0.5, 0.75].map((f) => direccionDelSol(Math.floor(f * TICKS_POR_ANO))[1]!);
    expect(Math.max(...alturas)).toBeGreaterThan(0.3);
    expect(Math.min(...alturas)).toBeLessThan(-0.3);
  });

  it('el ecuador es más caliente que los polos, y hay hielo', () => {
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    // Un año basta: el gradiente ecuador-polos ya está formado.
    for (let i = 0; i < TICKS_POR_ANO; i++) avanzarUnTick(estado, geo);

    const todas = [...Array(estado.nCeldas).keys()];
    const media = (celdas: number[]) =>
      celdas.reduce((s, i) => s + estado.temperatura[i]!, 0) / celdas.length;
    const ecuador = todas.filter((i) => Math.abs(geo.centro[i * 3 + 1]!) < 0.2);
    const polos = todas.filter((i) => Math.abs(geo.centro[i * 3 + 1]!) > 0.9);

    expect(media(ecuador)).toBeGreaterThan(media(polos) + 20);
    // Casquetes helados, pero no una bola de nieve.
    const helado = todas.filter((i) => estado.temperatura[i]! < 0).length / estado.nCeldas;
    expect(helado).toBeGreaterThan(0.05);
    expect(helado).toBeLessThan(0.6);
  });
});
