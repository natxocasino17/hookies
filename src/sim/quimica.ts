/**
 * La química.
 *
 * Tres reglas de reescritura y nada más: **unir**, **partir** y **sustituir**.
 * Ninguna sabe de sustancias concretas — operan sobre cadenas cualesquiera — y
 * toda la variedad del mundo sale del espacio de cadenas, no de una tabla.
 *
 * Lo que tiene que emerger de aquí, o no emergerá nunca: que alguna molécula
 * acabe catalizando la reacción que la produce a ella misma, o que un grupo de
 * moléculas se catalicen en círculo. Eso es un ciclo autocatalítico, y eso es un
 * microbio. No está implementado como entidad: se detecta después, mirando qué
 * reacciones ocurrieron de verdad.
 *
 * ── Sobre el rendimiento ────────────────────────────────────────────────────
 * No se prueban todas las parejas posibles. Con 24 moléculas por celda serían
 * 576 parejas por cada catalizador candidato: 35 millones de comprobaciones por
 * tick en el planeta entero, imposible. En vez de eso se tiran unos pocos dados
 * por celda y las moléculas más abundantes salen más a menudo — que es lo mismo
 * que pasa en la química de verdad, donde las reacciones ocurren cuando dos
 * cosas se chocan y se chocan más las que abundan.
 */

import {
  ATOMOS_INICIALES_POR_TIPO,
  DIFUSION_QUIMICA_DIVISOR,
  EMPUJE_DEL_CATALIZADOR,
  DEBILIDAD_POR_DESAJUSTE,
  ENERGIA_ENLACE_ATOMO,
  ESTABILIDAD_ATOMO,
  INTENTOS_DE_REACCION,
  LOTES_DE_QUIMICA,
  N_DIMEROS,
  MAX_VECINOS,
  N_TIPOS_ATOMO,
  PENALIZACION_POR_DESAJUSTE,
  ROTURA_POR_TEMPERATURA,
  TOLERANCIA_DEL_CATALIZADOR,
  SUSTITUCION_POR_MIL,
  TOP_N_MOLECULAS,
  UNION_POR_MIL,
} from './constants.js';
import type { EstadoMundo } from './estado.js';
import type { Geometria } from './geodesica.js';
import { siguienteEntero } from './rng.js';
import {
  atomoEn,
  atomoSuelto,
  desajuste,
  dimeroDelIndice,
  indiceDeDimero,
  longitud,
  MOLECULA_VACIA,
  prefijo,
  primerAtomo,
  sufijo,
  sustituir,
  ultimoAtomo,
  unir,
  type Molecula,
} from './molecula.js';

/** Catalizadores que se miran en cada intento. Todos serían demasiado caros. */
const CANDIDATOS_A_CATALIZADOR = 4;

// ---------------------------------------------------------------------------
// La sopa de una celda
// ---------------------------------------------------------------------------

/** Cuántos dímeros de un tipo hay en una celda. */
function dimeros(estado: EstadoMundo, celda: number, indice: number): number {
  return estado.dimeros[celda * N_DIMEROS + indice]!;
}

function cambiarDimeros(estado: EstadoMundo, celda: number, indice: number, delta: number): void {
  const i = celda * N_DIMEROS + indice;
  estado.dimeros[i] = estado.dimeros[i]! + delta;
}

/** Átomos sueltos de un tipo en una celda. */
function libres(estado: EstadoMundo, celda: number, tipo: number): number {
  return estado.atomosLibres[celda * N_TIPOS_ATOMO + tipo]!;
}

function cambiarLibres(estado: EstadoMundo, celda: number, tipo: number, delta: number): void {
  const i = celda * N_TIPOS_ATOMO + tipo;
  estado.atomosLibres[i] = estado.atomosLibres[i]! + delta;
}

/** Dónde está guardada esta molécula en la celda, o -1 si no está. */
function ranuraDe(estado: EstadoMundo, celda: number, m: Molecula): number {
  const base = celda * TOP_N_MOLECULAS;
  for (let k = 0; k < TOP_N_MOLECULAS; k++) {
    if (estado.sopaMolecula[base + k] === m) return k;
  }
  return -1;
}

/**
 * Mete moléculas en la celda.
 *
 * Si no hay sitio, la menos abundante se desmonta en átomos sueltos. Eso NO es
 * un pozo sin retorno: los átomos vuelven a la sopa y pueden volver a formar
 * cadenas. Es importante que sea así — una molécula nueva es rara antes de ser
 * abundante, y si perderla fuera definitivo, el propio recorte de rendimiento
 * estaría matando justo lo que la fase 2 tiene que detectar (RIESGOS §2b).
 */
