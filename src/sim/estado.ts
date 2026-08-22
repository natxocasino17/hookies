/**
 * El estado del mundo, y cómo se guarda y se vuelve a cargar.
 *
 * Regla: todo lo que la simulación necesita para continuar está acá dentro y es
 * serializable. Nada vive en variables sueltas de un módulo ni en el navegador.
 * Si algo no está en esta estructura, no existe.
 *
 * Lo que NO se guarda: la rejilla del planeta. No depende de la semilla — es
 * siempre la misma para un mismo nivel de subdivisión — así que se reconstruye
 * al cargar y no ocupa sitio en el archivo.
 */

import {
  AGUA_INICIAL_OCEANO,
  AGUA_INICIAL_SUELO,
  ESCALA_ENERGIA_QUIMICA,
  MAX_CADENA_GENOMA,
  MAX_CRIATURAS,
  N_DIMEROS,
  N_TIPOS_ATOMO,
  TOP_N_MOLECULAS,
  GENES_PLANTA,
  MAX_PLANTAS,
  PLANTAS_INICIALES,
  MATERIA_INICIAL_POR_CELDA,
  NIVEL_DEL_MAR,
  NIVEL_SUBDIVISION,
  SEMILLA_POR_DEFECTO,
  TEMP_INICIAL,
  OCULTAS_EN_MEMORIA,
} from './constants.js';
import { N_SALIDAS_CEREBRO, VERBOS } from './verbos.js';
import { N_SENTIDOS } from './sentidos.js';
import { crearRng, RNG_PALABRAS, type EstadoRng } from './rng.js';
import { MARCA_ARCHIVO, migrar, VERSION_ESQUEMA } from './esquema.js';
import { celdasDelNivel, construirGeometria, type Geometria } from './geodesica.js';
import { generarAltura } from './terreno.js';
import { materiaEnPlantas, sembrarPrimerasPlantas } from './plantas.js';
import { sembrarLaSopa } from './quimica.js';
import { materiaEnCriaturas } from './criaturas.js';

export interface EstadoMundo {
  /** Semilla con la que nació este mundo. Junto con las intervenciones, lo define entero. */
  semilla: number;
  /** Ticks transcurridos desde la creación. Un tick = un segundo de mundo. */
  tick: number;
  /** Estado del generador de azar. Viaja con el mundo para que el futuro también sea reproducible. */
  rng: EstadoRng;

  /** Nivel de subdivisión del planeta. Determina cuántas celdas tiene. */
  nivel: number;
  /** Celdas del planeta. Derivado del nivel, se guarda por comodidad de lectura. */
  nCeldas: number;

  /**
   * Altura del terreno de cada celda.
   *
   * Pendiente para cuando llegue la erosión: la altura debería salir de cuánta
   * materia sólida guarda la celda, y así mover tierra conservaría masa sola.
   * Por ahora es un campo aparte, y queda dicho.
   */
  altura: Float32Array;

  /**
   * Átomos en cada celda, en cuentas enteras (decisión D7).
   *
   * Enteros y no decimales porque la conservación de masa tiene que ser exacta:
   * con decimales, cada suma pierde un pelo y a los pocos miles de ticks "la
   * materia total no cambia jamás" sería mentira. Además es lo correcto, los
   * átomos no se parten.
   *
   * En la fase 2 esto se reemplaza por las concentraciones de cada molécula.
   */
  materia: Int32Array;

  /** Temperatura de cada celda, en grados del mundo (0 = se congela el agua). */
  temperatura: Float32Array;

  /**
   * Agua del suelo de cada celda, en gotas enteras. En las celdas de mar es el
   * océano; en las de tierra, lo que hay empapado o encharcado.
   *
   * Enteros por lo mismo que la materia (D7): el ciclo del agua tiene que
   * conservar exactamente, y con decimales cada evaporación perdería un pelo.
   */
  aguaSuelo: Int32Array;

  /** Agua que lleva el aire encima de cada celda. Cuando sobra, llueve. */
  humedadAire: Int32Array;

  /**
   * Agua que pasó por esta celda camino de una más baja, en el último tick.
   * No es un campo que gobierne nada: es la cuenta de la que salen los ríos.
   */
  flujoAgua: Int32Array;

  /**
   * Viento en cada celda: un vector de tres números tangente a la superficie.
   * Se recalcula entero en cada tick a partir de la presión, así que no se
   * guarda en el archivo; vive aquí solo para no pedir memoria en cada vuelta.
   */
  viento: Float32Array;

  /**
   * Agua que cayó del cielo sobre esta celda en el último tick.
   * Tampoco gobierna nada: es de donde salen las nubes que se dibujan. Si ves
   * una nube es porque ahí está lloviendo, no porque quede bonito.
   */
  lluvia: Int32Array;

  // --- Vegetación (andamio provisional, decisión D19) ------------------------
  //
  // Listas paralelas en vez de objetos: un array por campo. Es más incómodo de
  // leer pero es lo que permite recorrer decenas de miles de plantas sin que el
  // recolector de basura se ponga a trabajar en mitad del tick.
  //
  /** En qué celda está cada planta. -1 significa hueco libre. */
  plantaCelda: Int32Array;
  /** Materia que tiene cada planta en el cuerpo. Sale del suelo y vuelve a él. */
  plantaMasa: Int32Array;
  /** Ticks vividos. */
  plantaEdad: Int32Array;
  /** Fruto acumulado, que es de donde salen las semillas. */
  plantaFruto: Int32Array;
  /** Genes de cada planta, GENES_PLANTA seguidos por planta. */
  plantaGenoma: Uint8Array;
  /** Cuántas plantas hay en cada celda, para no amontonar infinitas. */
  plantasEnCelda: Int32Array;

  /**
   * Qué plantas hay en cada celda, con el mismo truco que el de las criaturas:
   * `cabezaPlantaEnCelda[celda]` es la primera y `siguientePlantaEnCelda[p]` la
   * de detrás, en orden de ranura. Morder busca la planta más grande de la
   * celda, y recorrer las 16.000 ranuras para encontrarla era el bucle más caro
   * del tick. Tampoco se guarda: se deduce de `plantaCelda`.
   */
  cabezaPlantaEnCelda: Int32Array;
  siguientePlantaEnCelda: Int32Array;
  /** Por dónde va la búsqueda de huecos libres. Se guarda para que sea reproducible. */
  cursorPlanta: number;
  /** Cuentas del último tick, para la telemetría y la pantalla. */
  plantasVivas: number;
  masaVegetal: number;

