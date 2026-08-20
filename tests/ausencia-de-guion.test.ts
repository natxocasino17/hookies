/**
 * TEST 3 DE 3 — AUSENCIA DE GUION.
 *
 * Este es el test que me impide hacer trampa a mí.
 *
 * El proyecto vale por una sola cosa: que lo que pase ahí dentro no lo haya
 * escrito nadie. La tentación permanente, cuando algo no emerge, es meter un
 * caso especial para que "por fin funcione". Este test salta si eso pasa.
 *
 * Es un detector, no una demostración: puede ver un sexto verbo, una tabla de
 * especies o un diccionario de palabras, pero no puede ver un comportamiento
 * programado con nombres inocentes. Para eso está la revisión. Aun así, atrapa
 * la forma más común del error.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANCHO_SALIDA, N_SALIDAS_CEREBRO, VERBOS } from '../src/sim/verbos.js';
import { migrar, VERSION_ESQUEMA } from '../src/sim/esquema.js';

const RAIZ_SIM = join(process.cwd(), 'src', 'sim');

/** Archivos donde sí se permiten literales decimales, y por qué. */
const PERMITEN_DECIMALES = new Set([
  'constants.ts', // es el archivo único de parámetros: su razón de ser
  'math.ts', // coeficientes de polinomios, no parámetros del mundo
]);

/** Funciones de `Math` que el estándar sí especifica bit a bit. */
const MATH_PERMITIDO = new Set([
  'abs', 'floor', 'ceil', 'round', 'trunc', 'sign',
  'min', 'max', 'imul', 'sqrt', 'fround', 'clz32',
]);

function archivosDeSim(): { nombre: string; ruta: string; fuente: string }[] {
  const salida: { nombre: string; ruta: string; fuente: string }[] = [];
  for (const entrada of readdirSync(RAIZ_SIM, { withFileTypes: true, recursive: true })) {
    if (!entrada.isFile() || !entrada.name.endsWith('.ts')) continue;
    const ruta = join(entrada.parentPath ?? RAIZ_SIM, entrada.name);
    salida.push({ nombre: entrada.name, ruta, fuente: readFileSync(ruta, 'utf8') });
  }
  return salida;
}

/** Quita comentarios: lo que se juzga es el código, no lo que se explica de él. */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const ARCHIVOS = archivosDeSim();

describe('los verbos son cinco y no hay más', () => {
  it('la lista tiene exactamente cinco verbos', () => {
    expect(VERBOS.length).toBe(5);
  });

  it('son los cinco de siempre', () => {
    expect([...VERBOS]).toEqual(['MOVER', 'AGARRAR_SOLTAR', 'MORDER', 'EMITIR_SENAL', 'RASCAR_SUELO']);
  });

  it('el vector de salida del cerebro mide nueve números', () => {
    // Dos de dirección, uno de agarrar, uno de morder, cuatro de señal y uno de
    // rascar. Si alguien agregara un verbo, este número cambiaría.
    expect(N_SALIDAS_CEREBRO).toBe(9);
    expect(Object.keys(ANCHO_SALIDA).length).toBe(5);
  });

  it('la señal es un vector de cuatro números, no una palabra de una lista', () => {
    expect(ANCHO_SALIDA.EMITIR_SENAL).toBe(4);
  });
});

describe('no hay listas predefinidas de nada', () => {
  const PROHIBIDOS: [nombre: string, patron: RegExp][] = [
    ['tabla de especies', /\b(ESPECIES|TABLA_ESPECIES|LISTA_ESPECIES|SPECIES_TABLE)\b/],
    ['catálogo de moléculas', /\b(CATALOGO_MOLECULAS|TABLA_MOLECULAS|MOLECULE_TABLE)\b/],
    ['diccionario de palabras', /\b(PALABRAS|VOCABULARIO|DICCIONARIO|LEXICO_FIJO)\b/],
    ['lista de glifos', /\b(GLIFOS_PREDEFINIDOS|TABLA_GLIFOS)\b/],
  ];

  for (const [nombre, patron] of PROHIBIDOS) {
    it(`no aparece ninguna ${nombre}`, () => {
      for (const a of ARCHIVOS) {
        expect(sinComentarios(a.fuente), `${a.nombre} declara una ${nombre}`).not.toMatch(patron);
      }
    });
  }

  it('el único catálogo permitido es el alfabeto de átomos', () => {
    // Los átomos y las reglas de reescritura son las leyes de la física del
    // mundo: son pocas, no cambian nunca, y toda la variedad sale del espacio de
    // cadenas y no de la tabla. Todo lo demás se detecta a posteriori.
    const constantes = readFileSync(join(RAIZ_SIM, 'constants.ts'), 'utf8');
    expect(constantes).toMatch(/N_TIPOS_ATOMO/);
  });
});