function anadir(estado: EstadoMundo, celda: number, m: Molecula, cuantas: number): void {
  if (m === MOLECULA_VACIA || cuantas <= 0) return;
  const largo = longitud(m);

  // Los átomos sueltos y los dímeros tienen su propio cajón: no compiten por
  // las ranuras del top-N. Son pocos y conocidos de antemano —seis y treinta y
  // seis— así que caben todos sin filtro.
  if (largo === 1) {
    cambiarLibres(estado, celda, primerAtomo(m), cuantas);
    return;
  }
  if (largo === 2) {
    cambiarDimeros(estado, celda, indiceDeDimero(atomoEn(m, 0), atomoEn(m, 1)), cuantas);
    return;
  }

  const base = celda * TOP_N_MOLECULAS;
  const ranura = ranuraDe(estado, celda, m);
  if (ranura >= 0) {
    estado.sopaCantidad[base + ranura] = estado.sopaCantidad[base + ranura]! + cuantas;
    return;
  }

  // Buscar un hueco, o si no la más floja para desalojarla.
  let mejor = -1;
  let menorCantidad = Infinity;
  for (let k = 0; k < TOP_N_MOLECULAS; k++) {
    if (estado.sopaMolecula[base + k] === MOLECULA_VACIA) {
      mejor = k;
      menorCantidad = -1;
      break;
    }
    if (estado.sopaCantidad[base + k]! < menorCantidad) {
      menorCantidad = estado.sopaCantidad[base + k]!;
      mejor = k;
    }
  }
  if (mejor < 0) return;

  if (menorCantidad >= 0) {
    // Desmontar la desalojada en sus átomos. Ni uno se pierde.
    const vieja = estado.sopaMolecula[base + mejor]!;
    const cuantasViejas = estado.sopaCantidad[base + mejor]!;
    for (let i = 0; i < longitud(vieja); i++) {
      cambiarLibres(estado, celda, atomoEn(vieja, i), cuantasViejas);
    }
  }
  estado.sopaMolecula[base + mejor] = m;
  estado.sopaCantidad[base + mejor] = cuantas;
}

/** Saca moléculas de una celda. Devuelve si había suficientes. */
function quitar(estado: EstadoMundo, celda: number, m: Molecula, cuantas: number): boolean {
  const largo = longitud(m);
  if (largo === 1) {
    const tipo = primerAtomo(m);
    if (libres(estado, celda, tipo) < cuantas) return false;
    cambiarLibres(estado, celda, tipo, -cuantas);
    return true;
  }
  if (largo === 2) {
    const indice = indiceDeDimero(atomoEn(m, 0), atomoEn(m, 1));
    if (dimeros(estado, celda, indice) < cuantas) return false;
    cambiarDimeros(estado, celda, indice, -cuantas);
    return true;
  }
  const base = celda * TOP_N_MOLECULAS;
  const ranura = ranuraDe(estado, celda, m);
  if (ranura < 0 || estado.sopaCantidad[base + ranura]! < cuantas) return false;
  estado.sopaCantidad[base + ranura] = estado.sopaCantidad[base + ranura]! - cuantas;
  if (estado.sopaCantidad[base + ranura]! === 0) {
    estado.sopaMolecula[base + ranura] = MOLECULA_VACIA;
  }
  return true;
}

/**
 * Elige una molécula de la celda al azar, con las abundantes saliendo más.
 * Los átomos sueltos cuentan como moléculas de un solo átomo.
 */
function elegirReactivo(estado: EstadoMundo, celda: number): Molecula {
  let total = 0;
  for (let t = 0; t < N_TIPOS_ATOMO; t++) total += libres(estado, celda, t);
  for (let d = 0; d < N_DIMEROS; d++) total += dimeros(estado, celda, d);
  const base = celda * TOP_N_MOLECULAS;
  for (let k = 0; k < TOP_N_MOLECULAS; k++) total += estado.sopaCantidad[base + k]!;
  if (total <= 0) return MOLECULA_VACIA;

  let dado = siguienteEntero(estado.rng, total);
  for (let t = 0; t < N_TIPOS_ATOMO; t++) {
    dado -= libres(estado, celda, t);
    if (dado < 0) return atomoSuelto(t);
  }
  for (let d = 0; d < N_DIMEROS; d++) {
    dado -= dimeros(estado, celda, d);
    if (dado < 0) return dimeroDelIndice(d);
  }
  for (let k = 0; k < TOP_N_MOLECULAS; k++) {
    dado -= estado.sopaCantidad[base + k]!;
    if (dado < 0) return estado.sopaMolecula[base + k]!;
  }
  return MOLECULA_VACIA;
}