  // --- La química -----------------------------------------------------------
  //
  /** Átomos sueltos de cada tipo en cada celda: N_TIPOS_ATOMO por celda. */
  atomosLibres: Int32Array;
  /**
   * Dímeros de cada tipo en cada celda: N_DIMEROS por celda.
   *
   * Tienen cajón propio, aparte de las ranuras del top-N, porque solo hay 36
   * posibles y caben todos sin filtro. Antes competían por las 24 ranuras y las
   * acaparaban, y eso dejaba el largo medio de las cadenas clavado en 2,22.
   */
  dimeros: Int32Array;
  /** Las moléculas que sigue cada celda: TOP_N_MOLECULAS por celda, 0 = hueco. */
  sopaMolecula: Int32Array;
  /** Cuántas hay de cada una. */
  sopaCantidad: Int32Array;
  /** Cuánto calienta la química. Se guarda aquí para no leer constantes en el bucle. */
  escalaEnergiaQuimica: number;
  /** Uniones que ocurrieron en el último tick. Solo para la telemetría. */
  reaccionesEsteTick: number;

  // --- Los cuerpos ----------------------------------------------------------
  //
  /** En qué celda está cada criatura. -1 significa hueco libre. */
  criaturaCelda: Int32Array;
  /** Materia de su cuerpo, en enteros. Sale del mundo y vuelve al mundo. */
  criaturaMateria: Int32Array;
  /** Energía. Baja siempre y sube al comer. Es la única recompensa que existe. */
  criaturaEnergia: Float32Array;
  /** Daño acumulado. Sube al recibir mordiscos o pasar frío o calor. */
  criaturaDano: Float32Array;
  /** Ticks vividos. */
  criaturaEdad: Int32Array;
  /** Temperatura del cuerpo, peleando con la del entorno. */
  criaturaTemperatura: Float32Array;
  /**
   * De qué linaje viene. Se hereda tal cual de madre a cría.
   *
   * NO es un campo "especie" que gobierne nada: nadie consulta este número para
   * decidir con quién se puede cruzar. Sirve solo para contar a posteriori
   * cuántas ramas quedan vivas. Las especies de verdad salen del parecido entre
   * genomas, que se mide, no se declara.
   */
  criaturaLinaje: Int32Array;
  /**
   * Materia que el cuerpo tiene apartada en un gameto. Cero si no lleva ninguno.
   *
   * Es materia del mundo como cualquier otra: sale del cuerpo, se cuenta en el
   * total y vuelve al suelo si el cuerpo se muere sin gastarla. Existe porque un
   * gameto es algo que se **lleva encima** mientras uno anda por ahí, no un
   * instante: sin esto, dos cuerpos no llegan a coincidir nunca fértiles a la vez
   * y el sexo no ocurre — medido, 18 cruces de 19.519 nacimientos.
   */
  criaturaGameto: Int32Array;
  /** Genoma de cada criatura: MAX_CADENA_GENOMA átomos seguidos por criatura. */
  criaturaGenoma: Uint8Array;

  // --- Lo que el cerebro necesita para funcionar y para aprender -------------
  //
  // Todo esto va al archivo guardado, y no es discutible: **lo que un bicho ha
  // aprendido en su vida es ese bicho**. Un mundo que se guardara sin esto
  // volvería con los mismos cuerpos y ninguno de sus hábitos.

  /**
   * Lo que las neuronas ocultas tienen encendido ahora mismo.
   *
   * Se lee a sí mismo del tick anterior: eso es la recurrencia, y es lo que
   * permite que un cuerpo haga algo que dependa de lo que pasó antes y no solo
   * de lo que tiene delante.
   */
  criaturaOculta: Float32Array;

  /**
   * Los pesos de la capa de salida, que son los que cambian en vida.
   *
   * Salen copiados del genoma al nacer y a partir de ahí se van moviendo con lo
   * que le pase. Los del genoma no se tocan — son lo que heredarán sus crías —
   * así que **lo aprendido en vida no se hereda**, solo lo que traía escrito.
   */
  criaturaPesosSalida: Float32Array;

  /** Qué neuronas y qué acciones venían estando activas, para saber a qué premiar. */
  criaturaTrazaOculta: Float32Array;
  criaturaTrazaSalida: Float32Array;

  /** Energía menos dolor del tick pasado. La recompensa es cuánto ha cambiado. */
  criaturaBienestar: Float32Array;

  /**
   * Lo que a este cuerpo le viene pasando últimamente, de media.
   *
   * Sin esto el aprendizaje no funciona, y costó encontrarlo. La recompensa es
   * cuánto ha cambiado la energía menos el dolor, y **el metabolismo hace que
   * ese cambio sea negativo casi todos los ticks**: estar vivo cuesta. Así que
   * el aprendizaje se pasaba la vida castigando lo que el bicho estuviera
   * haciendo, fuera lo que fuera, hasta apagarlo entero. Medido: los cerebros
   * acababan moviéndose el 1,3 % de los ticks y mordiendo el 0,9 %, contra el 35
   * y el 30 % del control. Catatónicos.
   *
   * Lo que se premia ahora es que le vaya **mejor de lo que le suele ir**. Sigue
   * siendo energía menos dolor y nada más (§1.5): no se ha añadido ninguna
   * recompensa nueva, solo se ha quitado el suelo que la hacía siempre negativa.
   * Es lo mismo que hace la dopamina, que no señala el premio sino la sorpresa.
   */
  criaturaEsperado: Float32Array;

  /**
   * Quién está en cada celda, para no tener que recorrer todas las ranuras cada
   * vez que alguien muerde.
   *
   * `cabezaEnCelda[celda]` es la primera criatura de esa celda y
   * `siguienteEnCelda[c]` la que va detrás; -1 cierra la lista. Las listas van
   * **siempre en orden de ranura**, y eso importa por dos razones: morder elige
   * a la primera de la celda, así que el orden decide a quién le toca; y como el
   * orden solo depende de qué ranuras están en la celda, el índice se puede
   * reconstruir al cargar un mundo y sale idéntico. Por eso no va en el archivo:
   * no es estado, es una consecuencia de `criaturaCelda`.
   */
  cabezaEnCelda: Int32Array;
  siguienteEnCelda: Int32Array;
  /** Por dónde va la búsqueda de huecos. Se guarda, o cargar cambiaría el futuro. */
  cursorCriatura: number;
  /** Número que se le da al próximo linaje que se funde. */
  siguienteLinaje: number;

