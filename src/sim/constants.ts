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

/** Moléculas distintas que se siguen por celda. El resto son átomos sueltos. */
export const TOP_N_MOLECULAS = 24;

/** Átomos sueltos de cada tipo con los que arranca cada celda. */
export const ATOMOS_INICIALES_POR_TIPO = 160;

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

/** Cuánto multiplica la temperatura la probabilidad de que un enlace se rompa. */
export const ROTURA_POR_TEMPERATURA = 0.018;

/** Probabilidad base, entre mil, de que dos moléculas que se encuentran se unan. */
export const UNION_POR_MIL = 240;

/** Probabilidad base, entre mil, de que un átomo suelto sustituya a otro. */
export const SUSTITUCION_POR_MIL = 40;

/**
 * Cuánto multiplica un catalizador la probabilidad de una reacción.
 *
 * Este es **el número que decide si la fase 2 sale o no** (RIESGOS §2a). Sin
 * catálisis no hay autocatálisis y no hay nada: ninguna molécula influiría en
 * una reacción en la que no participa, y el mundo se quedaría en una sopa
 * inerte. Si no aparecen ciclos, esto es lo primero que se toca.
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
