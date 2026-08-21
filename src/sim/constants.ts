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
 * Cuántas veces se subdivide el icosaedro que forma el planeta.
 * Cada nivel multiplica las celdas por cuatro:
 *
 *   3 →    642 celdas      4 →  2.562 celdas      5 → 10.242 celdas
 *
 * Se usa 4 por la decisión D4: mundo chico y población densa. Con unas 500
 * criaturas hay una cada cinco celdas y los encuentros son constantes. En un
 * planeta de 10.242 serían bichos perdidos en un mundo vacío, y de un mundo de
 * ermitaños no hay nada que mirar.
 */
export const NIVEL_SUBDIVISION = 4;

/**
 * Vecinos máximos de una celda. Son seis, salvo doce celdas que tienen cinco:
 * los doce pentágonos que toda esfera cubierta de hexágonos necesita. No es un
 * defecto del método, es geometría — un balón de fútbol tiene los mismos doce.
 */
export const MAX_VECINOS = 6;

/** Radio del planeta en unidades de mundo. Solo afecta a las escalas de dibujo. */
export const RADIO_PLANETA = 1;

// ---------------------------------------------------------------------------
// Terreno
// ---------------------------------------------------------------------------

/** Capas de ruido que se suman. Más capas = más detalle y más coste. */
export const OCTAVAS_TERRENO = 5;

/** Cuánto pierde de fuerza cada capa respecto a la anterior. */
export const PERSISTENCIA_TERRENO = 0.5;

/** Cuánto se encoge cada capa respecto a la anterior. */
export const LACUNARIDAD_TERRENO = 2.0;

/**
 * Tamaño de los continentes. Más bajo = pocas masas grandes; más alto = muchas
 * islas pequeñas. Con 1.5 salen dos o tres continentes reconocibles.
 */
export const FRECUENCIA_CONTINENTES = 1.5;

/**
 * Nivel del mar, entre -1 y 1 sobre la altura cruda del ruido.
 * Subirlo ahoga el mundo; bajarlo lo seca. Con 0.02 sale en torno a un tercio
 * de tierra, que es lo que da costas largas — y las costas son donde se junta
 * todo.
 */
export const NIVEL_DEL_MAR = 0.02;

/**
 * Cuánto sobresale el relieve respecto al radio del planeta.
 *
 * Es exageración a propósito: con la altura real de las montañas de la Tierra,
 * un planeta de este tamaño se vería completamente liso. Medido sobre varias
 * semillas, la tierra llega a 0,67 de altura cruda, así que los picos quedan a
 * un 14 % del radio y las montañas se leen desde lejos. Con 0,12 el planeta
 * salía plano: los escalones de tierra adentro medían cuatro píxeles y no se
 * distinguían.
 */
export const ESCALA_RELIEVE = 0.21;

/**
 * Cuánto se aplasta la profundidad del fondo marino al dibujarlo.
 *
 * El fondo baja de verdad —tiene que quedar por debajo del océano para que el
 * agua lo tape— pero comprimido: el relieve abisal no se ve bajo el agua y sin
 * comprimir dejaría el planeta con el interior lleno de púas.
 */
export const COMPRESION_FONDO_MARINO = 0.35;

/**
 * El escalón de la orilla: lo poquito que se levanta la tierra más baja sobre
 * el nivel del mar.
 *
 * Es pequeño A PROPÓSITO, y es una corrección de un error. Estaba en 0,16 para
 * que los continentes se vieran como bloques con grosor, y el resultado fue que
 * **toda la costa del planeta era un acantilado infranqueable**: ningún bicho
 * podría bajar nunca al agua. Un mundo donde el mar es inalcanzable desde la
 * tierra pierde de golpe la orilla, que es el sitio donde más cosas se cruzan.
 *
 * Con 0,04 la tierra más baja queda a un paso del agua — eso es una playa — y
 * los acantilados aparecen solo donde una meseta alta se asoma al mar, que es
 * lo que pasa en las costas de verdad. El grosor de los continentes ya lo da el
 * hundido del fondo marino, no hace falta levantar la tierra para eso.
 *
 * Cuando en la fase 3 moverse entre celdas cueste según el desnivel, esta
 * diferencia será física real: por la playa se pasa, por el cantil no.
 */
export const ALZADO_DE_LA_ORILLA = 0.04;

/**
 * Cuánto se hunde todo el fondo marino por debajo del nivel del mar.
 *
 * Sin esto los bajíos quedan a la misma altura que la superficie del agua y
 * asoman por encima peleándose con ella.
 */
export const HUNDIDO_DEL_MAR = 0.14;

/**
 * Escalones de altura del terreno.
 *
 * La altura de cada celda se redondea a uno de estos escalones. No es un truco
 * estético: como cada celda es un prisma de tapa plana, dos celdas vecinas con
 * escalones distintos dejan un acantilado entre ellas. De ahí sale el aspecto
 * de mesetas y cantiles, y sale de la geometría, no de un filtro.
 *
 * Menos escalones = escalones más altos = mesetas más marcadas. Con 12 el
 * terreno quedaba demasiado suave para leerse desde lejos.
 */
export const ESCALONES_RELIEVE = 8;

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
// El reloj del cielo
//
// El día, las estaciones y los polos fríos NO son fórmulas: salen de girar la
// bola y de inclinarle el eje. Lo único que se declara acá es cuánto dura cada
// vuelta.
// ---------------------------------------------------------------------------

/**
 * Ticks que dura un día del planeta.
 *
 * No son 86.400 como en la Tierra a propósito: a tick de un segundo, un día
 * real serían 24 horas de mirar. Con 512 un día dura unos ocho minutos a
 * velocidad normal, y menos de un minuto a x10.
 */
export const TICKS_POR_DIA = 512;

/** Días que dura un año. Con 64, un año son 32.768 ticks. */
export const DIAS_POR_ANO = 64;

/** Derivado, no tocar a mano. */
export const TICKS_POR_ANO = TICKS_POR_DIA * DIAS_POR_ANO;

/**
 * Inclinación del eje del planeta, en vueltas (0,065 ≈ 23,4°, como la Tierra).
 *
 * Esto y nada más es lo que produce las estaciones: el punto donde el sol cae a
 * plomo sube y baja entre los dos trópicos a lo largo del año. Con 0 no habría
 * estaciones en ninguna parte; subiéndolo, los inviernos se vuelven brutales.
 */