  /**
   * Lo que suena en el aire de cada celda: cuatro números, y nada más.
   *
   * **Ninguno de los cuatro significa nada.** No hay diccionario, no hay lista
   * de palabras y no la va a haber (CLAUDE.md §1.3). Un bicho emite cuatro
   * números, se suman a los de su celda, se reparten un poco a las de al lado y
   * se apagan enseguida. Si algún día una nube de valores apareciera siempre en
   * las mismas situaciones, **eso** sería una palabra, y la habrían hecho ellos.
   *
   * Hasta esta sesión emitir costaba energía y no dejaba rastro en ningún sitio,
   * así que el canal no podía llevar nada aunque alguien hubiera querido decir
   * algo. Esto es el aire donde cabe el sonido, y no es poca cosa: es lo que la
   * visión del proyecto llama el corazón.
   */
  senalAire: Float32Array;

  /**
   * Lo que hay rascado en el suelo de cada celda: otros cuatro números.
   *
   * Lo mismo que la señal, pero durando. Una señal es un grito y esto es un
   * monumento: sigue ahí cuando el que lo rascó se ha ido o se ha muerto. Es la
   * única forma que existe en este mundo de dejar algo escrito, y nadie ha
   * escrito qué quiere decir.
   */
  marcaSuelo: Float32Array;

  /** Materia de cuerpos muertos tirada en cada celda. Se pudre y vuelve al suelo. */
  carrona: Int32Array;
  /** Ticks seguidos que lleva cada celda con un ciclo autocatalítico fuerte. */
  constanciaDelCiclo: Int32Array;

  /** Cuentas del último tick, para la telemetría y la pantalla. */
  criaturasVivas: number;
  nacimientosEsteTick: number;
  /** De esos nacimientos, cuántos salieron de juntar gametos de dos cuerpos. */
  cruzamientosEsteTick: number;
  muertesEsteTick: number;
  senalesEsteTick: number;
  /** Cuántos cuerpos le copiaron pesos a un vecino con suerte en el último tick. */
  imitacionesEsteTick: number;

  /**
   * Cuántas veces se hizo cada verbo en el último tick, en el orden de VERBOS.
   *
   * Es telemetría y no estado: se pone a cero cada tick y no la lee nadie dentro
   * del mundo, así que no va al archivo. Existe porque sin ella no hay forma de
   * saber si un cerebro está actuando tanto como el control o el triple, y esa
   * diferencia sola puede decidir si una población vive o se extingue — pasó, y
   * costó dos días de medir mundos muertos antes de mirarlo desde dentro.
   */
  verbosEsteTick: Int32Array;
  edadMediaDeMuerte: number;
  /** Si alguna vez se alcanzó el tope de seguridad. Nunca se recorta en silencio. */
  topeDePoblacionTocado: boolean;

  /**
   * Si los cuerpos deciden con su cerebro o tiran los dados.
   *
   * **Esto es un control de experimento, no una perilla del juego.** El criterio
   * 1 de la fase 4 es que la esperanza de vida con cerebros supere a la de los
   * mismos bichos con los verbos al azar, en la misma semilla. Sin poder correr
   * las dos cosas no hay forma de saber si el cerebro sirve de algo, y "se mueven
   * con sentido" sería una impresión y no un dato.
   *
   * Los mundos que se miran van siempre con cerebro. El laboratorio es el único
   * sitio que lo apaga, y cuando lo apaga lo dice.
   */
  conCerebro: boolean;

  /**
   * Memoria de trabajo del arrastre por el viento.
   *
   * El viento tiene que leer el estado de ANTES para que el aire que llega a una
   * celda no vuelva a salir en el mismo tick — si no, correría a velocidades
   * distintas según el orden en que se recorren las celdas. Eso pide una copia,
   * y estos dos buffers se reaprovechan en vez de pedir memoria nueva.
   *
   * Honestidad sobre esto: se hizo pensando que las copias por tick eran las
   * culpables de que el clima costara casi un milisegundo, y **medido, no
   * cambió nada** (1,544 ms antes, 1,544 ms después). El coste está en saltar
   * por la tabla de vecinos de la esfera, que es memoria desordenada. Se deja
   * porque sigue siendo lo correcto para millones de ticks, pero no es una
   * optimización: no aceleró nada.
   *
   * No se guardan en el archivo: son andamio de trabajo.
   */
  copiaEnteros: Int32Array;
  /**
   * Memoria de trabajo del reparto de la señal.
   *
   * Hace falta por lo mismo que la del viento: repartir tiene que leer el estado
   * de ANTES. Si una celda leyera a un vecino que ya se actualizó este tick, la
   * señal correría más deprisa en una dirección que en otra, y hacia dónde
   * correría dependería del orden en que están numeradas las celdas.
   */
  copiaSenal: Float32Array;
  /**
   * Memoria de trabajo de la capa oculta.
   *
   * Por lo mismo que la del viento y la de la señal: calcular las ocultas nuevas
   * necesita las viejas enteras. Sin esto, la neurona 5 leería a la 3 ya
   * actualizada y a la 7 sin actualizar, y el cerebro dependería del orden en que
   * están numeradas sus propias neuronas.
   */
  copiaOculta: Float32Array;
  /**
   * Sitios donde el cerebro deja lo que siente y lo que decide mientras piensa.
   *
   * Se reutilizan de un bicho al siguiente en vez de crear vectores nuevos:
   * hacerlo bien son tres arrays por criatura y por tick, o sea millones de
   * objetos por minuto para que el recolector de basura los tire enseguida.
   */
  sentidosDeTrabajo: Float32Array;
  salidaDeTrabajo: Float32Array;
  marcoDeTrabajo: Float64Array;
  copiaDecimales: Float32Array;

  /** Contabilidad de energía: cuánta entró (sol) y cuánta salió (disipación). */
  energiaEntrada: number;
  energiaSalida: number;
}

/** Bytes de cabecera antes de los datos de las celdas. */
const BYTES_CABECERA = 72;

/**
 * Bit que se enciende en el hueco del nivel cuando el mundo va sin cerebro.
 *
 * El nivel es 3 o 4, así que los bits de arriba de ese número están libres y no
 * hace falta gastar cuatro bytes más de cabecera. Va aquí y no suelto porque un
 * mundo de control tiene que poder guardarse y volver siendo de control.
 */
const BANDERA_SIN_CEREBRO = 0x10000;

