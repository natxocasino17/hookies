/**
 * La rejilla del planeta.
 *
 * El mundo es una esfera, no un cuadrado (decisión D10). Pero una esfera no se
 * puede cubrir con celdas iguales: si se usa una rejilla de latitud y longitud,
 * las celdas se encogen hasta desaparecer en los polos y la difusión da
 * resultados distintos según la latitud, que es un error de física disfrazado
 * de comodidad.
 *
 * La solución es la que usan los modelos de clima de verdad: partir de un
 * icosaedro, subdividir sus triángulos, y quedarse con el **dual** de esa malla.
 * Sale un tablero de hexágonos casi iguales con exactamente **doce pentágonos**,
 * que son inevitables en cualquier esfera — por eso un balón de fútbol también
 * los tiene.
 *
 * Lo que se gana respecto a un mapa plano:
 *   · no hay bordes donde amontonarse, ni costura donde el mundo se repita
 *   · el día y la noche salen de girar la bola, no de una fórmula
 *   · los polos son fríos porque el sol les llega de lado, no porque yo lo diga
 *
 * Esta rejilla **no depende de la semilla**: es siempre la misma para un mismo
 * nivel de subdivisión. Por eso no se guarda en el estado, se reconstruye al
 * cargar, y por eso tiene que salir idéntica siempre.
 */

import { dRaiz } from './math.js';
import { MAX_VECINOS } from './constants.js';

export interface Geometria {
  /** Cuántas celdas tiene el planeta. */
  nCeldas: number;
  /** Centro de cada celda como vector unitario. 3 números por celda. */
  centro: Float32Array;
  /** Vecinos de cada celda. MAX_VECINOS por celda; los pentágonos rellenan con -1. */
  vecinos: Int32Array;
  /** Cuántos vecinos tiene cada celda de verdad: seis, o cinco si es pentágono. */
  nVecinos: Uint8Array;
  /** Esquinas del polígono de cada celda, en orden. MAX_VECINOS * 3 por celda. */
  esquinas: Float32Array;
}

/**
 * Orden angular sin usar `atan2`.
 *
 * Hace falta ordenar las esquinas de cada celda alrededor de su centro, y
 * `Math.atan2` no está especificada bit a bit por el estándar: dos navegadores
 * podrían ordenarlas distinto y el planeta saldría diferente. Esta función no
 * devuelve el ángulo, pero **crece igual que el ángulo**, que es lo único que
 * necesita una ordenación, y solo usa sumas, restas, multiplicaciones y
 * divisiones, que sí son idénticas en todos los motores.
 */
function ordenAngular(x: number, y: number): number {
  const suma = (x < 0 ? -x : x) + (y < 0 ? -y : y);
  if (suma === 0) return 0;
  const p = x / suma;
  return y < 0 ? p - 1 : 1 - p;
}

function normalizar(v: number[]): number[] {
  const largo = dRaiz(v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]!);
  return [v[0]! / largo, v[1]! / largo, v[2]! / largo];
}

/** Los doce vértices y veinte caras del icosaedro, de donde sale todo. */
function icosaedro(): { vertices: number[][]; caras: number[][] } {
  // La proporción áurea, que es lo que coloca los vértices de un icosaedro.
  const t = (1 + dRaiz(5)) / 2;
  const vertices = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(normalizar);

  const caras = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  return { vertices, caras };
}

/**
 * Construye el planeta. `nivel` es cuántas veces se parte cada triángulo:
 * cada nivel multiplica las celdas por cuatro.
 *
 *   nivel 3 →    642 celdas
 *   nivel 4 →  2.562 celdas   ← el que usa el proyecto
 *   nivel 5 → 10.242 celdas
 */