export const INCLINACION_EJE_VUELTAS = 0.065;

// ---------------------------------------------------------------------------
// Temperatura
//
// En grados del mundo, elegidos para que el 0 sea donde el agua se congela.
// ---------------------------------------------------------------------------

/** Temperatura a la que arranca todo el planeta. */
export const TEMP_INICIAL = 14;

/** Agua congelada por debajo de esto: hielo en el mar y nieve en el suelo. */
export const TEMP_CONGELACION = 0;

/** A lo que tendería una celda que no viera el sol nunca. */
export const TEMP_ESPACIO = -70;

/**
 * Cuánto calienta el sol a plomo. Junto con la pérdida fija el clima:
 * la temperatura de equilibrio es TEMP_ESPACIO + insolación · GANANCIA / PÉRDIDA.
 * Un punto del ecuador recibe de media 0,32 a lo largo del día y un polo unas
 * 0,15 a lo largo del año, así que con 340 y un espacio a -70 salen unos 38° en
 * el ecuador y unos -19° en los polos: casquetes helados y trópicos calientes.
 */
export const GANANCIA_SOLAR = 340;

/** Cuánto calor se escapa al espacio por cada grado por encima de TEMP_ESPACIO. */
export const PERDIDA_RADIACION = 1;

/**
 * Inercia térmica: cuánto cuesta cambiar la temperatura de una celda.
 *
 * El agua tiene diez veces más que la tierra, y eso no es un detalle: es lo que
 * hace que el mar se caliente y se enfríe despacio, y por tanto que **las costas
 * tengan un clima mucho más suave que el interior**. Sale gratis de poner un
 * número distinto.
 */
export const CAPACIDAD_TERMICA_TIERRA = 4000;
export const CAPACIDAD_TERMICA_AGUA = 40000;

/**
 * Cuántos grados se pierden por cada unidad de altura sobre el nivel del mar.
 * Es el gradiente térmico de toda la vida: en la montaña hace más frío.
 *
 * Es una RESTA, no un multiplicador, y eso importa. Antes multiplicaba la
 * pérdida de calor por 2,2, y el resultado medido fue que una cumbre a media
 * altura se quedaba 56 grados por debajo del mar de al lado. Como el 40 % del
 * planeta es tierra, eso arrastraba la media global y congelaba el mundo entero:
 * el ecuador se quedaba a 5° y no había trópicos en ninguna parte.
 *
 * Con 45, el mar tropical queda a unos 38° y una cumbre de las altas a unos 11°.
 */
export const GRADIENTE_ALTURA = 45;

/**
 * Reparto de calor entre celdas vecinas. Es el viento y las corrientes juntos.
 *
 * Medido: con 45 el planeta salía **isotermo** — ecuador a -8° y polos a -12°,
 * o sea sin clima. El calor se repartía más rápido de lo que el sol tardaba en
 * crearlo, así que la bola entera se quedaba en la media global y no había ni
 * trópicos ni estaciones. Con 300 el reparto tarda mucho más que el tiempo que
 * tarda una celda en calentarse, y el gradiente sobrevive. Con 300 seguía
 * aplanándolo: el planeta entero se quedaba entre -33° y +5°, que es una bola
 * de nieve. Con 900 el reparto solo suaviza en vez de borrar.
 */
export const DIFUSION_TEMPERATURA_DIVISOR = 900;

// ---------------------------------------------------------------------------
// El viento
//
// Hasta ahora el calor y la humedad se repartían entre vecinas por igual en
// todas direcciones. Eso mezcla, pero no es viento: no fluye hacia ningún lado.
// Y sin flujo no hay tiempo meteorológico — medido, llovía en el 85 % del
// planeta a la vez, o sea llovizna de equilibrio en todas partes.
//
// El viento sale de dos cosas, ninguna inventada: el aire caliente pesa menos,
// así que va del sitio frío al caliente; y el planeta gira, así que lo que se
// mueve se desvía. De ahí salen los vientos dominantes y los remolinos.
// ---------------------------------------------------------------------------

/** Cuánto baja la presión por cada grado de más. El aire caliente pesa menos. */
export const PRESION_POR_GRADO = 1;

/** Cuánto baja la presión por altura. Arriba hay menos aire encima. */
export const PRESION_POR_ALTURA = 26;

/**
 * Cuánto desvía la rotación del planeta al aire que se mueve (Coriolis).
 *
 * Cero en el ecuador y máximo en los polos, y con el signo cambiado en cada
 * hemisferio. Es lo que impide que el viento vaya en línea recta del frío al
 * calor y lo que hace que las borrascas giren.
 */
export const DESVIO_POR_ROTACION = 1.7;

/** Qué parte de la humedad de una celda se lleva el viento en cada tick. */
export const ARRASTRE_DE_HUMEDAD = 0.34;

/** Qué parte de la diferencia de temperatura arrastra el viento en cada tick. */
export const ARRASTRE_DE_CALOR = 0.02;

// ---------------------------------------------------------------------------
// El ciclo del agua
//
// El agua es materia y se cuenta en enteros, como todo lo demás (D7): lo que se
// evapora sale de algún sitio y lo que llueve cae en otro. El total del planeta
// no cambia jamás, y hay un test que lo comprueba.
// ---------------------------------------------------------------------------

/**
 * Agua que lleva cada celda de mar al empezar.
 *
 * Muy grande a propósito: el océano tiene que ser un depósito casi inagotable
 * comparado con lo que cabe en el aire, como en la Tierra. Con 20.000 una celda
 * de mar se evaporaba entera en un solo día y el ciclo se volvía un vaivén
 * absurdo.
 */
export const AGUA_INICIAL_OCEANO = 200000;

/** Agua que lleva cada celda de tierra al empezar. */
export const AGUA_INICIAL_SUELO = 60;

/**
 * Gotas que evapora una celda por cada grado sobre el punto de congelación.
 * Con 4 el ciclo iba tan rápido que vaciaba el mar sobre la tierra.
 */
export const EVAPORACION_POR_GRADO = 3;

/** El suelo evapora bastante menos que el mar abierto. */
export const EVAPORACION_SUELO_FACTOR = 0.15;