/** Un índice por celda recién estrenado: nadie en ninguna parte. */
function cabezaVacia(nCeldas: number): Int32Array {
  const a = new Int32Array(nCeldas);
  a.fill(-1);
  return a;
}

/** Los enlaces "quién va detrás", todos cerrados. */
function listaVacia(): Int32Array {
  const a = new Int32Array(MAX_CRIATURAS);
  a.fill(-1);
  return a;
}

/** Lo mismo para las plantas. */
function listaPlantasVacia(): Int32Array {
  const a = new Int32Array(MAX_PLANTAS);
  a.fill(-1);
  return a;
}

/**
 * Vuelve a armar el índice de quién está en cada celda a partir de las
 * posiciones. Recorrer las ranuras de menor a mayor y meter cada una al final
 * de su celda deja las listas en orden de ranura, que es justo el orden que
 * mantienen `entrarEnLaCelda` y `salirDeLaCelda` mientras el mundo corre. Por
 * eso cargar un mundo guardado no cambia su futuro.
 */
export function reconstruirIndiceDeCeldas(estado: EstadoMundo): void {
  estado.cabezaEnCelda.fill(-1);
  estado.siguienteEnCelda.fill(-1);
  const cola = new Int32Array(estado.cabezaEnCelda.length);
  cola.fill(-1);
  for (let c = 0; c < MAX_CRIATURAS; c++) {
    const celda = estado.criaturaCelda[c]!;
    if (celda < 0) continue;
    const ultima = cola[celda]!;
    if (ultima < 0) estado.cabezaEnCelda[celda] = c;
    else estado.siguienteEnCelda[ultima] = c;
    cola[celda] = c;
  }

  estado.cabezaPlantaEnCelda.fill(-1);
  estado.siguientePlantaEnCelda.fill(-1);
  cola.fill(-1);
  for (let p = 0; p < MAX_PLANTAS; p++) {
    const celda = estado.plantaCelda[p]!;
    if (celda < 0) continue;
    const ultima = cola[celda]!;
    if (ultima < 0) estado.cabezaPlantaEnCelda[celda] = p;
    else estado.siguientePlantaEnCelda[ultima] = p;
    cola[celda] = p;
  }
}

/** Campos por celda que van al archivo: materia, altura, temperatura, agua, humedad. */
const CAMPOS_POR_CELDA = 5;
/** Bytes por planta: celda, masa, edad y fruto en enteros, más sus genes. */
const BYTES_POR_PLANTA = 16 + GENES_PLANTA;
/**
 * Campos de cuatro bytes que guarda cada criatura, sin contar el genoma: celda,
 * materia, energía, daño, edad, linaje y gameto.
 *
 * Va como constante y no como número suelto porque el número suelto ya se cobró
 * una pieza: el paso entre criaturas estaba escrito a mano como `c * 24` en dos
 * sitios, y al añadir el gameto como séptimo campo cada criatura escribía su
 * gameto encima de la celda de la siguiente. El mundo se guardaba mal y cargarlo
 * daba otro futuro. Lo cazó el test de determinismo, no la vista.
 */
const CAMPOS_POR_CRIATURA = 7;
const BYTES_CAMPOS_CRIATURA = CAMPOS_POR_CRIATURA * 4;

/**
 * Decimales que guarda el cerebro de cada criatura: su capa oculta, sus pesos de
 * salida aprendidos, las dos trazas y su bienestar de antes.
 *
 * Va derivado y no escrito a mano por la misma razón que el de arriba, que ya se
 * cobró una pieza. Y sí, es mucho: 714 decimales por bicho, 8,6 MB con el tope
 * en tres mil. Se guarda igualmente porque **lo que un bicho ha aprendido es ese
 * bicho**, y un mundo que volviera con los mismos cuerpos y ninguno de sus
 * hábitos no sería el mismo mundo. Lo que hay que arreglar antes de la fase 6 es
 * escribir solo las ranuras ocupadas (RIESGOS §14), no dejar de guardar esto.
 */
const DECIMALES_DE_CEREBRO =
  OCULTAS_EN_MEMORIA + OCULTAS_EN_MEMORIA * N_SALIDAS_CEREBRO + OCULTAS_EN_MEMORIA + N_SALIDAS_CEREBRO + 2;
const BYTES_DE_CEREBRO = DECIMALES_DE_CEREBRO * 4;
/** Bytes por criatura: sus campos más su genoma. */
const BYTES_POR_CRIATURA = BYTES_CAMPOS_CRIATURA + MAX_CADENA_GENOMA + BYTES_DE_CEREBRO;
/**
 * Bytes por celda de las cosas de los cuerpos: carroña y constancia del ciclo en
 * enteros, más los cuatro números de la señal y los cuatro de la marca.
 */
const BYTES_CUERPOS_POR_CELDA = 8 + 4 * 4 + 4 * 4;
/** Bytes por celda de la sopa: átomos sueltos más las moléculas con su cantidad. */
const BYTES_SOPA_POR_CELDA = N_TIPOS_ATOMO * 4 + N_DIMEROS * 4 + TOP_N_MOLECULAS * 8;

/** Crea un mundo nuevo. Determinista: la misma semilla da siempre el mismo mundo. */
/**
 * Crea un mundo nuevo.
 *
 * `conCerebro` en falso es el control del experimento de la fase 4, y solo lo
 * usa el laboratorio: los mismos bichos con los mismos genes tirando los dados
 * en vez de decidir. Ver `EstadoMundo.conCerebro`.
 */
