/**
 * Generador de azar sembrado y serializable.
 *
 * Algoritmo sfc32: cuatro enteros de 32 bits de estado, solo operaciones
 * enteras. No usa coma flotante en su ciclo interno, así que da exactamente la
 * misma secuencia en cualquier motor de JavaScript.
 *
 * `Math.random()` está prohibido en `src/sim/` y el test de ausencia de guion
 * lo comprueba: sin semilla no hay determinismo, y sin determinismo no se puede
 * volver a visitar un mundo ni compartirlo.
 */

/** Estado del generador: cuatro enteros sin signo de 32 bits. */
export type EstadoRng = Uint32Array;

/** Cantidad de enteros de 32 bits que ocupa el estado al serializarlo. */
export const RNG_PALABRAS = 4;

/**
 * Mezclador de semilla (splitmix32). Convierte un entero cualquiera en una
 * secuencia de estados iniciales bien dispersos, para que semillas parecidas
 * (1, 2, 3) den mundos completamente distintos.
 */
function mezclar(semilla: number): () => number {
  let z = semilla | 0;
  return () => {
    z = (z + 0x9e3779b9) | 0;
    let t = z ^ (z >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

/** Crea un estado a partir de una semilla entera. */
export function crearRng(semilla: number): EstadoRng {
  const siguiente = mezclar(semilla);
  const s = new Uint32Array(RNG_PALABRAS);
  s[0] = siguiente();
  s[1] = siguiente();
  s[2] = siguiente();
  s[3] = siguiente();
  // Se descartan las primeras salidas para que el estado quede bien revuelto.
  for (let i = 0; i < 12; i++) siguienteU32(s);
  return s;
}

/** Copia independiente de un estado. Útil para bifurcar sin contaminar. */
export function clonarRng(s: EstadoRng): EstadoRng {
  return new Uint32Array(s);
}

/**
 * Siguiente entero sin signo de 32 bits. Es la única fuente de azar del
 * proyecto; todo lo demás se deriva de acá.
 */
export function siguienteU32(s: EstadoRng): number {
  const t = ((s[0]! + s[1]!) | 0) + s[3]! | 0;
  s[3] = (s[3]! + 1) | 0;
  s[0] = s[1]! ^ (s[1]! >>> 9);
  s[1] = (s[2]! + (s[2]! << 3)) | 0;
  s[2] = (s[2]! << 21) | (s[2]! >>> 11);
  s[2] = (s[2]! + t) | 0;
  return t >>> 0;
}

/**
 * Decimal en [0, 1). Se construye dividiendo por 2^32, que es una división
 * exacta en IEEE-754 y por lo tanto igual en todos los motores.
 */
export function siguienteDecimal(s: EstadoRng): number {
  return siguienteU32(s) / 4294967296;
}

/**
 * Entero en [0, n). Usa rechazo para que el reparto sea exactamente uniforme:
 * el resto simple sesgaría los primeros valores.
 */
export function siguienteEntero(s: EstadoRng, n: number): number {
  if (n <= 0) return 0;
  const limite = 4294967296 - (4294967296 % n);
  let v = siguienteU32(s);
  while (v >= limite) v = siguienteU32(s);
  return v % n;
}