// ---------------------------------------------------------------------------
// La regla de catálisis — la que decide si esta fase sale o no
// ---------------------------------------------------------------------------

/**
 * ¿Hay en esta celda alguna molécula que catalice unir un átomo `a` con uno `b`?
 *
 * La regla, única y sin catálogo: **una cadena cataliza un enlace cuando lleva
 * dentro, en dos posiciones seguidas, los complementos de los dos átomos que se
 * van a unir.** O sea, hace de plantilla: sujeta las dos piezas en su sitio
 * mientras se pegan. Es exactamente lo que hace una enzima.
 *
 * Sin una regla así no habría catálisis en absoluto — ninguna molécula influiría
 * en una reacción en la que no participa — y sin catálisis no puede haber
 * autocatálisis, que es lo único que la fase 2 busca (RIESGOS §2a).
 *
 * Y fíjese en lo que NO dice: no dice qué molécula cataliza qué. Eso sale de las
 * cadenas que hayan aparecido, y puede que la que se cataliza a sí misma no
 * aparezca nunca.
 */
function hayCatalizador(estado: EstadoMundo, celda: number, a: number, b: number): boolean {
  // Un dímero tiene exactamente un enlace, así que también puede ser plantilla.
  // Y hay solo 36, así que se pueden mirar todos sin que cueste nada.
  for (let d = 0; d < N_DIMEROS; d++) {
    if (dimeros(estado, celda, d) <= 0) continue;
    const m = dimeroDelIndice(d);
    if (
      desajuste(atomoEn(m, 0), a) <= TOLERANCIA_DEL_CATALIZADOR &&
      desajuste(atomoEn(m, 1), b) <= TOLERANCIA_DEL_CATALIZADOR
    ) {
      return true;
    }
  }

  const base = celda * TOP_N_MOLECULAS;
  for (let intento = 0; intento < CANDIDATOS_A_CATALIZADOR; intento++) {
    const k = siguienteEntero(estado.rng, TOP_N_MOLECULAS);
    const c = estado.sopaMolecula[base + k]!;
    if (c === MOLECULA_VACIA || estado.sopaCantidad[base + k]! <= 0) continue;

    const largo = longitud(c);
    for (let i = 0; i + 1 < largo; i++) {
      if (
        desajuste(atomoEn(c, i), a) <= TOLERANCIA_DEL_CATALIZADOR &&
        desajuste(atomoEn(c, i + 1), b) <= TOLERANCIA_DEL_CATALIZADOR
      ) {
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Las tres reglas de reescritura
// ---------------------------------------------------------------------------

/** Reparte las moléculas entre celdas vecinas. */
function difundir(estado: EstadoMundo, geo: Geometria, alReves: boolean): void {
  const primera = alReves ? geo.nCeldas - 1 : 0;
  const paso = alReves ? -1 : 1;

  for (let n = 0; n < geo.nCeldas; n++) {
    const i = primera + n * paso;
    for (let k = 0; k < geo.nVecinos[i]!; k++) {
      const j = geo.vecinos[i * MAX_VECINOS + k]!;
      if (j <= i) continue;

      // Átomos sueltos.
      for (let t = 0; t < N_TIPOS_ATOMO; t++) {
        const flujo = ((libres(estado, i, t) - libres(estado, j, t)) / DIFUSION_QUIMICA_DIVISOR) | 0;
        if (flujo === 0) continue;
        cambiarLibres(estado, i, t, -flujo);
        cambiarLibres(estado, j, t, flujo);
      }

      // Dímeros.
      for (let d = 0; d < N_DIMEROS; d++) {
        const flujo = ((dimeros(estado, i, d) - dimeros(estado, j, d)) / DIFUSION_QUIMICA_DIVISOR) | 0;
        if (flujo === 0) continue;
        cambiarDimeros(estado, i, d, -flujo);
        cambiarDimeros(estado, j, d, flujo);
      }

      // Moléculas: solo se mueve lo que la celda de destino ya sabe alojar o
      // puede alojar. Lo que no cabe se queda donde está.
      const base = i * TOP_N_MOLECULAS;
      for (let r = 0; r < TOP_N_MOLECULAS; r++) {
        const m = estado.sopaMolecula[base + r]!;
        if (m === MOLECULA_VACIA) continue;
        const flujo = (estado.sopaCantidad[base + r]! / DIFUSION_QUIMICA_DIVISOR) | 0;
        if (flujo <= 0) continue;
        if (!quitar(estado, i, m, flujo)) continue;
        anadir(estado, j, m, flujo);
      }
    }
  }
}

/** Un tick de química en una celda. */
function reaccionarEnCelda(estado: EstadoMundo, celda: number): void {
  const temperatura = estado.temperatura[celda]!;

  for (let intento = 0; intento < INTENTOS_DE_REACCION; intento++) {
    const dado = siguienteEntero(estado.rng, 1000);

    // --- PARTIR: el calor rompe enlaces --------------------------------------
    // Es lo que impide que la sopa se quede quieta: sin nada que rompa, todo
    // acabaría pegado en cadenas largas y el mundo se pararía.
    const a = elegirReactivo(estado, celda);
    if (a === MOLECULA_VACIA) continue;
    const largoA = longitud(a);

    if (largoA >= 2) {
      const corte = 1 + siguienteEntero(estado.rng, largoA - 1);
      const izquierda = atomoEn(a, corte - 1);
      const derecha = atomoEn(a, corte);
      // Un enlace mal emparejado aguanta menos: se rompe antes.
      const malencaje = desajuste(izquierda, derecha);
      const aguante =
        (ESTABILIDAD_ATOMO[izquierda]! + ESTABILIDAD_ATOMO[derecha]!) /
        (1 + malencaje * DEBILIDAD_POR_DESAJUSTE);
      const empujeTermico = temperatura > 0 ? temperatura * ROTURA_POR_TEMPERATURA : 0;
      const probabilidad = (empujeTermico / aguante) * 1000;

      if (dado < probabilidad) {
        if (quitar(estado, celda, a, 1)) {
          anadir(estado, celda, prefijo(a, corte), 1);
          anadir(estado, celda, sufijo(a, corte), 1);
          // Romper cuesta energía: la saca de la celda, o sea la enfría.
          const coste = ENERGIA_ENLACE_ATOMO[izquierda]! + ENERGIA_ENLACE_ATOMO[derecha]!;
          estado.temperatura[celda] = estado.temperatura[celda]! - coste * estado.escalaEnergiaQuimica;
        }
        continue;
      }
    }

    // --- SUSTITUIR: un átomo suelto desplaza a otro de la cadena --------------
    if (dado < SUSTITUCION_POR_MIL && largoA >= 2) {
      const entra = siguienteEntero(estado.rng, N_TIPOS_ATOMO);
      if (libres(estado, celda, entra) > 0) {
        const posicion = siguienteEntero(estado.rng, largoA);
        const sale = atomoEn(a, posicion);
        if (sale !== entra && quitar(estado, celda, a, 1)) {
          cambiarLibres(estado, celda, entra, -1);
          cambiarLibres(estado, celda, sale, 1);
          anadir(estado, celda, sustituir(a, posicion, entra), 1);
        }
      }
      continue;
    }

    // --- UNIR: dos cadenas se pegan si sus extremos encajan -------------------
    const b = elegirReactivo(estado, celda);
    if (b === MOLECULA_VACIA) continue;

    const cola = ultimoAtomo(a);
    const cabeza = primerAtomo(b);

    const producto = unir(a, b);
    if (producto === MOLECULA_VACIA) continue; // se pasaría del largo máximo

    // Ya no hay puerta de "encaja o no encaja": encajar es cuestión de grado.
    // La pareja perfecta se une fácil y las demás cada vez menos, pero ninguna
    // es imposible — y de ahí sale que el mundo pueda explorar el espacio de
    // cadenas en vez de cristalizar siempre en las mismas alternas.
    const malencaje = desajuste(cola, cabeza);
    const facilidad = 1 / (1 + malencaje * malencaje * PENALIZACION_POR_DESAJUSTE);
    const empuje = hayCatalizador(estado, celda, cola, cabeza) ? EMPUJE_DEL_CATALIZADOR : 1;
    if (siguienteEntero(estado.rng, 1000) >= UNION_POR_MIL * empuje * facilidad) continue;

    // Hay que sacar los dos reactivos antes de meter el producto, y si el
    // segundo falla hay que devolver el primero: si no, se perderían átomos.
    if (!quitar(estado, celda, a, 1)) continue;
    if (!quitar(estado, celda, b, 1)) {
      anadir(estado, celda, a, 1);
      continue;
    }
    anadir(estado, celda, producto, 1);

    // Formar un enlace suelta energía: calienta la celda.
    // Un enlace flojo suelta menos energía que uno bien hecho.
    const suelta = (ENERGIA_ENLACE_ATOMO[cola]! + ENERGIA_ENLACE_ATOMO[cabeza]!) * facilidad;
    estado.temperatura[celda] = estado.temperatura[celda]! + suelta * estado.escalaEnergiaQuimica;

    estado.reaccionesEsteTick++;
  }
}

/**
 * Un tick de química.
 *
 * Solo reacciona una celda de cada LOTES_DE_QUIMICA, y cuál toca depende del
 * número de tick — nunca de la cámara, del framerate ni de si hay alguien
 * mirando. Es un recorte a la química para dejarle sitio a los bichos, tal y
 * como manda CLAUDE.md §2.4, y está en el archivo de constantes para que se vea.
 */
export function avanzarLaQuimica(estado: EstadoMundo, geo: Geometria, alReves: boolean): void {
  estado.reaccionesEsteTick = 0;
  const turno = estado.tick % LOTES_DE_QUIMICA;
  for (let celda = turno; celda < geo.nCeldas; celda += LOTES_DE_QUIMICA) {
    reaccionarEnCelda(estado, celda);
  }
  difundir(estado, geo, alReves);
}

/** Reparte los primeros átomos por el mundo. */
export function sembrarLaSopa(estado: EstadoMundo): void {
  for (let celda = 0; celda < estado.nCeldas; celda++) {
    for (let t = 0; t < N_TIPOS_ATOMO; t++) {
      estado.atomosLibres[celda * N_TIPOS_ATOMO + t] = ATOMOS_INICIALES_POR_TIPO;
    }
  }
}

/** Átomos que hay en una celda, sueltos o dentro de moléculas. */
export function atomosEnCelda(estado: EstadoMundo, celda: number): number {
  let total = 0;
  for (let t = 0; t < N_TIPOS_ATOMO; t++) total += libres(estado, celda, t);
  for (let d = 0; d < N_DIMEROS; d++) total += dimeros(estado, celda, d) * 2;
  const base = celda * TOP_N_MOLECULAS;
  for (let k = 0; k < TOP_N_MOLECULAS; k++) {
    const m = estado.sopaMolecula[base + k]!;
    if (m !== MOLECULA_VACIA) total += estado.sopaCantidad[base + k]! * longitud(m);
  }
  return total;
}

/** Átomos de todo el planeta. El test de masa exige que no cambie jamás. */
export function atomosTotales(estado: EstadoMundo): number {
  let total = 0;
  for (let c = 0; c < estado.nCeldas; c++) total += atomosEnCelda(estado, c);
  return total;
}

/** Cuántas moléculas distintas hay vivas en el planeta, y cómo de largas. */
export function censoDeMoleculas(estado: EstadoMundo): {
  distintas: number;
  longitudMedia: number;
} {
  const vistas = new Set<number>();
  let sumaLargos = 0;
  let cuantas = 0;
  for (let c = 0; c < estado.nCeldas; c++) {
    for (let d = 0; d < N_DIMEROS; d++) {
      const cuantos = dimeros(estado, c, d);
      if (cuantos <= 0) continue;
      vistas.add(dimeroDelIndice(d));
      sumaLargos += 2 * cuantos;
      cuantas += cuantos;
    }
    const base = c * TOP_N_MOLECULAS;
    for (let k = 0; k < TOP_N_MOLECULAS; k++) {
      const m = estado.sopaMolecula[base + k]!;
      if (m === MOLECULA_VACIA || estado.sopaCantidad[base + k]! <= 0) continue;
      vistas.add(m);
      sumaLargos += longitud(m) * estado.sopaCantidad[base + k]!;
      cuantas += estado.sopaCantidad[base + k]!;
    }
  }
  return {
    distintas: vistas.size,
    longitudMedia: cuantas > 0 ? sumaLargos / cuantas : 0,
  };
}