export function crearEstado(
  semilla: number = SEMILLA_POR_DEFECTO,
  nivel: number = NIVEL_SUBDIVISION,
  conCerebro = true,
): EstadoMundo {
  const geo = construirGeometria(nivel);
  const materia = new Int32Array(geo.nCeldas);
  materia.fill(MATERIA_INICIAL_POR_CELDA);

  const altura = generarAltura(geo, semilla);
  const temperatura = new Float32Array(geo.nCeldas);
  temperatura.fill(TEMP_INICIAL);

  // El agua empieza donde corresponde: casi toda en el mar, un poco en la
  // tierra. A partir de aquí solo se mueve; no aparece ni desaparece nunca.
  const aguaSuelo = new Int32Array(geo.nCeldas);
  for (let i = 0; i < geo.nCeldas; i++) {
    aguaSuelo[i] = altura[i]! < NIVEL_DEL_MAR ? AGUA_INICIAL_OCEANO : AGUA_INICIAL_SUELO;
  }

  const plantaCelda = new Int32Array(geo.nCeldas > 0 ? MAX_PLANTAS : 0);
  plantaCelda.fill(-1);
  const criaturaCelda = new Int32Array(MAX_CRIATURAS);
  criaturaCelda.fill(-1);

  const estado: EstadoMundo = {
    semilla,
    tick: 0,
    rng: crearRng(semilla),
    nivel,
    nCeldas: geo.nCeldas,
    altura,
    materia,
    temperatura,
    aguaSuelo,
    humedadAire: new Int32Array(geo.nCeldas),
    flujoAgua: new Int32Array(geo.nCeldas),
    lluvia: new Int32Array(geo.nCeldas),
    viento: new Float32Array(geo.nCeldas * 3),
    plantaCelda,
    plantaMasa: new Int32Array(MAX_PLANTAS),
    plantaEdad: new Int32Array(MAX_PLANTAS),
    plantaFruto: new Int32Array(MAX_PLANTAS),
    plantaGenoma: new Uint8Array(MAX_PLANTAS * GENES_PLANTA),
    plantasEnCelda: new Int32Array(geo.nCeldas),
    cabezaPlantaEnCelda: cabezaVacia(geo.nCeldas),
    siguientePlantaEnCelda: listaPlantasVacia(),
    cursorPlanta: 0,
    plantasVivas: 0,
    masaVegetal: 0,
    atomosLibres: new Int32Array(geo.nCeldas * N_TIPOS_ATOMO),
    dimeros: new Int32Array(geo.nCeldas * N_DIMEROS),
    sopaMolecula: new Int32Array(geo.nCeldas * TOP_N_MOLECULAS),
    sopaCantidad: new Int32Array(geo.nCeldas * TOP_N_MOLECULAS),
    escalaEnergiaQuimica: ESCALA_ENERGIA_QUIMICA,
    reaccionesEsteTick: 0,
    criaturaCelda,
    criaturaMateria: new Int32Array(MAX_CRIATURAS),
    criaturaEnergia: new Float32Array(MAX_CRIATURAS),
    criaturaDano: new Float32Array(MAX_CRIATURAS),
    criaturaEdad: new Int32Array(MAX_CRIATURAS),
    criaturaTemperatura: new Float32Array(MAX_CRIATURAS),
    criaturaLinaje: new Int32Array(MAX_CRIATURAS),
    criaturaGameto: new Int32Array(MAX_CRIATURAS),
    criaturaGenoma: new Uint8Array(MAX_CRIATURAS * MAX_CADENA_GENOMA),
    criaturaOculta: new Float32Array(MAX_CRIATURAS * OCULTAS_EN_MEMORIA),
    criaturaPesosSalida: new Float32Array(MAX_CRIATURAS * OCULTAS_EN_MEMORIA * N_SALIDAS_CEREBRO),
    criaturaTrazaOculta: new Float32Array(MAX_CRIATURAS * OCULTAS_EN_MEMORIA),
    criaturaTrazaSalida: new Float32Array(MAX_CRIATURAS * N_SALIDAS_CEREBRO),
    criaturaBienestar: new Float32Array(MAX_CRIATURAS),
    criaturaEsperado: new Float32Array(MAX_CRIATURAS),
    cabezaEnCelda: cabezaVacia(geo.nCeldas),
    siguienteEnCelda: listaVacia(),
    cursorCriatura: 0,
    siguienteLinaje: 1,
    senalAire: new Float32Array(geo.nCeldas * 4),
    marcaSuelo: new Float32Array(geo.nCeldas * 4),
    carrona: new Int32Array(geo.nCeldas),
    constanciaDelCiclo: new Int32Array(geo.nCeldas),
    criaturasVivas: 0,
    nacimientosEsteTick: 0,
    cruzamientosEsteTick: 0,
    muertesEsteTick: 0,
    senalesEsteTick: 0,
    imitacionesEsteTick: 0,
    verbosEsteTick: new Int32Array(VERBOS.length),
    edadMediaDeMuerte: 0,
    topeDePoblacionTocado: false,
    conCerebro,
    copiaEnteros: new Int32Array(geo.nCeldas),
    copiaSenal: new Float32Array(geo.nCeldas * 4),
    copiaOculta: new Float32Array(OCULTAS_EN_MEMORIA),
    sentidosDeTrabajo: new Float32Array(N_SENTIDOS),
    salidaDeTrabajo: new Float32Array(N_SALIDAS_CEREBRO),
    marcoDeTrabajo: new Float64Array(6),
    copiaDecimales: new Float32Array(geo.nCeldas),
    energiaEntrada: 0,
    energiaSalida: 0,
  };

  // La sopa arranca con átomos sueltos en cada celda. A partir de aquí solo se
  // reordenan: no nace ni desaparece ni uno.
  sembrarLaSopa(estado);

  // Las primeras plantas se reparten por la tierra. Su materia sale del suelo,
  // no de la nada, así que la masa total del mundo no cambia por sembrarlas.
  sembrarPrimerasPlantas(estado, geo, PLANTAS_INICIALES);
  return estado;
}

/**
 * Materia total del mundo, como entero exacto.
 * Es el número que el test de masa exige que no cambie jamás.
 */
export function materiaTotal(estado: EstadoMundo): number {
  let total = 0;
  const m = estado.materia;
  for (let i = 0; i < m.length; i++) total += m[i]!;
  // La materia que está dentro de una planta o de un cuerpo sigue siendo materia
  // del mundo: salió del suelo y volverá a él al morir. La carroña también.
  return total + materiaEnPlantas(estado) + materiaEnCriaturas(estado);
}