export function construirGeometria(nivel: number): Geometria {
  const { vertices, caras } = icosaedro();
  let carasActuales = caras;

  // --- Subdividir: cada triángulo se parte en cuatro ------------------------
  for (let paso = 0; paso < nivel; paso++) {
    const nuevas: number[][] = [];
    // Los triángulos vecinos comparten aristas: sin esta caché, el punto medio
    // de una arista se crearía dos veces y el planeta saldría agujereado.
    const puntosMedios = new Map<number, number>();

    const medio = (a: number, b: number): number => {
      const menor = a < b ? a : b;
      const mayor = a < b ? b : a;
      const clave = menor * 65536 + mayor;
      const guardado = puntosMedios.get(clave);
      if (guardado !== undefined) return guardado;

      const va = vertices[a]!;
      const vb = vertices[b]!;
      vertices.push(normalizar([va[0]! + vb[0]!, va[1]! + vb[1]!, va[2]! + vb[2]!]));
      const indice = vertices.length - 1;
      puntosMedios.set(clave, indice);
      return indice;
    };

    for (const [a, b, c] of carasActuales) {
      const ab = medio(a!, b!);
      const bc = medio(b!, c!);
      const ca = medio(c!, a!);
      nuevas.push([a!, ab, ca], [b!, bc, ab], [c!, ca, bc], [ab, bc, ca]);
    }
    carasActuales = nuevas;
  }

  // --- El dual: cada vértice de la malla se convierte en una celda ----------
  const nCeldas = vertices.length;

  // Qué caras toca cada vértice. Se recorre en orden fijo, así que sale igual
  // siempre.
  const carasDeVertice: number[][] = Array.from({ length: nCeldas }, () => []);
  for (let i = 0; i < carasActuales.length; i++) {
    for (const v of carasActuales[i]!) carasDeVertice[v!]!.push(i);
  }

  // El centro de cada cara será una esquina de las celdas que la rodean.
  const centrosDeCara = new Float32Array(carasActuales.length * 3);
  for (let i = 0; i < carasActuales.length; i++) {
    const [a, b, c] = carasActuales[i]!;
    const va = vertices[a!]!;
    const vb = vertices[b!]!;
    const vc = vertices[c!]!;
    const p = normalizar([
      (va[0]! + vb[0]! + vc[0]!) / 3,
      (va[1]! + vb[1]! + vc[1]!) / 3,
      (va[2]! + vb[2]! + vc[2]!) / 3,
    ]);
    centrosDeCara[i * 3] = p[0]!;
    centrosDeCara[i * 3 + 1] = p[1]!;
    centrosDeCara[i * 3 + 2] = p[2]!;
  }

  const centro = new Float32Array(nCeldas * 3);
  const vecinos = new Int32Array(nCeldas * MAX_VECINOS).fill(-1);
  const nVecinos = new Uint8Array(nCeldas);
  const esquinas = new Float32Array(nCeldas * MAX_VECINOS * 3);

  for (let celda = 0; celda < nCeldas; celda++) {
    const n = vertices[celda]!;
    centro[celda * 3] = n[0]!;
    centro[celda * 3 + 1] = n[1]!;
    centro[celda * 3 + 2] = n[2]!;

    // Base local para poder hablar de "ángulo alrededor de esta celda".
    // Se elige el eje menos alineado con la normal para que el resultado sea
    // estable, y así u × w apunta hacia fuera del planeta.
    const ax = n[0]! < 0 ? -n[0]! : n[0]!;
    const ay = n[1]! < 0 ? -n[1]! : n[1]!;
    const az = n[2]! < 0 ? -n[2]! : n[2]!;
    const eje = ax < ay ? (ax < az ? [1, 0, 0] : [0, 0, 1]) : ay < az ? [0, 1, 0] : [0, 0, 1];
    const u = normalizar([
      eje[1]! * n[2]! - eje[2]! * n[1]!,
      eje[2]! * n[0]! - eje[0]! * n[2]!,
      eje[0]! * n[1]! - eje[1]! * n[0]!,
    ]);
    const w = [
      n[1]! * u[2]! - n[2]! * u[1]!,
      n[2]! * u[0]! - n[0]! * u[2]!,
      n[0]! * u[1]! - n[1]! * u[0]!,
    ];

    // Las caras que rodean a esta celda, ordenadas para que el polígono no
    // salga hecho un lazo.
    const misCaras = carasDeVertice[celda]!;
    const ordenadas = misCaras
      .map((cara) => {
        const dx = centrosDeCara[cara * 3]! - n[0]!;
        const dy = centrosDeCara[cara * 3 + 1]! - n[1]!;
        const dz = centrosDeCara[cara * 3 + 2]! - n[2]!;
        return {
          cara,
          orden: ordenAngular(
            dx * u[0]! + dy * u[1]! + dz * u[2]!,
            dx * w[0]! + dy * w[1]! + dz * w[2]!,
          ),
        };
      })
      .sort((a, b) => a.orden - b.orden || a.cara - b.cara);

    for (let k = 0; k < ordenadas.length; k++) {
      const cara = ordenadas[k]!.cara;
      esquinas[(celda * MAX_VECINOS + k) * 3] = centrosDeCara[cara * 3]!;
      esquinas[(celda * MAX_VECINOS + k) * 3 + 1] = centrosDeCara[cara * 3 + 1]!;
      esquinas[(celda * MAX_VECINOS + k) * 3 + 2] = centrosDeCara[cara * 3 + 2]!;
    }

    // Los vecinos son las celdas con las que comparte arista, en el mismo orden
    // angular que las esquinas.
    const vistos: number[] = [];
    for (const { cara } of ordenadas) {
      for (const v of carasActuales[cara]!) {
        if (v !== celda && !vistos.includes(v!)) vistos.push(v!);
      }
    }
    nVecinos[celda] = vistos.length;
    for (let k = 0; k < vistos.length; k++) vecinos[celda * MAX_VECINOS + k] = vistos[k]!;
  }

  return { nCeldas, centro, vecinos, nVecinos, esquinas };
}

/** Cuántas celdas tendrá un planeta de este nivel, sin construirlo. */
export function celdasDelNivel(nivel: number): number {
  return 10 * 4 ** nivel + 2;
}
