/**
 * EL ARCHIVO ÚNICO DE PARÁMETROS.
 *
 * Regla innegociable (CLAUDE.md §1.7): todo parámetro del mundo vive acá,
 * comentado, con unidades y con el rango probado. Cero números mágicos dentro
 * de la lógica. El test de ausencia de guion falla si aparece un literal
 * decimal en cualquier otro archivo de `src/sim/`.
 *
 * Ninguno de estos números es verdad. Son puntos de partida que el laboratorio
 * tiene que corregir con mediciones.
 */

// ---------------------------------------------------------------------------
// Identidad del mundo
// ---------------------------------------------------------------------------

/** Semilla usada cuando no se pide ninguna. Cualquier entero de 32 bits. */
export const SEMILLA_POR_DEFECTO = 20260819;

// ---------------------------------------------------------------------------
// Geometría del mundo
// ---------------------------------------------------------------------------

/**
 * Ancho y alto del grid, en celdas.
 *
 * 64x64 por decisión D2 de docs/DECISIONES.md: mundo chico y población densa.
 * Con ~500 criaturas hay una cada ocho celdas y los encuentros son constantes.
 * En 128x128 serían bichos perdidos en un continente vacío, y los bichos solos
 * no hablan. Subir solo si el laboratorio dice que sobra presupuesto.
 */
export const GRID_ANCHO = 64;
export const GRID_ALTO = 64;

/** Celdas totales. Derivado, no tocar a mano. */
export const GRID_CELDAS = GRID_ANCHO * GRID_ALTO;

// ---------------------------------------------------------------------------
// El reloj
// ---------------------------------------------------------------------------

/** Duración de un tick en tiempo real, en milisegundos. Un tick = un segundo. */
export const TICK_MS = 1000;

/**
 * Presupuesto de CPU por tick en tiempo real, en milisegundos (CLAUDE.md §2.4).
 * Si se pasa, se recorta la química antes que los bichos.
 */
export const PRESUPUESTO_MS_POR_TICK = 16;

/**
 * Velocidades elegibles al crear un mundo. Queda fija para ese mundo.
 * x100 no es una garantía sino un "lo más rápido que se pueda": a 100 ticks por
 * segundo el presupuesto de arriba pediría 1,6 s de CPU por segundo. La
 * telemetría reporta el factor realmente alcanzado.
 */
export const VELOCIDADES_PERMITIDAS = [1, 10, 100] as const;

/**
 * Tope de ticks que el catch-up corre al abrir la app tras un rato cerrada.
 * Existe porque un día cerrado a x100 son 8,64 millones de ticks, que no se
 * pueden correr en el arranque. Cuando se toca este tope, la interfaz dice
 * cuántos ticks se corrieron de cuántos: nunca se recorta en silencio.
 */
export const CATCHUP_MAX_TICKS = 200_000;

// ---------------------------------------------------------------------------
// Materia
// ---------------------------------------------------------------------------

/**
 * Átomos por celda al crear el mundo.
 *
 * La materia se cuenta en enteros (decisión D7): los átomos son discretos y así
 * la conservación de masa es exacta por construcción, no aproximada.
 */
export const MATERIA_INICIAL_POR_CELDA = 1000;

/**
 * Divisor de la difusión de materia entre celdas vecinas.
 *
 * En cada paso se mueve `(a - b) / DIVISOR` átomos de la celda más llena a la
 * más vacía, con división entera. Más alto = difusión más lenta. Con 1 la
 * mezcla es instantánea y el mundo se vuelve uniforme; con valores altos se
 * mantienen gradientes, que es lo que hace falta para que haya frentes y
 * corrientes en vez de una sopa homogénea.
 */
export const DIFUSION_MATERIA_DIVISOR = 8;

// ---------------------------------------------------------------------------
// Telemetría
// ---------------------------------------------------------------------------

/** Cada cuántos ticks se toma una muestra de las series temporales. */
export const TELEMETRIA_CADA_N_TICKS = 100;

/**
 * Máximo de muestras guardadas en memoria antes de que la serie empiece a
 * diezmarse (se queda con una de cada dos y sigue). Evita que una corrida de
 * laboratorio de millones de ticks se coma la RAM.
 */
export const TELEMETRIA_MAX_MUESTRAS = 4096;

// ---------------------------------------------------------------------------
// Seguridad
// ---------------------------------------------------------------------------

/**
 * Tope duro de criaturas, solo para que el navegador no se caiga (spec §5.5).
 * NO es un límite de diseño: el límite de población tiene que salir de los
 * recursos. Si se alcanza, queda registrado en la telemetría con aviso claro.
 */
export const TOPE_POBLACION_SEGURIDAD = 4000;

// ---------------------------------------------------------------------------
// Reservado para fases siguientes
//
// Se declaran acá desde ya para que ningún número aparezca suelto en el código
// cuando llegue su fase. Todavía no los usa nadie.
// ---------------------------------------------------------------------------

/** Fase 2. Longitud máxima de una molécula del ambiente, en átomos. */
export const MAX_CADENA_SOPA = 12;

/** Fase 2. Tipos de átomo del alfabeto. Único catálogo permitido en el código. */
export const N_TIPOS_ATOMO = 6;

/** Fase 2. Moléculas seguidas por celda; el resto va al depósito inerte. */
export const TOP_N_MOLECULAS = 24;

/**
 * Fase 3. Longitud máxima del genoma, en átomos (decisión D2).
 * Es mucho mayor que MAX_CADENA_SOPA porque de esta cadena salen también los
 * pesos del cerebro, y con doce átomos no entran.
 */
export const MAX_CADENA_GENOMA = 8192;

/** Fase 4. Neuronas ocultas reservadas en memoria para toda criatura. */
export const CEREBRO_OCULTAS_MAX = 64;

/** Fase 4. Mínimo de neuronas ocultas que el gen de tamaño puede activar. */
export const CEREBRO_OCULTAS_MIN = 16;