/** Convierte el mundo entero a bytes, listo para guardar o exportar a archivo. */
export function serializar(estado: EstadoMundo): Uint8Array {
  const n = estado.nCeldas;
  const bytes = new Uint8Array(
    BYTES_CABECERA +
      n * 4 * CAMPOS_POR_CELDA +
      MAX_PLANTAS * BYTES_POR_PLANTA +
      n * BYTES_SOPA_POR_CELDA +
      MAX_CRIATURAS * BYTES_POR_CRIATURA +
      n * BYTES_CUERPOS_POR_CELDA,
  );
  const vista = new DataView(bytes.buffer);

  vista.setUint32(0, MARCA_ARCHIVO, true);
  vista.setUint32(4, VERSION_ESQUEMA, true);
  vista.setUint32(8, estado.semilla >>> 0, true);
  // El contador de ticks se parte en dos mitades de 32 bits: a x100 durante
  // años, un solo entero de 32 bits se quedaría corto.
  vista.setUint32(12, Math.floor(estado.tick / 4294967296) >>> 0, true);
  vista.setUint32(16, estado.tick >>> 0, true);
  vista.setUint32(20, estado.nivel | (estado.conCerebro ? 0 : BANDERA_SIN_CEREBRO), true);
  vista.setUint32(24, n, true);
  for (let i = 0; i < RNG_PALABRAS; i++) {
    vista.setUint32(28 + i * 4, estado.rng[i]!, true);
  }
  vista.setFloat64(44, estado.energiaEntrada, true);
  vista.setFloat64(52, estado.energiaSalida, true);
  // Sin esto, cargar un mundo cambiaba su futuro: la búsqueda de huecos libres
  // para las semillas empezaba desde cero y las plantas caían en otro sitio.
  vista.setUint32(60, estado.cursorPlanta, true);
  vista.setUint32(64, estado.cursorCriatura, true);
  vista.setUint32(68, estado.siguienteLinaje, true);

  // El caudal y la lluvia no se guardan: se recalculan enteros en cada tick.
  for (let i = 0; i < n; i++) {
    const c = BYTES_CABECERA + i * 4;
    vista.setInt32(c, estado.materia[i]!, true);
    vista.setFloat32(c + n * 4, estado.altura[i]!, true);
    vista.setFloat32(c + n * 8, estado.temperatura[i]!, true);
    vista.setInt32(c + n * 12, estado.aguaSuelo[i]!, true);
    vista.setInt32(c + n * 16, estado.humedadAire[i]!, true);
  }

  const plantas = BYTES_CABECERA + n * 4 * CAMPOS_POR_CELDA;
  for (let p = 0; p < MAX_PLANTAS; p++) {
    const c = plantas + p * 16;
    vista.setInt32(c, estado.plantaCelda[p]!, true);
    vista.setInt32(c + 4, estado.plantaMasa[p]!, true);
    vista.setInt32(c + 8, estado.plantaEdad[p]!, true);
    vista.setInt32(c + 12, estado.plantaFruto[p]!, true);
  }
  bytes.set(estado.plantaGenoma, plantas + MAX_PLANTAS * 16);

  const sopa = plantas + MAX_PLANTAS * BYTES_POR_PLANTA;
  for (let i = 0; i < n * N_TIPOS_ATOMO; i++) {
    vista.setInt32(sopa + i * 4, estado.atomosLibres[i]!, true);
  }
  const dimerosEn = sopa + n * N_TIPOS_ATOMO * 4;
  for (let i = 0; i < n * N_DIMEROS; i++) {
    vista.setInt32(dimerosEn + i * 4, estado.dimeros[i]!, true);
  }
  const moleculas = dimerosEn + n * N_DIMEROS * 4;
  for (let i = 0; i < n * TOP_N_MOLECULAS; i++) {
    vista.setInt32(moleculas + i * 8, estado.sopaMolecula[i]!, true);
    vista.setInt32(moleculas + i * 8 + 4, estado.sopaCantidad[i]!, true);
  }

  const cuerpos = moleculas + n * TOP_N_MOLECULAS * 8;
  for (let c = 0; c < MAX_CRIATURAS; c++) {
    const p = cuerpos + c * BYTES_CAMPOS_CRIATURA;
    vista.setInt32(p, estado.criaturaCelda[c]!, true);
    vista.setInt32(p + 4, estado.criaturaMateria[c]!, true);
    vista.setFloat32(p + 8, estado.criaturaEnergia[c]!, true);
    vista.setFloat32(p + 12, estado.criaturaDano[c]!, true);
    vista.setInt32(p + 16, estado.criaturaEdad[c]!, true);
    vista.setInt32(p + 20, estado.criaturaLinaje[c]!, true);
    vista.setInt32(p + 24, estado.criaturaGameto[c]!, true);
  }
  const temperaturas = cuerpos + MAX_CRIATURAS * BYTES_CAMPOS_CRIATURA;
  bytes.set(estado.criaturaGenoma, temperaturas);
  const cerebros = temperaturas + MAX_CRIATURAS * MAX_CADENA_GENOMA;
  for (let c = 0; c < MAX_CRIATURAS; c++) {
    let p = cerebros + c * BYTES_DE_CEREBRO;
    for (let i = 0; i < OCULTAS_EN_MEMORIA; i++, p += 4) {
      vista.setFloat32(p, estado.criaturaOculta[c * OCULTAS_EN_MEMORIA + i]!, true);
    }
    const nPesos = OCULTAS_EN_MEMORIA * N_SALIDAS_CEREBRO;
    for (let i = 0; i < nPesos; i++, p += 4) {
      vista.setFloat32(p, estado.criaturaPesosSalida[c * nPesos + i]!, true);
    }
    for (let i = 0; i < OCULTAS_EN_MEMORIA; i++, p += 4) {
      vista.setFloat32(p, estado.criaturaTrazaOculta[c * OCULTAS_EN_MEMORIA + i]!, true);
    }
    for (let i = 0; i < N_SALIDAS_CEREBRO; i++, p += 4) {
      vista.setFloat32(p, estado.criaturaTrazaSalida[c * N_SALIDAS_CEREBRO + i]!, true);
    }
    vista.setFloat32(p, estado.criaturaBienestar[c]!, true);
    p += 4;
    vista.setFloat32(p, estado.criaturaEsperado[c]!, true);
  }

  const celdasCuerpo = cerebros + MAX_CRIATURAS * BYTES_DE_CEREBRO;
  for (let i = 0; i < n; i++) {
    vista.setInt32(celdasCuerpo + i * 4, estado.carrona[i]!, true);
    vista.setInt32(celdasCuerpo + n * 4 + i * 4, estado.constanciaDelCiclo[i]!, true);
    for (let k = 0; k < 4; k++) {
      vista.setFloat32(celdasCuerpo + n * 8 + (i * 4 + k) * 4, estado.senalAire[i * 4 + k]!, true);
      vista.setFloat32(
        celdasCuerpo + n * 8 + n * 16 + (i * 4 + k) * 4,
        estado.marcaSuelo[i * 4 + k]!,
        true,
      );
    }
  }

  return bytes;
}

/**
 * Reconstruye un mundo desde sus bytes, migrándolo antes si viene de una
 * versión vieja del formato.
 */
