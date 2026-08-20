/**
 * Matemática determinista.
 *
 * `Math.exp`, `Math.log`, `Math.sin`, `Math.pow` y compañía NO están
 * especificadas bit a bit por el estándar de JavaScript: cada motor puede
 * devolver un último bit distinto. En un sistema caótico corriendo millones de
 * ticks, un bit de diferencia termina siendo un mundo distinto, y la semilla
 * compartible dejaría de funcionar entre dos teléfonos.
 *
 * Por eso acá van implementaciones propias, construidas solo con sumas, restas,
 * multiplicaciones, divisiones y manipulación directa de bits, que sí son
 * exactas e idénticas en todos los motores por IEEE-754.
 *
 * `Math.abs`, `floor`, `ceil`, `round`, `trunc`, `sign`, `min`, `max`, `imul`,
 * `sqrt`, `fround` y `clz32` sí están especificadas exactamente y se pueden
 * usar. El test de ausencia de guion comprueba que las demás no aparezcan en
 * `src/sim/`.
 *
 * Este archivo y `constants.ts` son los dos únicos donde se permiten literales
 * decimales: acá son coeficientes de polinomios, no parámetros del mundo.
 */

const bits = new DataView(new ArrayBuffer(8));

/** Logaritmo natural de 2, partido en dos mitades para no perder precisión. */
const LN2_ALTO = 6.93147180369123816490e-1;
const LN2_BAJO = 1.90821492927058770002e-10;
/** 1 / ln(2). */
const LOG2E = 1.44269504088896340736;

/** π/2 partido en dos mitades, para la reducción de ángulo. */
const PIO2_ALTO = 1.5707963267341256;
const PIO2_BAJO = 6.077100506506192e-11;
/** 2/π. */
const DOS_SOBRE_PI = 0.6366197723675814;

/** Dos veces π, para trabajar en vueltas. */
export const TAU = 6.283185307179586;

/**
 * 2^k exacto, construido escribiendo el exponente directamente en los bits del
 * número. No usa `Math.pow`, así que es idéntico en todos los motores.
 */
function potenciaDeDos(k: number): number {
  if (k > 1023) return Infinity;
  if (k < -1022) {
    if (k < -1074) return 0;
    return potenciaDeDos(k + 100) * potenciaDeDos(-100);
  }
  bits.setUint32(0, (k + 1023) << 20);
  bits.setUint32(4, 0);
  return bits.getFloat64(0);
}

/**
 * Exponencial. Se reduce el argumento a un rango chico alrededor de cero
 * (x = k·ln2 + r) y ahí se evalúa un polinomio de Taylor de grado once.
 *
 * Con grado nueve el error relativo se quedaba en 3e-12, que para una activación
 * de red neuronal sobraría, pero esta función se llama millones de veces por tick
 * y el error se acumula. Dos términos más lo bajan a 1e-14 y cuestan dos
 * multiplicaciones.
 */
export function dExp(x: number): number {
  if (x !== x) return NaN;
  if (x > 709.782712893384) return Infinity;
  if (x < -745.1332191019411) return 0;

  const k = Math.round(x * LOG2E);
  const r = x - k * LN2_ALTO - k * LN2_BAJO;

  const p =
    1 +
    r *
      (1 +
        r *
          (0.5 +
            r *
              (1.6666666666666666e-1 +
                r *
                  (4.1666666666666664e-2 +
                    r *
                      (8.333333333333333e-3 +
                        r *
                          (1.388888888888889e-3 +
                            r *
                              (1.984126984126984e-4 +
                                r *
                                  (2.48015873015873e-5 +
                                    r *
                                      (2.7557319223985893e-6 +
                                        r *
                                          (2.7557319223985893e-7 +
                                            r * 2.505210838544172e-8))))))))));

  return potenciaDeDos(k) * p;
}

/**
 * Logaritmo natural. Se separa el número en exponente y mantisa leyendo sus
 * bits, y la mantisa (que queda cerca de 1) se resuelve con la serie de la
 * tangente hiperbólica inversa, que converge muy rápido ahí.
 */