/**
 * Cuánta agua aguanta el aire por cada grado de temperatura.
 *
 * El aire caliente aguanta más. Por eso llueve cuando el aire se enfría: al
 * subir por una montaña, al caer la noche, al llegar a los polos. No hay ninguna
 * regla de "llover en las montañas": la hay de que el aire frío no puede con
 * tanta agua.
 *
 * Medido: con 26, el aire a 20° aguantaba 520 gotas — más agua de la que había
 * en el suelo — así que casi nunca llovía sobre tierra templada y solo descargaba
 * en los polos y las cumbres. El continente se secaba de 29 a 14 gotas en diez
 * años y los ríos se morían. Con 6 el aire se satura pronto y suelta el agua
 * cerca de donde la cogió.
 */
export const HUMEDAD_POR_GRADO = 6;

/** Qué parte del exceso de humedad cae de golpe cuando llueve. */
export const LLUVIA_DIVISOR = 6;

/** El viento: reparto de humedad entre celdas vecinas. */
export const DIFUSION_HUMEDAD_DIVISOR = 5;

/**
 * Escorrentía: qué parte del agua del suelo baja a la celda vecina más baja.
 *
 * Es lo único que hay que escribir para que aparezcan ríos. Nadie dibuja un río:
 * es que por unas celdas pasa mucha más agua que por otras, y esas son las que
 * se ven azules.
 *
 * El número decide cuánto tiempo se queda el agua en tierra antes de volver al
 * mar. Con 2 se iba tan rápido que el continente se secaba y no daba tiempo a
 * que se formara ningún río.
 */
export const ESCORRENTIA_DIVISOR = 10;

/** Agua que el suelo retiene y no deja bajar. Por debajo de esto, no corre nada. */
export const RETENCION_DEL_SUELO = 20;

/**
 * Cuánto sube la superficie del agua por cada gota acumulada en una celda.
 *
 * Hace falta porque el agua no baja mirando la altura del terreno sino la de su
 * propia superficie: por eso un charco se extiende por una llanura plana en vez
 * de quedarse quieto. Sin esto, en un planeta de mesetas —donde media tierra
 * tiene los vecinos a su misma altura— el agua no encontraba ninguna celda más
 * baja y se quedaba encharcada para siempre. Medido: el suelo pasaba de 60 a
 * 8.189 gotas y ahí se quedaba, con el mar vaciándose encima de la tierra.
 *
 * Con 5e-4, una celda aguanta unas 250 gotas antes de desbordar al escalón de
 * abajo.
 */
export const ALTURA_POR_GOTA = 0.0005;

// ---------------------------------------------------------------------------
// Las plantas
//
// AVISO (decisión D19): esto es andamio provisional. Un hongo es un ser que no
// se mueve y come materia muerta; una planta, uno que no se mueve y come luz.
// Los dos tendrían que salir del mismo espacio de genomas que las criaturas, y
// tener "plantas" por un lado y "bichos" por otro es partir el árbol de la vida
// a mano. Cuando lleguen los cuerpos de la fase 3, esto se sustituye.
//
// Aun así ya evolucionan: las semillas heredan los genes de su madre con
// erratas, así que los linajes se adaptan al clima donde les tocó caer.
// ---------------------------------------------------------------------------

/** Tope de plantas vivas a la vez. Solo para que la memoria no se dispare. */
export const MAX_PLANTAS = 16000;

/** Plantas que caben en una celda. Cuando está llena, las semillas no prenden. */
export const MAX_PLANTAS_POR_CELDA = 12;

/** Genes que lleva una planta. */
export const GENES_PLANTA = 8;

/** Plantas con las que arranca el mundo, repartidas por la tierra. */
export const PLANTAS_INICIALES = 400;

/**
 * Materia con la que nace una semilla. Sale del cuerpo de la madre.
 * Con 4 una mala racha de diez ticks se llevaba por delante a cualquier brote.
 */
export const MASA_DE_SEMILLA = 10;

/** Masa a partir de la cual una planta puede dar fruto. */
export const MASA_PARA_FRUCTIFICAR = 60;

/** Fruto acumulado que hace falta para soltar una semilla. */
export const FRUTO_POR_SEMILLA = 30;

/**
 * Cuánta materia gana una planta por tick en las mejores condiciones.
 * Se multiplica por lo bien que le va: luz, agua y temperatura.
 */
export const CRECIMIENTO_MAXIMO = 3;

/** Agua que consume una planta por cada unidad de materia que gana. */
export const AGUA_POR_CRECIMIENTO = 2;

/**
 * Por debajo de esta viabilidad la planta no crece: se consume.
 * Es lo que mata los bosques cuando el clima cambia debajo de ellos.
 *
 * Ojo: la viabilidad es agua por temperatura, SIN la luz. Metiendo la luz aquí,
 * las plantas se morían de hambre todas las noches y el planeta se quedaba
 * pelado en menos de un año.
 */
export const IDONEIDAD_DE_SUPERVIVENCIA = 0.08;

/** Materia que pierde por tick una planta a la que no le van bien las cosas. */
export const DESGASTE_POR_INANICION = 1;

/** Ticks que vive una planta antes de morir de vieja, a igualdad de suerte. */
export const LONGEVIDAD_PLANTA = 90000;

/**
 * Cómo se traducen los genes de una planta a lo que su cuerpo puede hacer.
 * Son el rango de cada perilla, no valores de ninguna especie concreta.
 */
/** Sed mínima, y cuánto sube por cada punto del gen. */
export const SED_BASE = 10;
export const SED_POR_GEN = 0.8;
/** Rango de temperaturas que un linaje puede llegar a preferir, en grados. */
export const RANGO_TEMPERATURA_PREFERIDA = 40;
/** Tolerancia mínima a la temperatura, y cuánto la ensancha el gen. */
export const TOLERANCIA_BASE = 4;
export const TOLERANCIA_POR_GEN = 26;
/** Masa mínima de una planta, y cuánto sube el tope por cada punto del gen. */
export const MASA_MINIMA_PLANTA = 20;
export const MASA_POR_GEN_TAMANO = 3;

/** Probabilidad, entre mil, de que un gen mute al pasar a la semilla. */
export const MUTACION_POR_MIL = 55;

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