export function deserializar(bytesEntrada: Uint8Array): EstadoMundo {
  if (bytesEntrada.byteLength < BYTES_CABECERA) {
    throw new Error('El archivo es demasiado corto para ser un mundo.');
  }

  const cabecera = new DataView(
    bytesEntrada.buffer,
    bytesEntrada.byteOffset,
    bytesEntrada.byteLength,
  );
  if (cabecera.getUint32(0, true) !== MARCA_ARCHIVO) {
    throw new Error('Este archivo no es un mundo de este proyecto.');
  }

  const bytes = migrar(bytesEntrada, cabecera.getUint32(4, true));
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const tickAlto = vista.getUint32(12, true);
  const tickBajo = vista.getUint32(16, true);
  const nivel = vista.getUint32(20, true) & ~BANDERA_SIN_CEREBRO;
  const n = vista.getUint32(24, true);

  if (n !== celdasDelNivel(nivel)) {
    throw new Error(`El archivo dice ${n} celdas, pero el nivel ${nivel} tiene ${celdasDelNivel(nivel)}.`);
  }
  if (
    bytes.byteLength <
    BYTES_CABECERA +
      n * 4 * CAMPOS_POR_CELDA +
      MAX_PLANTAS * BYTES_POR_PLANTA +
      n * BYTES_SOPA_POR_CELDA +
      MAX_CRIATURAS * BYTES_POR_CRIATURA +
      n * BYTES_CUERPOS_POR_CELDA
  ) {
    throw new Error('El archivo del mundo está incompleto o cortado.');
  }

  const rng = new Uint32Array(RNG_PALABRAS);
  for (let i = 0; i < RNG_PALABRAS; i++) {
    rng[i] = vista.getUint32(28 + i * 4, true);
  }

  const materia = new Int32Array(n);
  const altura = new Float32Array(n);
  const temperatura = new Float32Array(n);
  const aguaSuelo = new Int32Array(n);
  const humedadAire = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const c = BYTES_CABECERA + i * 4;
    materia[i] = vista.getInt32(c, true);
    altura[i] = vista.getFloat32(c + n * 4, true);
    temperatura[i] = vista.getFloat32(c + n * 8, true);
    aguaSuelo[i] = vista.getInt32(c + n * 12, true);
    humedadAire[i] = vista.getInt32(c + n * 16, true);
  }

  const plantasEn = BYTES_CABECERA + n * 4 * CAMPOS_POR_CELDA;
  const plantaCelda = new Int32Array(MAX_PLANTAS);
  const plantaMasa = new Int32Array(MAX_PLANTAS);
  const plantaEdad = new Int32Array(MAX_PLANTAS);
  const plantaFruto = new Int32Array(MAX_PLANTAS);
  const plantasEnCelda = new Int32Array(n);
  let vivas = 0;
  let masaVegetal = 0;
  for (let p = 0; p < MAX_PLANTAS; p++) {
    const c = plantasEn + p * 16;
    const celda = vista.getInt32(c, true);
    plantaCelda[p] = celda;
    plantaMasa[p] = vista.getInt32(c + 4, true);
    plantaEdad[p] = vista.getInt32(c + 8, true);
    plantaFruto[p] = vista.getInt32(c + 12, true);
    if (celda >= 0) {
      plantasEnCelda[celda] = plantasEnCelda[celda]! + 1;
      vivas++;
      masaVegetal += plantaMasa[p]! + plantaFruto[p]!;
    }
  }
  const genomaEn = plantasEn + MAX_PLANTAS * 16;
  const plantaGenoma = bytes.slice(genomaEn, genomaEn + MAX_PLANTAS * GENES_PLANTA);

  const sopaEn = plantasEn + MAX_PLANTAS * BYTES_POR_PLANTA;
  const atomosLibres = new Int32Array(n * N_TIPOS_ATOMO);
  for (let i = 0; i < atomosLibres.length; i++) {
    atomosLibres[i] = vista.getInt32(sopaEn + i * 4, true);
  }
  const dimerosDesde = sopaEn + n * N_TIPOS_ATOMO * 4;
  const dimeros = new Int32Array(n * N_DIMEROS);
  for (let i = 0; i < dimeros.length; i++) {
    dimeros[i] = vista.getInt32(dimerosDesde + i * 4, true);
  }
  const moleculasEn = dimerosDesde + n * N_DIMEROS * 4;
  const sopaMolecula = new Int32Array(n * TOP_N_MOLECULAS);
  const sopaCantidad = new Int32Array(n * TOP_N_MOLECULAS);
  for (let i = 0; i < sopaMolecula.length; i++) {
    sopaMolecula[i] = vista.getInt32(moleculasEn + i * 8, true);
    sopaCantidad[i] = vista.getInt32(moleculasEn + i * 8 + 4, true);
  }

  const cuerposEn = moleculasEn + n * TOP_N_MOLECULAS * 8;
  const criaturaCelda = new Int32Array(MAX_CRIATURAS);
  const criaturaMateria = new Int32Array(MAX_CRIATURAS);
  const criaturaEnergia = new Float32Array(MAX_CRIATURAS);
  const criaturaDano = new Float32Array(MAX_CRIATURAS);
  const criaturaEdad = new Int32Array(MAX_CRIATURAS);
  const criaturaLinaje = new Int32Array(MAX_CRIATURAS);
  const criaturaGameto = new Int32Array(MAX_CRIATURAS);
  const criaturaTemperatura = new Float32Array(MAX_CRIATURAS);
  let criaturasContadas = 0;
  for (let c = 0; c < MAX_CRIATURAS; c++) {
    const p = cuerposEn + c * BYTES_CAMPOS_CRIATURA;
    criaturaCelda[c] = vista.getInt32(p, true);
    criaturaMateria[c] = vista.getInt32(p + 4, true);
    criaturaEnergia[c] = vista.getFloat32(p + 8, true);
    criaturaDano[c] = vista.getFloat32(p + 12, true);
    criaturaEdad[c] = vista.getInt32(p + 16, true);
    criaturaLinaje[c] = vista.getInt32(p + 20, true);
    criaturaGameto[c] = vista.getInt32(p + 24, true);
    if (criaturaCelda[c]! >= 0) {
      criaturasContadas++;
      criaturaTemperatura[c] = temperatura[criaturaCelda[c]!]!;
    }
  }
  const genomaCriaturasEn = cuerposEn + MAX_CRIATURAS * BYTES_CAMPOS_CRIATURA;
  const criaturaGenoma = bytes.slice(
    genomaCriaturasEn,
    genomaCriaturasEn + MAX_CRIATURAS * MAX_CADENA_GENOMA,
  );
  const cerebrosEn = genomaCriaturasEn + MAX_CRIATURAS * MAX_CADENA_GENOMA;
  const nPesosSalida = OCULTAS_EN_MEMORIA * N_SALIDAS_CEREBRO;
  const criaturaOculta = new Float32Array(MAX_CRIATURAS * OCULTAS_EN_MEMORIA);
  const criaturaPesosSalida = new Float32Array(MAX_CRIATURAS * nPesosSalida);
  const criaturaTrazaOculta = new Float32Array(MAX_CRIATURAS * OCULTAS_EN_MEMORIA);
  const criaturaTrazaSalida = new Float32Array(MAX_CRIATURAS * N_SALIDAS_CEREBRO);
  const criaturaBienestar = new Float32Array(MAX_CRIATURAS);
  const criaturaEsperado = new Float32Array(MAX_CRIATURAS);
  for (let c = 0; c < MAX_CRIATURAS; c++) {
    let p = cerebrosEn + c * BYTES_DE_CEREBRO;
    for (let i = 0; i < OCULTAS_EN_MEMORIA; i++, p += 4) {
      criaturaOculta[c * OCULTAS_EN_MEMORIA + i] = vista.getFloat32(p, true);
    }
    for (let i = 0; i < nPesosSalida; i++, p += 4) {
      criaturaPesosSalida[c * nPesosSalida + i] = vista.getFloat32(p, true);
    }
    for (let i = 0; i < OCULTAS_EN_MEMORIA; i++, p += 4) {
      criaturaTrazaOculta[c * OCULTAS_EN_MEMORIA + i] = vista.getFloat32(p, true);
    }
    for (let i = 0; i < N_SALIDAS_CEREBRO; i++, p += 4) {
      criaturaTrazaSalida[c * N_SALIDAS_CEREBRO + i] = vista.getFloat32(p, true);
    }
    criaturaBienestar[c] = vista.getFloat32(p, true);
    p += 4;
    criaturaEsperado[c] = vista.getFloat32(p, true);
  }

  const celdasCuerpoEn = cerebrosEn + MAX_CRIATURAS * BYTES_DE_CEREBRO;
  const carrona = new Int32Array(n);
  const constanciaDelCiclo = new Int32Array(n);
  const senalAire = new Float32Array(n * 4);
  const marcaSuelo = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    carrona[i] = vista.getInt32(celdasCuerpoEn + i * 4, true);
    constanciaDelCiclo[i] = vista.getInt32(celdasCuerpoEn + n * 4 + i * 4, true);
    for (let k = 0; k < 4; k++) {
      senalAire[i * 4 + k] = vista.getFloat32(
        celdasCuerpoEn + n * 8 + (i * 4 + k) * 4,
        true,
      );
      marcaSuelo[i * 4 + k] = vista.getFloat32(
        celdasCuerpoEn + n * 8 + n * 16 + (i * 4 + k) * 4,
        true,
      );
    }
  }

  const estado: EstadoMundo = {
    semilla: vista.getUint32(8, true),
    tick: tickAlto * 4294967296 + tickBajo,
    rng,
    nivel,
    nCeldas: n,
    altura,
    materia,
    temperatura,
    aguaSuelo,
    humedadAire,
    flujoAgua: new Int32Array(n),
    lluvia: new Int32Array(n),
    viento: new Float32Array(n * 3),
    plantaCelda,
    plantaMasa,
    plantaEdad,
    plantaFruto,
    plantaGenoma,
    plantasEnCelda,
    cabezaPlantaEnCelda: cabezaVacia(n),
    siguientePlantaEnCelda: listaPlantasVacia(),
    cursorPlanta: vista.getUint32(60, true),
    plantasVivas: vivas,
    masaVegetal,
    atomosLibres,
    dimeros,
    sopaMolecula,
    sopaCantidad,
    escalaEnergiaQuimica: ESCALA_ENERGIA_QUIMICA,
    reaccionesEsteTick: 0,
    criaturaCelda,
    criaturaMateria,
    criaturaEnergia,
    criaturaDano,
    criaturaEdad,
    criaturaTemperatura,
    criaturaLinaje,
    criaturaGameto,
    criaturaGenoma,
    criaturaOculta,
    criaturaPesosSalida,
    criaturaTrazaOculta,
    criaturaTrazaSalida,
    criaturaBienestar,
    criaturaEsperado,
    cabezaEnCelda: cabezaVacia(n),
    siguienteEnCelda: listaVacia(),
    cursorCriatura: vista.getUint32(64, true),
    siguienteLinaje: vista.getUint32(68, true),
    senalAire,
    marcaSuelo,
    carrona,
    constanciaDelCiclo,
    criaturasVivas: criaturasContadas,
    nacimientosEsteTick: 0,
    cruzamientosEsteTick: 0,
    muertesEsteTick: 0,
    senalesEsteTick: 0,
    imitacionesEsteTick: 0,
    verbosEsteTick: new Int32Array(VERBOS.length),
    edadMediaDeMuerte: 0,
    topeDePoblacionTocado: false,
    conCerebro: (vista.getUint32(20, true) & BANDERA_SIN_CEREBRO) === 0,
    copiaEnteros: new Int32Array(n),
    copiaSenal: new Float32Array(n * 4),
    copiaOculta: new Float32Array(OCULTAS_EN_MEMORIA),
    sentidosDeTrabajo: new Float32Array(N_SENTIDOS),
    salidaDeTrabajo: new Float32Array(N_SALIDAS_CEREBRO),
    marcoDeTrabajo: new Float64Array(6),
    copiaDecimales: new Float32Array(n),
    energiaEntrada: vista.getFloat64(44, true),
    energiaSalida: vista.getFloat64(52, true),
  };

  // El índice de quién está en cada celda no se guarda: se deduce de dónde está
  // cada cuerpo, y sale exactamente igual que estaba.
  reconstruirIndiceDeCeldas(estado);
  return estado;
}

/**
 * Huella del mundo entero (FNV-1a de 32 bits sobre sus bytes).
 *
 * Es lo que usa el test de determinismo: dos corridas con la misma semilla
 * tienen que dar la misma huella tras diez mil ticks. Si difieren en un solo
 * bit, la huella lo delata.
 */
export function huellaEstado(estado: EstadoMundo): number {
  const bytes = serializar(estado);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** La rejilla del planeta para este estado. No se guarda: se reconstruye. */
export function geometriaDe(estado: EstadoMundo): Geometria {
  return construirGeometria(estado.nivel);
}