describe('no hay comportamientos programados', () => {
  // Prueba de olfato de CLAUDE.md §1.1: si un identificador nombra la intención
  // de una criatura en vez de una fuerza del mundo, está mal.
  const INTENCIONES = [
    'cazar', 'cortejar', 'cortejo', 'huir', 'refugio', 'tribu', 'manada',
    'ensenar', 'buscarComida', 'cuidarCria', 'aparearse', 'recompensaPor',
  ];

  for (const palabra of INTENCIONES) {
    it(`ningún identificador se llama "${palabra}"`, () => {
      // Sin límite de palabra al final, para que también salte con nombres
      // compuestos como CAZAR_EN_GRUPO o cuidarCriaAjena.
      const patron = new RegExp(`\\b${palabra}`, 'i');
      for (const a of ARCHIVOS) {
        expect(sinComentarios(a.fuente), `${a.nombre} programa "${palabra}"`).not.toMatch(patron);
      }
    });
  }
});

describe('no hay parámetros escondidos', () => {
  it('los literales decimales solo viven en el archivo de constantes', () => {
    const patron = /\b\d+\.\d+|\b\d+e[+-]?\d+\b/gi;
    for (const a of ARCHIVOS) {
      if (PERMITEN_DECIMALES.has(a.nombre)) continue;
      const encontrados = sinComentarios(a.fuente).match(patron);
      expect(
        encontrados,
        `${a.nombre} tiene números sueltos (${encontrados?.join(', ')}). Todo parámetro va en constants.ts.`,
      ).toBeNull();
    }
  });
});

describe('el determinismo no depende del motor ni del reloj', () => {
  it('no se usa el azar sin semilla', () => {
    for (const a of ARCHIVOS) {
      expect(sinComentarios(a.fuente), `${a.nombre} usa Math.random`).not.toMatch(/Math\.random/);
    }
  });

  it('la simulación no lee la hora', () => {
    // Cualquier decisión que dependa del tiempo real haría que el mundo
    // cambiara según lo rápido que fuera el teléfono.
    for (const a of ARCHIVOS) {
      const fuente = sinComentarios(a.fuente);
      expect(fuente, `${a.nombre} lee Date.now`).not.toMatch(/Date\.now|new Date\b/);
      expect(fuente, `${a.nombre} lee performance.now`).not.toMatch(/performance\.now/);
    }
  });

  it('no se usan funciones de Math que cada navegador redondea distinto', () => {
    // Math.exp, Math.sin y compañía no están especificadas bit a bit: dos
    // navegadores pueden devolver un último bit distinto, y en un sistema
    // caótico eso termina siendo un mundo entero de diferencia.
    for (const a of ARCHIVOS) {
      const fuente = sinComentarios(a.fuente);
      for (const uso of fuente.matchAll(/Math\.([a-zA-Z0-9_]+)/g)) {
        const funcion = uso[1]!;
        expect(
          MATH_PERMITIDO.has(funcion),
          `${a.nombre} usa Math.${funcion}, que no es igual en todos los motores. Usar la versión de math.ts.`,
        ).toBe(true);
      }
    }
  });
});

describe('un mundo nunca se borra por un cambio de formato', () => {
  it('un estado ya al día se deja tal cual', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(migrar(bytes, VERSION_ESQUEMA)).toBe(bytes);
  });

  it('si falta una migración se avisa, no se descarta el mundo', () => {
    expect(() => migrar(new Uint8Array([1]), VERSION_ESQUEMA - 1)).toThrow(/[Ff]alta la migración/);
  });

  it('un mundo de una versión más nueva no se toca', () => {
    expect(() => migrar(new Uint8Array([1]), VERSION_ESQUEMA + 1)).toThrow(/versión más nueva/);
  });
});
