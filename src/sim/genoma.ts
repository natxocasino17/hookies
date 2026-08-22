/**
 * El genoma, y cómo se lee.
 *
 * Un genoma es una cadena larguísima de átomos — miles — de la misma química
 * que todo lo demás (decisión D2). No es una estructura con campos: es una
 * secuencia, y los rasgos del cuerpo salen de leerla por trozos.
 *
 * Por qué una cadena larga y no las de doce átomos de la sopa: en doce átomos
 * caben 31 bits de información, y de ahí tienen que salir once rasgos del cuerpo
 * **más los miles de pesos del cerebro** que llegan en la fase 4. No entra por
 * tres órdenes de magnitud. Con el genoma largo, un átomo es un peso, y la
 * mutación sigue siendo lo que tiene que ser: **una errata al copiar la propia
 * química**, pequeña y local (RIESGOS §3).
 *
 * Cada rasgo se lee promediando una ventana ancha de átomos. Eso importa: una
 * errata sola apenas mueve el rasgo, hacen falta varias. Así el cuerpo cambia
 * despacio a lo largo de generaciones en vez de pegar saltos, que es lo que
 * permite que la selección acumule algo.
 */

import {
  ERRATA_POR_DIEZ_MIL,
  LARGO_DE_TRAMO,
  MAX_CADENA_GENOMA,
  N_TIPOS_ATOMO,
  VENTANA_DE_RASGO,
  VENTANA_DE_TINTE,
} from './constants.js';
import { siguienteEntero } from './rng.js';
import type { EstadoRng } from './rng.js';

/**
 * Los rasgos que salen del genoma.
 *
 * No es una lista de tipos de bicho ni una tabla de especies: son las perillas
 * que tiene cualquier cuerpo, y cada linaje lleva las suyas. Una especie será,
 * a posteriori, un montón de genomas parecidos.
 */
export const RASGO_TAMANO = 0;
export const RASGO_VELOCIDAD = 1;
export const RASGO_METABOLISMO = 2;
export const RASGO_LONGEVIDAD = 3;
export const RASGO_VISION = 4;
export const RASGO_OLFATO = 5;
export const RASGO_UMBRAL_DOLOR = 6;
export const RASGO_CEREBRO = 7;
export const RASGO_COSTE_SENAL = 8;
export const RASGO_EDAD_FERTIL = 9;
export const RASGO_DIETA_VEGETAL = 10;
export const RASGO_DIETA_CARNE = 11;
export const RASGO_TEMPERATURA = 12;
export const N_RASGOS = 13;

/** Átomos del genoma que se gastan en rasgos. El resto queda para el cerebro. */
export const ATOMOS_DE_RASGOS = N_RASGOS * VENTANA_DE_RASGO;

/**
 * Lee un rasgo del genoma: un número entre 0 y 1.
 *
 * Es el promedio de una ventana de átomos. Ancha a propósito — ver arriba.
 */
export function leerRasgo(genoma: Uint8Array, base: number, rasgo: number): number {
  const desde = base + rasgo * VENTANA_DE_RASGO;
  let suma = 0;
  for (let i = 0; i < VENTANA_DE_RASGO; i++) suma += genoma[desde + i]!;
  return suma / (VENTANA_DE_RASGO * (N_TIPOS_ATOMO - 1));
}

/**
 * Un número entre 0 y 1 para pintar el cuerpo. **No es un rasgo.**
 *
 * Cuesta explicarlo y merece la pena: aquí no hay ningún "gen del color", y no
 * lo va a haber, porque el color no es ninguna fuerza del mundo y un gen que no
 * empuja nada no pinta nada en la física. Esto es lo que la decisión D12 dice
 * del color de los frutos: **una proyección del genoma**, un número que se saca
 * de mirarlo, igual que se podría sacar la suma o la longitud.
 *
 * Se lee de la zona que no ocupan los rasgos, o sea de la parte que algún día
 * será cerebro. Da igual de dónde se lea, porque nadie lo consulta para decidir
 * nada: no lo lee ninguna criatura, no entra en ninguna cuenta y borrar esta
 * función no cambiaría un solo tick del mundo.
 *
 * Lo que sí hace es dejar ver una cosa que si no habría que ir a buscar a un
 * menú: dos cuerpos que pueden cruzarse tienen genomas parecidos, así que salen
 * del mismo color **solos**. El día que un grupo se separe lo bastante como para
 * no poder cruzarse con los demás, se le va a ver cambiar de color en la
 * pantalla. La especiación se mira.
 */