// ---------------------------------------------------------------------------
// LA QUÍMICA
//
// El único catálogo que el proyecto permite (CLAUDE.md §1.3): el alfabeto de
// átomos y las reglas de reescritura. Son pocas, son las leyes físicas del
// mundo y no cambian nunca. Toda la variedad sale del espacio de cadenas, no
// de esta tabla — con 6 átomos y cadenas de hasta 8 hay 1,7 millones de
// moléculas distintas posibles, y ninguna está escrita en ningún sitio.
// ---------------------------------------------------------------------------

/** Tipos de átomo. Es el alfabeto del mundo. */
export const N_TIPOS_ATOMO = 6;

/**
 * Longitud máxima de una molécula del ambiente, en átomos.
 *
 * Ocho y no doce por una razón de representación, y conviene que quede escrita:
 * una molécula tiene que caber en **un solo entero de 32 bits** para que el
 * bucle caliente no toque ni un objeto ni una cadena de texto. Con 6 tipos de
 * átomo hacen falta 3 bits por átomo, más 4 para la longitud: 8 átomos son 28
 * bits y entra; 12 serían 40 y no entra.
 */
export const MAX_CADENA_SOPA = 8;

/**
 * Afinidad de cada tipo de átomo, de 0 a 5.
 *
 * Dos átomos se unen bien cuando sus afinidades **se complementan** (suman lo
 * mismo que el alfabeto menos uno). Es el equivalente al emparejamiento de
 * bases: no hay tabla de qué se une con qué, hay un número por átomo y una
 * regla.
 */
export const AFINIDAD_ATOMO = [0, 1, 2, 3, 4, 5];

/**
 * Energía que suelta cada tipo de átomo al formar un enlace, y que hay que
 * devolverle para romperlo. Va y viene de la temperatura de la celda.
 */
export const ENERGIA_ENLACE_ATOMO = [0.6, 1.4, 0.9, 2.1, 1.1, 1.7];

/**
 * Lo que aguanta cada átomo el calor antes de que sus enlaces se rompan.
 * Los inestables son los que hacen que la sopa no se quede quieta.
 */
export const ESTABILIDAD_ATOMO = [1.0, 2.4, 1.6, 3.0, 1.3, 2.0];

/**
 * Dímeros posibles: todas las parejas ordenadas del alfabeto. Derivado.
 *
 * Los dímeros tienen su propio cajón, aparte de las ranuras del top-N, y eso
 * arregló un tope medido: con 6 tipos de átomo solo hay 36 dímeros posibles, así
 * que caben todos en un array denso sin filtro ninguno.
 *
 * Antes competían por las 24 ranuras y las acaparaban — 573.560 copias de largo
 * 2 frente a 35.611 de largo 3, con el 100 % de las ranuras ocupadas. Una cadena
 * larga nace rara y la desalojaban antes de que pudiera acumularse, así que el
 * largo medio se quedaba clavado en 2,22 hiciera lo que hiciera con las tasas de
 * reacción. Era el riesgo escrito en RIESGOS §2b: el recorte de rendimiento
 * filtrando justo el fenómeno que la fase busca.
 */
export const N_DIMEROS = N_TIPOS_ATOMO * N_TIPOS_ATOMO;

/** Moléculas de tres átomos o más que se siguen por celda. */
export const TOP_N_MOLECULAS = 24;

/**
 * Átomos sueltos de cada tipo con los que arranca cada celda.
 *
 * **Este número resultó ser el que decide si el mundo tiene una química o
 * muchas**, y no era el que yo esperaba.
 *
 * Con 160 el alimento sobraba: cada molécula llegaba a su nivel de equilibrio
 * sin estorbar a las demás, así que **todas las celdas del planeta convergían a
 * la misma sopa** — 7 moléculas dominantes distintas en 2.562 celdas — y las
 * autocatalíticas eran siempre las mismas 14 en cualquier semilla.
 *
 * Con 26 el alimento escasea, y entonces los ciclos autocatalíticos **compiten
 * por él**. El que se adelanta en una celda se lleva los átomos y ahoga a los
 * demás, así que el ganador depende de quién tuvo suerte primero. Medido:
 *
 *   moléculas dominantes distintas entre celdas    7  →  548
 *   largo medio de cadena                       2,22  →  6,16
 *   autocatalíticas propias de una sola semilla    0  →  34 de 88
 *
 * La lección, que vale para todo el proyecto: **sin escasez no hay competencia,
 * y sin competencia no hay historia.** Todo el mundo llega al mismo sitio.
 *
 * Antes se probó bajar la difusión química creyendo que era ella la que
 * homogeneizaba el planeta. No lo era: con difusión lenta salían 534 dominantes
 * y con rápida 548. La difusión no pintaba nada.
 */
export const ATOMOS_INICIALES_POR_TIPO = 26;

/**
 * Intentos de reacción por celda y tick.
 *
 * NO se prueban todas las parejas posibles: con 24 moléculas por celda serían
 * 576 parejas por 24 catalizadores candidatos, que son 35 millones de
 * comprobaciones por tick en el planeta entero. En vez de eso se tiran unos
 * pocos dados por celda, con las moléculas más concentradas saliendo más a
 * menudo. Es lo mismo que hace la química de verdad: las reacciones ocurren
 * cuando dos cosas se chocan, y se chocan más las que abundan.
 */
export const INTENTOS_DE_REACCION = 8;

/**
 * Cuánto multiplica la temperatura la probabilidad de que un enlace se rompa.
 *
 * Medido con 0,018 y afinidad graduada: el largo medio de las cadenas caía de
 * 2,77 a 2,11 y todo lo interesante eran dímeros. Al dejar de haber puerta de
 * "encaja o no encaja" se forman muchos más enlaces flojos, y si además se
 * rompen rápido, nada llega a crecer. Bajarlo deja que las cadenas bien hechas
 * duren lo suficiente para construir algo encima.
 */
export const ROTURA_POR_TEMPERATURA = 0.0035;

/**
 * Cuánto penaliza que dos átomos no sean la pareja perfecta.
 *
 * La probabilidad de que se unan se divide por (1 + desajuste² · esto). Con 2,
 * la pareja perfecta se une 1 vez de cada 1, la siguiente 1 de cada 3, y la peor
 * 1 de cada 51. Raro, pero **nunca imposible**: ahí está la diferencia entre un
 * mundo que explora y uno que cristaliza siempre en lo mismo.
 */
export const PENALIZACION_POR_DESAJUSTE = 2;