export function dLog(x: number): number {
  if (x !== x) return NaN;
  if (x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;

  let ajuste = 0;
  let v = x;
  // Los números subnormales no tienen exponente utilizable: se escalan primero.
  if (v < 2.2250738585072014e-308) {
    v *= 18014398509481984; // 2^54
    ajuste = -54;
  }

  bits.setFloat64(0, v);
  const alto = bits.getUint32(0);
  let e = ((alto >>> 20) & 0x7ff) - 1023 + ajuste;

  bits.setUint32(0, (alto & 0x000fffff) | (1023 << 20));
  let m = bits.getFloat64(0); // mantisa en [1, 2)

  // Centrar la mantisa alrededor de 1 mejora mucho la convergencia.
  if (m > 1.4142135623730951) {
    m *= 0.5;
    e += 1;
  }

  const f = m - 1;
  const s = f / (2 + f);
  const s2 = s * s;
  const serie =
    s *
    (2 +
      s2 *
        (6.666666666666667e-1 +
          s2 *
            (4e-1 +
              s2 *
                (2.857142857142857e-1 +
                  s2 *
                    (2.2222222222222221e-1 +
                      s2 *
                        (1.8181818181818182e-1 +
                          s2 * (1.5384615384615385e-1 + s2 * 1.3333333333333333e-1)))))));

  return e * LN2_ALTO + (e * LN2_BAJO + serie);
}

/**
 * Tangente hiperbólica. Es la función de activación de los cerebros, así que se
 * llama millones de veces por tick y tiene que ser idéntica en todos lados.
 */
export function dTanh(x: number): number {
  if (x !== x) return NaN;
  const ax = x < 0 ? -x : x;
  // Por encima de 20 la diferencia con 1 ya no cabe en un decimal de 64 bits.
  if (ax > 20) return x < 0 ? -1 : 1;
  // Cerca de cero la fórmula general daría 0/0; la recta es exacta ahí.
  if (ax < 1e-8) return x;
  const e = dExp(-2 * ax);
  const t = (1 - e) / (1 + e);
  return x < 0 ? -t : t;
}

/** Sigmoide logística, derivada de la tangente hiperbólica para no repetir código. */
export function dSigmoide(x: number): number {
  return 0.5 + 0.5 * dTanh(0.5 * x);
}

/** Elevar a una potencia cualquiera, sin `Math.pow`. */
export function dPow(base: number, exponente: number): number {
  if (exponente === 0) return 1;
  if (base === 0) return exponente > 0 ? 0 : Infinity;
  if (base < 0) return NaN;
  return dExp(exponente * dLog(base));
}

/** Seno de r con |r| <= π/4, por Taylor de grado once. */
function senoChico(r: number): number {
  const r2 = r * r;
  return (
    r *
    (1 +
      r2 *
        (-1.6666666666666666e-1 +
          r2 *
            (8.333333333333333e-3 +
              r2 * (-1.984126984126984e-4 + r2 * (2.7557319223985893e-6 - r2 * 2.505210838544172e-8)))))
  );
}

/** Coseno de r con |r| <= π/4, por Taylor de grado diez. */
function cosenoChico(r: number): number {
  const r2 = r * r;
  return (
    1 +
    r2 *
      (-0.5 +
        r2 *
          (4.1666666666666664e-2 +
            r2 * (-1.3888888888888889e-3 + r2 * (2.48015873015873e-5 - r2 * 2.755731922398589e-7))))
  );
}

/**
 * Seno y coseno a la vez. Se reduce el ángulo a un cuarto de vuelta y se elige
 * el polinomio según el cuadrante.
 *
 * La reducción pierde precisión con ángulos enormes; en este proyecto solo se
 * usan para el ciclo día/noche y las estaciones, donde el argumento se mantiene
 * chico. Para eso está `senoDeVuelta`, que trabaja en vueltas y nunca crece.
 */
export function dSenoCoseno(x: number): [seno: number, coseno: number] {
  if (x !== x || x === Infinity || x === -Infinity) return [NaN, NaN];

  const k = Math.round(x * DOS_SOBRE_PI);
  const r = x - k * PIO2_ALTO - k * PIO2_BAJO;
  const s = senoChico(r);
  const c = cosenoChico(r);

  switch (k & 3) {
    case 0:
      return [s, c];
    case 1:
      return [c, -s];
    case 2:
      return [-s, -c];
    default:
      return [-c, s];
  }
}

export function dSeno(x: number): number {
  return dSenoCoseno(x)[0];
}

export function dCoseno(x: number): number {
  return dSenoCoseno(x)[1];
}

/**
 * Seno de una fracción de vuelta: `fase` en vueltas, no en radianes.
 *
 * Es la forma correcta de escribir ciclos que corren para siempre (el día, el
 * año): la fase se envuelve entre 0 y 1 y nunca crece, así que la precisión no
 * se degrada por muchos millones de ticks que pasen.
 */
export function senoDeVuelta(fase: number): number {
  const f = fase - Math.floor(fase);
  return dSenoCoseno(f * TAU)[0];
}

/** Coseno de una fracción de vuelta. Ver `senoDeVuelta`. */
export function cosenoDeVuelta(fase: number): number {
  const f = fase - Math.floor(fase);
  return dSenoCoseno(f * TAU)[1];
}

/** Raíz cuadrada. `Math.sqrt` sí está especificada exactamente por IEEE-754. */
export const dRaiz = Math.sqrt;

/** Acota un valor entre un mínimo y un máximo. */
export function acotar(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