export function tinteDelGenoma(genoma: Uint8Array, base: number): number {
  const desde = base + ATOMOS_DE_RASGOS;
  let suma = 0;
  for (let i = 0; i < VENTANA_DE_TINTE; i++) suma += genoma[desde + i]!;
  return suma / (VENTANA_DE_TINTE * (N_TIPOS_ATOMO - 1));
}

/**
 * Construye el primer genoma de un linaje a partir de la molécula que se
 * condensó.
 *
 * La cadena del ciclo autocatalítico se repite hasta llenar el genoma. Así, dos
 * ciclos distintos dan cuerpos distintos, y como cada mundo desarrolla sus
 * propios ciclos (fase 2), cada mundo tiene sus propios primeros bichos.
 *
 * El desorden que se le añade viene del azar sembrado del mundo, y queda dicho
 * sin adornos: **es la parte menos emergente de todo el proyecto**. Sin él, todos
 * los cuerpos nacidos del mismo ciclo serían clones exactos y no habría nada que
 * seleccionar.
 *
 * La cadena se usa como semilla de un generador y no se repite en bucle. El
 * porqué está en el cuerpo de la función, y es la diferencia entre un cerebro y
 * una sola neurona repetida sesenta y cuatro veces.
 */
export function genomaDesdeLaCadena(
  destino: Uint8Array,
  base: number,
  atomosDelCiclo: number[],
  rng: EstadoRng,
): void {
  // La cadena se usa como SEMILLA de un generador, no se repite en bucle.
  //
  // Repetirla en bucle era lo que había antes y estaba roto de una forma que no
  // se veía leyendo el código. Un ciclo autocatalítico tiene tres o cuatro
  // átomos, y los sentidos son veinticuatro, que es múltiplo de los dos: al
  // repetir la cadena, **la fila de pesos de cada neurona salía idéntica a la de
  // todas las demás**. Medido: dos neuronas cualesquiera compartían el 92,9 % de
  // sus pesos, cuando por azar sería el 16,7 %. Un cerebro de treinta y cinco
  // neuronas era en realidad una neurona repetida treinta y cinco veces, y con
  // eso no se puede calcular nada.
  //
  // Esto no mete ni una pizca de azar de más: **la semilla es la cadena**, así
  // que el mismo ciclo da exactamente el mismo genoma, y dos ciclos distintos dan
  // genomas que no se parecen en nada. Sigue siendo la química la que decide qué
  // cuerpo sale, que es lo que importa; lo que cambia es que ahora el cuerpo que
  // sale puede usar todas sus neuronas.
  let semilla = 0x9e3779b9;
  for (let i = 0; i < atomosDelCiclo.length; i++) {
    semilla = (Math.imul(semilla ^ atomosDelCiclo[i]!, 0x85ebca6b) + 0x165667b1) >>> 0;
  }

  for (let i = 0; i < MAX_CADENA_GENOMA; i++) {
    // Un paso del generador por átomo. Determinista y sin periodo corto.
    semilla = (Math.imul(semilla ^ (semilla >>> 15), 0x2545f491) + 0x9e3779b9) >>> 0;
    let atomo = (semilla >>> 13) % N_TIPOS_ATOMO;
    // Y una errata de vez en cuando con el azar del mundo, para que dos cuerpos
    // salidos del MISMO ciclo no sean clones exactos el uno del otro.
    if (siguienteEntero(rng, 10000) < ERRATA_POR_DIEZ_MIL * 40) {
      atomo = siguienteEntero(rng, N_TIPOS_ATOMO);
    }
    destino[base + i] = atomo;
  }
}