/**
 * Cuánto debilita el desajuste al enlace ya formado.
 *
 * Un enlace mal emparejado se rompe antes. No es una regla aparte: es la misma
 * idea vista del otro lado, y es lo que impide que el mundo se llene de cadenas
 * raras permanentes. Las cadenas raras existen, pero de paso.
 *
 * Sube a la vez que baja ROTURA_POR_TEMPERATURA, y a propósito: lo que se busca
 * no es que se rompa menos todo, sino que **se rompa menos lo bien hecho y siga
 * rompiéndose lo chapucero**. Si no, el mundo se llena de cadenas basura largas.
 */
export const DEBILIDAD_POR_DESAJUSTE = 1.6;

/**
 * Desajuste máximo que aún permite hacer de catalizador.
 *
 * Medido con 1: pasaban a contar como autocatalíticas cosas tan triviales como
 * `DD` o `CC`, porque con holgura casi cualquier par de átomos hace de
 * plantilla de casi cualquier enlace. Y si todo cataliza todo, "catalizador"
 * deja de significar nada y el detector infla el resultado.
 *
 * Con 0 la plantilla tiene que ser el complemento exacto. Es exigente, pero con
 * miles de moléculas distintas dando vueltas hay de sobra que lo cumplan — y
 * cuando el detector dice "autocatalítica", quiere decir algo.
 */
export const TOLERANCIA_DEL_CATALIZADOR = 0;

/**
 * Probabilidad base, entre mil, de que dos moléculas que se encuentran se unan.
 *
 * Junto con ROTURA_POR_TEMPERATURA decide **el largo medio de las cadenas**, y
 * eso resultó importar más que ninguna otra cosa. Enumerando todas las cadenas
 * posibles: de largo 3 solo 6 de 216 pueden catalizarse a sí mismas, y de largo
 * 4 son 102 de 1.296. Con el mundo parado en largo medio 2,2 solo alcanzaba las
 * 12 primeras — y por eso salían siempre las mismas en todas las semillas.
 *
 * No era que el mundo no explorara: es que no llegaba a donde hay algo que
 * explorar.
 *
 * Y hay una segunda razón para que este número sea BAJO, que es la importante:
 * con 620 y un empuje de catalizador de ×14, la probabilidad de una reacción
 * catalizada salía 8.680 sobre 1.000. O sea, **siempre**. El catalizador estaba
 * saturado y no daba ninguna ventaja real, así que ninguna molécula podía
 * imponerse sobre las demás por catalizarse mejor. Con la unión base baja, ser
 * catalizado sí decide, y ahí es donde puede aparecer un ganador.
 */
export const UNION_POR_MIL = 45;

/** Probabilidad base, entre mil, de que un átomo suelto sustituya a otro. */
export const SUSTITUCION_POR_MIL = 40;

/**
 * Cuánto multiplica un catalizador la probabilidad de una reacción.
 *
 * Sin catálisis no hay autocatálisis y no hay nada: ninguna molécula influiría
 * en una reacción en la que no participa, y el mundo se quedaría en una sopa
 * inerte.
 *
 * CUIDADO CON SATURARLO: la probabilidad final es UNION_POR_MIL · empuje ·
 * facilidad sobre mil, así que con UNION_POR_MIL por encima de **71** el
 * producto pasa de mil y el catalizador deja de dar ninguna ventaja — está
 * siempre al máximo. Eso pasó de verdad: con la unión a 620 el empuje ×14 daba
 * 8.680 sobre 1.000, o sea siempre, y ninguna molécula podía imponerse por
 * catalizarse mejor que otra. Un multiplicador saturado es un mecanismo que
 * parece que está y no está.
 */
export const EMPUJE_DEL_CATALIZADOR = 14;

/**
 * Cuánto calienta o enfría la química a la celda donde ocurre.
 *
 * Formar un enlace suelta energía y romperlo la consume, y esa energía sale y
 * entra de la temperatura local. El número es pequeño a propósito: con 8
 * intentos por celda y tick, un valor grande haría que la sopa se calentara a sí
 * misma hasta hervir el planeta.
 */
export const ESCALA_ENERGIA_QUIMICA = 0.004;

/**
 * En cuántos lotes se reparte la química.
 *
 * Cada tick solo reacciona una celda de cada LOTES; las demás esperan su turno.
 * Es la aplicación literal de la regla del proyecto (CLAUDE.md §2.4): **si no
 * cabe, se recorta la química antes que los bichos.**
 *
 * Medido sin lotes: el tick costaba 13,35 ms de los 16 de presupuesto, y 11,22
 * eran la química sola — con el mundo todavía sin una sola criatura y sin un
 * solo cerebro, que es donde estaba la estimación peligrosa (RIESGOS §4). Con 8
 * lotes la química baja a algo más de un milisegundo y deja el presupuesto casi
 * entero libre para lo que viene.
 *
 * El reparto es **función del número de tick**, nunca de la cámara, del
 * framerate ni de si hay una pestaña abierta mirando (CLAUDE.md §2.1). Lo que
 * cambia es que la química corre ocho veces más despacio que el resto del
 * mundo, y eso hay que tenerlo en cuenta al leer sus tiempos.
 */
export const LOTES_DE_QUIMICA = 8;

/** Difusión de moléculas entre celdas vecinas. Más alto = más lenta. */
export const DIFUSION_QUIMICA_DIVISOR = 12;

/** Cada cuántos ticks se busca si hay ciclos autocatalíticos vivos. */
export const DETECTAR_CICLOS_CADA = 512;

/** Reacciones que se recuerdan para buscar ciclos. Es una ventana, no un historial. */
export const MEMORIA_DE_REACCIONES = 4096;

// ---------------------------------------------------------------------------
// LOS CUERPOS
//
// El puente de la química a los cuerpos es el ÚNICO punto del proyecto donde el
// resultado lo decide una regla mía (decisión D1). Va escrito así, sin
// disfrazarlo de emergencia. Lo que sigue siendo enteramente emergente es qué
// ciclo aparece, cuándo, con qué genoma, y absolutamente todo lo que pase
// después de nacer.
// ---------------------------------------------------------------------------