/**
 * Copia un genoma con erratas.
 *
 * No es ruido añadido a propósito para "dar variedad": es que copiar miles de
 * átomos sale mal de vez en cuando. Los aciertos y los errores se heredan
 * igual, y de ahí sale todo lo demás.
 */
export function copiarConErratas(
  genomas: Uint8Array,
  origen: number,
  destino: number,
  rng: EstadoRng,
): void {
  for (let i = 0; i < MAX_CADENA_GENOMA; i++) {
    let atomo = genomas[origen + i]!;
    if (siguienteEntero(rng, 10000) < ERRATA_POR_DIEZ_MIL) {
      // La errata es local: cambia a un átomo vecino en el alfabeto, no a uno
      // cualquiera. Así el rasgo se mueve un poco, no da un salto.
      atomo = atomo + (siguienteEntero(rng, 2) === 0 ? -1 : 1);
      if (atomo < 0) atomo = 0;
      if (atomo >= N_TIPOS_ATOMO) atomo = N_TIPOS_ATOMO - 1;
    }
    genomas[destino + i] = atomo;
  }
}

/**
 * Mezcla dos genomas en uno, con erratas.
 *
 * Se recorre la cadena copiando de uno de los dos progenitores y, de vez en
 * cuando, se cambia de progenitor. Eso es recombinación: la cría lleva tramos
 * enteros de cada uno, no una media. Importa que sean tramos y no átomos
 * sueltos, porque un rasgo se lee promediando una ventana ancha: mezclando
 * átomo a átomo, cada rasgo de la cría saldría siempre en el punto medio de los
 * padres y no habría nada nuevo. Con tramos largos, un rasgo puede venir entero
 * de uno de los dos, y aparecen combinaciones que ninguno de los dos tenía.
 *
 * Las erratas son las mismas que al copiar: locales y de la misma tasa. Copiar
 * miles de átomos sale mal de vez en cuando, se haga de uno o de dos.
 */
export function recombinarConErratas(
  genomas: Uint8Array,
  padreA: number,
  padreB: number,
  destino: number,
  rng: EstadoRng,
): void {
  let deA = siguienteEntero(rng, 2) === 0;
  for (let i = 0; i < MAX_CADENA_GENOMA; i++) {
    // El cambio de progenitor se tira a cada átomo, así que los tramos salen de
    // largo variable en vez de cortarse siempre por los mismos sitios.
    if (siguienteEntero(rng, LARGO_DE_TRAMO) === 0) deA = !deA;
    let atomo = genomas[(deA ? padreA : padreB) + i]!;
    if (siguienteEntero(rng, 10000) < ERRATA_POR_DIEZ_MIL) {
      atomo = atomo + (siguienteEntero(rng, 2) === 0 ? -1 : 1);
      if (atomo < 0) atomo = 0;
      if (atomo >= N_TIPOS_ATOMO) atomo = N_TIPOS_ATOMO - 1;
    }
    genomas[destino + i] = atomo;
  }
}

/**
 * Cuánto se parecen dos genomas, de 0 (nada) a 1 (idénticos).
 *
 * De aquí sale la compatibilidad para reproducirse, y por tanto las especies.
 * No hay ningún campo "especie" que gobierne nada: dos poblaciones que llevan
 * mucho tiempo separadas acumulan erratas distintas, su parecido baja, y llega
 * un día en que ya no pueden cruzarse. **Eso es una especie nueva**, y se detecta
 * mirando, no se declara.
 *
 * Se compara una muestra repartida por todo el genoma en vez de los ocho mil
 * átomos: con ochocientos puntos el error de muestreo es despreciable y cuesta
 * diez veces menos.
 */
export function parecidoEntreGenomas(
  genomas: Uint8Array,
  a: number,
  b: number,
  muestras = 800,
): number {
  const paso = Math.floor(MAX_CADENA_GENOMA / muestras) || 1;
  let iguales = 0;
  let miradas = 0;
  for (let i = 0; i < MAX_CADENA_GENOMA; i += paso) {
    if (genomas[a + i] === genomas[b + i]) iguales++;
    miradas++;
  }
  return miradas > 0 ? iguales / miradas : 0;
}