/**
 * Tope de criaturas vivas. Es una red de seguridad para la memoria, **no una
 * regla del mundo**, y por eso importa que nunca llegue a tocarse: mientras lo
 * toque, la población la decide este número y no la escasez de comida.
 *
 * Estaba en 1.200 y sí mandaba: en la semilla 1234 el mundo se quedaba clavado
 * en 1.195 de 1.200. Subiéndolo a 8.000 para ver qué pasaba, los picos medidos a
 * 40.000 ticks fueron 1.521, 1.249, 26 y 1.680 según la semilla, y la población
 * se frenaba sola. O sea que el mundo se limita solo y el tope sobraba.
 *
 * 3.000 deja un 70 % de margen sobre el pico más alto medido con las constantes
 * definitivas (1.776, semilla 1234 a 8.000 ticks). Cuesta 24 MB de genomas y
 * recorrer ranuras vacías. Si algún mundo llega a tocarlo,
 * `topeDePoblacionTocado` lo dice y hay que subirlo, nunca recortar en silencio.
 */
export const MAX_CRIATURAS = 3000;

/**
 * Copias que tiene que sostener un ciclo autocatalítico en una celda para
 * condensarse en un cuerpo.
 *
 * Es el umbral del puente. Subirlo hace la vida más rara; bajarlo llena el
 * planeta de bichos el primer día.
 *
 * CUATRO, y no doscientos sesenta como se puso al principio. La razón es que la
 * escasez de alimento cambió la escala de todo: con 156 átomos por celda, la
 * copia más numerosa de cualquier molécula en una celda es **4**, y la mediana
 * de la mejor autocatalítica es 2. Pedir 260 era pedir algo imposible, y el
 * planeta se quedó sin una sola criatura en cincuenta mil ticks. Un umbral
 * heredado de otra escala es una puerta cerrada con llave.
 */
export const UMBRAL_DEL_PUENTE = 4;

/** Ticks seguidos que hay que sostenerlo. Un pico pasajero no basta. */
export const CONSTANCIA_DEL_PUENTE = 400;

/** Cada cuántos ticks se mira si alguna celda cruza el puente. */
export const MIRAR_EL_PUENTE_CADA = 64;

/** Materia que se lleva un cuerpo al condensarse. Sale de la celda. */
export const MATERIA_AL_NACER = 90;

/** Energía con la que arranca un cuerpo recién condensado. */
export const ENERGIA_AL_NACER = 120;

// --- Cómo se lee el genoma --------------------------------------------------

/**
 * Átomos que se promedian para leer un rasgo.
 *
 * Una ventana ancha hace que un rasgo cambie poco con cada mutación: hacen falta
 * varias erratas para moverlo. Eso es lo que permite que el instinto y la forma
 * del cuerpo se acumulen despacio a lo largo de generaciones en vez de saltar de
 * golpe (RIESGOS §3).
 */
export const VENTANA_DE_RASGO = 24;

/**
 * Átomos que se promedian para sacar el color con el que se pinta un cuerpo.
 *
 * Ojo: **no es un rasgo**, es una proyección del genoma para el ojo, y no la
 * lee nadie dentro del mundo. Ancha por lo mismo que las ventanas de rasgo: para
 * que el color de un linaje no dé saltos con cada errata, y para que cambiar de
 * color quiera decir de verdad que el genoma se ha ido lejos.
 */
export const VENTANA_DE_TINTE = 64;

/** Probabilidad, entre diez mil, de que un átomo del genoma se copie mal. */
export const ERRATA_POR_DIEZ_MIL = 9;

// --- Vivir y morir ----------------------------------------------------------

/** Energía que consume por tick un cuerpo de tamaño medio sin hacer nada. */
export const METABOLISMO_BASE = 0.30;

/** Cuánta energía extra cuesta moverse una celda. */
export const COSTE_DE_MOVERSE = 1.4;

/** Cuánta energía cuesta morder. */
export const COSTE_DE_MORDER = 0.8;

/** Cuánta energía cuesta emitir una señal. Nunca se premia emitir, solo cuesta. */
export const COSTE_DE_EMITIR = 0.45;

/** Cuánta energía cuesta rascar el suelo. */
export const COSTE_DE_RASCAR = 0.25;

/** Energía que da cada unidad de materia comida. */
export const ENERGIA_POR_BOCADO = 2.6;

/** Materia que arranca un mordisco. */
export const MATERIA_POR_MORDISCO = 6;

/** Daño que hace un mordisco a otro cuerpo. */
export const DANO_POR_MORDISCO = 9;

/** Daño a partir del cual un cuerpo se muere. */
export const DANO_MORTAL = 100;

/**
 * Energía que cuesta cerrar un punto de daño (decisión D13).
 * Curarse no es gratis: se paga con comida, así que un bicho herido y con hambre
 * tiene que elegir.
 */
export const ENERGIA_POR_CURARSE = 2.2;

/** Puntos de daño que se cierran por tick, como mucho. */
export const CURACION_POR_TICK = 0.12;

/** Energía por debajo de la cual no se cura: primero comer. */
export const ENERGIA_PARA_CURARSE = 45;

/** Grados fuera de su rango que aguanta un cuerpo antes de empezar a sufrir. */
export const MARGEN_TERMICO = 16;

/** Daño por tick y por grado fuera del margen. */
export const DANO_POR_GRADO = 0.09;

/** Materia que se excreta por tick. Vuelve al suelo de la celda. */
export const EXCRECION_POR_TICK = 1;

// --- Cómo se lee un cuerpo -------------------------------------------------
//
// Cada rasgo del genoma sale entre 0 y 1, y estas constantes lo estiran hasta lo
// que significa en el mundo. El mínimo es lo que le toca a quien sacó 0 en ese
// gen, y el rango, cuánto más puede sacar quien sacó 1. Ninguna de estas
// perillas premia ninguna conducta: solo dicen cómo de grande, cómo de rápido o
// cómo de aguantador puede llegar a ser un cuerpo.

/**
 * Ticks que vive quien sacó 0 en el gen de longevidad, y cuánto más da sacar 1.
 *
 * AVISO: **hoy este gen no hace nada y hay que decirlo.** Medido en la semilla
 * 1234 a los 20.000 ticks, la longevidad mediana salía en 16.583 ticks y la edad
 * mediana al morir en 328: nadie se muere de viejo, todos se mueren de hambre o
 * de daño mucho antes. O sea que la selección no puede tocar este gen, porque
 * nunca se nota si lo tienes alto o bajo.
 *
 * Es el mismo tipo de fallo que el multiplicador del catalizador saturado de la
 * fase 2: un mecanismo que parece estar y no está. Se arregla bajando estos dos
 * números hasta que la vejez llegue a matar a alguien, pero eso es un
 * experimento con su medición, no un retoque. Anotado y pendiente.
 */
export const LONGEVIDAD_MINIMA = 2500;
export const RANGO_DE_LONGEVIDAD = 26000;

/**
 * Temperatura que prefiere quien sacó 0 en ese gen, en grados, y cuántos grados
 * más arriba puede preferirla quien sacó 1.
 */
export const TEMPERATURA_PREFERIDA_MINIMA = -6;
export const RANGO_TEMPERATURA_CUERPO = 40;

/** Tamaño de quien sacó 0 en el gen de tamaño, y cuánto más da sacar 1. */
export const TAMANO_MINIMO = 0.5;
export const RANGO_DE_TAMANO = 2;

/** Ritmo metabólico de quien sacó 0 en ese gen. El gen suma hasta 1 más. */
export const RITMO_MINIMO = 0.4;

/**
 * Cuánto se acerca por tick la temperatura del cuerpo a la de fuera.
 * Es la inercia térmica: con 0 el cuerpo no siente el clima y con 1 lo copia
 * entero en un tick.
 */
export const INERCIA_TERMICA_DEL_CUERPO = 0.06;

/** Aguante al dolor de quien sacó 0 en ese gen. El gen suma hasta 1 más. */
export const AGUANTE_MINIMO = 0.5;

/**
 * Qué parte de un bocado aprovecha quien sacó 0 en el gen de esa dieta.
 * No hay herbívoros ni carnívoros declarados: son los dos extremos del mismo
 * gen, y un linaje puede recorrer el camino de uno al otro.
 */
export const EFICACIA_MINIMA_DIETA = 0.25;

// --- Los cinco verbos tirando los dados (andamio de la fase 3) --------------
//
// En la fase 3 no hay cerebro: cada tick se tiran los dados y sale lo que sale.
// Esto NO es un comportamiento, es lo contrario: es la línea base contra la que
// se medirá si los cerebros de la fase 4 sirven de algo. Sin esta comparación,
// "se mueven con sentido" sería una impresión y no un dato. Estas cuatro
// probabilidades desaparecen cuando el cerebro decida.

export const PROB_MOVER = 0.35;
export const PROB_MORDER = 0.30;
export const PROB_EMITIR = 0.10;
export const PROB_RASCAR = 0.06;

// --- Reproducción -----------------------------------------------------------

/** Energía a partir de la cual un cuerpo puede desprender una cría. */
export const ENERGIA_PARA_GEMAR = 260;

/** Materia que se lleva la cría. Sale del cuerpo de la madre, no de la nada. */
export const MATERIA_DE_LA_CRIA = 45;

/** Energía que se lleva la cría. */
export const ENERGIA_DE_LA_CRIA = 90;

// --- Las escalas de los sentidos -------------------------------------------
//
// Los sentidos salen entre -1 y 1, y estos números dicen qué cuenta como
// "mucho" para cada cosa. No son perillas del mundo: no cambian ni un átomo de
// lo que pasa, solo cómo de fino distingue un cuerpo entre poco y mucho. Aun así
// van aquí, porque un número suelto dentro de la lógica es un parámetro
// escondido aunque no empuje nada (§1.7).

/** Comida en una celda vecina que ya se considera un olor fuerte. */
export const ESCALA_DE_OLFATO = 100;

/** Comida en todo el vecindario que ya se considera un sitio abundante. */
export const ESCALA_DE_ABUNDANCIA = 400;

/** Cuerpos alrededor que ya se consideran un montón. */
export const ESCALA_DE_GENTIO = 4;

/**
 * Por debajo de esto, dos direcciones se consideran la misma y hace falta
 * elegir otro eje para armar el marco local.
 *
 * Pasa justo en los polos del planeta, donde la vertical del sitio y el eje con
 * el que se cruza apuntan a lo mismo. No es un caso especial del mundo: es que
 * en un punto de una esfera hay que decidir de dónde se mide.
 */
export const EJES_DEMASIADO_JUNTOS = 1e-8;

// --- El canal: señales en el aire y marcas en el suelo ----------------------
//
// Esto es el corazón del proyecto y hasta ahora no existía. Emitir una señal
// costaba energía y **no dejaba rastro en ninguna parte**: el canal era
// físicamente incapaz de llevar una sola cosa. Rascar el suelo igual.
//
// Lo que hay ahora son dos campos de cuatro números por celda. Ninguno de los
// dos significa nada: son cuatro números. Si alguna vez una nube de valores se
// repite en las mismas situaciones, eso sería una palabra, y la habrán hecho
// ellos. Aquí solo está el aire donde cabe el sonido.
//
// La diferencia entre los dos es el tiempo que duran, y es toda la diferencia:
// una señal es un grito y una marca es un monumento.

/**
 * Qué parte de la señal en el aire queda de un tick al siguiente, por mil.
 *
 * Baja: un grito dura poco. Si durara, el aire se llenaría de ruido viejo y
 * nada de lo que se dijera se distinguiría de lo que se dijo hace un rato.
 */
export const PERMANENCIA_SENAL_POR_MIL = 620;

/**
 * Qué parte de la señal se reparte a las celdas vecinas, por mil.
 *
 * Que se reparta es lo que hace que el canal sirva para algo: el que vio el
 * peligro y el que no lo ve están en celdas distintas. Si la señal se quedara
 * quieta, avisar solo llegaría a quien ya está mirando lo mismo que tú.
 */
export const REPARTO_SENAL_POR_MIL = 180;

/**
 * Qué parte de la marca del suelo queda de un tick al siguiente, por mil.
 *
 * Alta: una marca dura. Ahí está la diferencia con la señal — algo rascado en
 * el suelo sigue estando cuando el que lo rascó ya se ha ido o se ha muerto.
 * Es la única forma que hay en este mundo de dejar algo escrito.
 */
export const PERMANENCIA_MARCA_POR_MIL = 997;

/** Cuánto marca un rascado. La marca se suma a lo que ya hubiera en la celda. */
export const FUERZA_DEL_RASCADO = 0.35;

/** Cuánto suena una señal recién emitida. */
export const FUERZA_DE_LA_SENAL = 1;

/**
 * Por debajo de esto, un campo se pone a cero en vez de arrastrar decimales
 * cada vez más pequeños para siempre.
 *
 * No es un detalle de limpieza: sin esto, cada celda por la que pasó alguien
 * hace mil ticks seguiría teniendo un número minúsculo distinto de cero, y el
 * estado del mundo no volvería a repetirse nunca aunque no pasara nada.
 */
export const SILENCIO = 0.0005;

// --- Sexo, y por tanto especies --------------------------------------------
//
// No hay un verbo "aparearse" y no lo va a haber (CLAUDE.md §1.2): esto es
// contacto más química. Dos cuerpos que están en la misma celda y que los dos
// tienen de sobra para costear una cría juntan sus gametos, y si las dos cadenas
// se parecen bastante, los gametos se funden. Nadie elige, nadie corteja y a
// nadie se le premia por hacerlo: cuesta materia y energía, como todo.
//
// De aquí salen las especies, y por eso los dos números de abajo son los más
// delicados del archivo. Medido en la semilla 1234 a los 8.000 ticks: las 1.114
// criaturas vivas se parecen entre ellas entre 0,962 y 1,000 (mediana 0,983), y
// dos genomas al azar se parecen 0,328. O sea que una población sana vive muy
// arriba, el suelo está muy abajo, y hay un hueco enorme en medio donde poner el
// umbral sin partir en dos nada que esté vivo.
//
// La cuenta de cuánto tarda en pasar algo, para no engañarse: con
// ERRATA_POR_DIEZ_MIL = 9, dos linajes separados se alejan un 0,18 % por
// generación. Bajar de 0,98 a 0,80 pide unas cien generaciones **aisladas**, que
// en este mundo son unos treinta mil ticks. Puede pasar en una corrida larga y
// puede no pasar nunca. Lo que NO se va a hacer es subir la tasa de mutación
// para que la especiación salga a la hora que a mí me convenga.

/**
 * Por debajo de este parecido, dos gametos no se funden jamás. Es la definición
 * operativa de "especies distintas", y no hay ninguna otra en el proyecto.
 */
/**
 * Materia que un cuerpo aparta en un gameto, y lo que le cuesta apartarla.
 *
 * La mitad de una cría, porque una cría de dos se hace con los dos gametos y
 * nada más. Que sea mucho más barato que gemar es lo que hace que el sexo pueda
 * llegar a pasar: un cuerpo con un poco de sobra ya lleva gameto puesto y anda
 * por el mundo con él, mientras que para desprender una cría uno solo hace falta
 * un excedente grande. Sin esa diferencia, el gameto se gastaría en el mismo
 * tick en que se fabrica y volveríamos a los 18 cruces de 19.519 nacimientos.
 */
export const MATERIA_DEL_GAMETO = 23;

/**
 * Lo que cuesta empaquetar el gameto.
 *
 * Bajo a propósito: la materia ya la tenía el cuerpo, esto es solo apartarla. La
 * primera versión cobraba 12 y en una economía tan justa como esta eso bastaba
 * para matar el mundo entero.
 */
export const ENERGIA_DEL_GAMETO = 2;

export const PARECIDO_MINIMO_PARA_CRUZAR = 0.75;

/**
 * Por encima de este parecido, los gametos se funden siempre.
 *
 * Entre los dos números la probabilidad sube en rampa, y esa rampa **es** la
 * fertilidad parcial de los híbridos: dos poblaciones que se están separando
 * pasan por un tramo largo en el que cruzarse todavía se puede pero cuesta, en
 * vez de haber un día en que de golpe dejan de poder. No hace falta ninguna
 * regla aparte para los híbridos: un híbrido tiene el genoma a medio camino, así
 * que se parece medianamente a los dos lados y le pasa lo mismo que a todos.
 */
export const PARECIDO_SEGURO_PARA_CRUZAR = 0.85;

/**
 * Átomos que se miran para calcular el parecido entre dos gametos.
 *
 * Menos que los 800 del análisis a posteriori porque esto se calcula dentro del
 * bucle. Con 128 puntos el error de muestreo anda por el 4 %, que al lado del
 * hueco que hay entre 0,75 y 0,96 no cambia ninguna decisión.
 */
export const MUESTRAS_DE_GAMETO = 128;

/**
 * Largo medio de un tramo heredado de golpe de un progenitor, en átomos.
 *
 * Tiene que ser mayor que VENTANA_DE_RASGO (24) o la recombinación no serviría
 * de nada: si los tramos fueran más cortos que la ventana con la que se lee un
 * rasgo, cada rasgo de la cría saldría siempre en el punto medio de sus padres.
 * Con tramos largos, un rasgo puede venir entero de uno de los dos y aparecen
 * combinaciones que no tenía ninguno.
 */
export const LARGO_DE_TRAMO = 300;

/**
 * Cuántas criaturas mira el detector de especies.
 *
 * Compara todas contra todas, así que el coste va al cuadrado. No es simulación:
 * es telemetría, se llama cuando se quiere mirar y no cada tick.
 */
export const MUESTRAS_DE_ESPECIES = 240;

/**
 * Edad mínima para poder reproducirse, en ticks. El gen de la fertilidad la
 * multiplica por un factor entre 0,4 y 2, así que el rango real va de 48 a 240
 * ticks.
 *
 * Estaba en 700 y **la reproducción no disparaba nunca**: medido en la semilla
 * 1234 a los 20.000 ticks, la edad mediana al morir era 328 ticks y la edad
 * fértil mediana 793. Pedía madurar al doble de lo que este mundo deja vivir.
 * Ninguna de las 95 criaturas vivas cumplía las tres condiciones a la vez.
 *
 * No se tocó ni la energía ni la materia que exige gemar: esas dos sí filtran
 * de verdad (las pasaban 35 y 30 de 95) y esa escasez es lo que hace que haya
 * competencia. Lo que estaba mal era pedir una madurez que el mundo no permite
 * alcanzar.
 */
export const EDAD_REPRODUCTIVA = 120;

/** Factor de la edad fértil de quien sacó 0 en ese gen, y cuánto más da sacar 1. */
export const FERTILIDAD_MINIMA = 0.4;
export const RANGO_DE_FERTILIDAD = 1.6;

// --- Carroña ----------------------------------------------------------------

/** Qué parte de la carroña se pudre y vuelve al suelo cada tick, como divisor. */
export const PUDRICION_DIVISOR = 900;

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
