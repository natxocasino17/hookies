# Plan de fases

Una fase por sesión, en orden. Ninguna fase se cierra sin cumplir su criterio
de aceptación **medible**. Donde la especificación daba un criterio subjetivo
("se ve cambiar con sentido"), abajo hay una versión falsable; el criterio
original queda como comprobación cualitativa adicional, no como puerta.

Los números que aparecen son **puntos de partida**, no verdades. Todos viven
en el archivo de constantes y se ajustan con el laboratorio.

---

## Fase 0 — Esqueleto ✅ TERMINADA

**Resultado**: los 45 tests pasan; el laboratorio corre 100.000 ticks por
semilla a 0,037 ms por tick (unos 27.000 ticks/s) con la masa conservada exacta
y sin avisos. Se comprobó rompiendo el código a propósito que el test de
ausencia de guion salta al agregar un sexto verbo. Decisiones tomadas durante la
fase: la materia se cuenta en enteros (D7), y las funciones trascendentes se
implementan a mano porque `Math.exp` y compañía no dan el mismo bit en todos los
navegadores.


**Se construye**

- Proyecto TypeScript + Vite, sin frameworks. Estructura:
  `sim/` (worker, puro, sin DOM), `render/`, `ui/`, `lab/`, `shared/`.
- `sim/constants.ts`: **archivo único de parámetros**, comentado, con unidades.
  Regla de lint: ningún literal numérico fuera de este archivo dentro de `sim/`.
- RNG sembrado determinista (PCG32 sobre enteros de 32 bits, sin dependencia de
  coma flotante) + un `Rng` serializable que viaja en el estado.
- Matemática determinista propia: `exp`, `tanh`, `log`, `sqrt` por aproximación
  polinómica sobre Float32Array. Motivo en `RIESGOS.md` §6.
- Bucle de tick fijo en el Web Worker, con acumulador y modo rápido (catch-up)
  separado del modo tiempo real.
- Estado serializable con `SCHEMA_VERSION = 1` y el esqueleto de migraciones
  (registro de funciones `v(n) → v(n+1)`, aunque hoy esté vacío).
- Protocolo worker ↔ main: comandos entrantes, instantáneas salientes, con
  `postMessage` sobre buffers transferibles. El render nunca lee el estado vivo.
- **Modo laboratorio**: entrypoint headless (Node) que corre N ticks a máxima
  velocidad con semilla fija y escupe métricas a JSON/CSV.
- **Telemetría**: series temporales cada N ticks desde el tick cero, con el
  esqueleto de todas las métricas de la sección 5.3 aunque devuelvan cero.
- Los tres tests: masa, determinismo, ausencia de guion.
- `CLAUDE.md` (hecho), `docs/PLAN.md` (hecho), `docs/RIESGOS.md` (hecho).

**Aceptación**

1. `npm test` verde: los tres tests pasan.
2. El laboratorio corre **100.000 ticks vacíos** y reporta tiempo por tick.
3. Test de determinismo: dos corridas de 10.000 ticks desde la misma semilla
   producen el mismo hash del estado serializado, **y** una corrida de 10.000
   ticks partida en dos mitades con guardado/carga en el medio produce el mismo
   hash que la corrida entera.
4. El test de ausencia de guion falla a propósito si se agrega un sexto verbo
   (se verifica rompiéndolo una vez en el commit de la fase).

---

## Fase 1 — El planeta

Reescrita después de D10 (el mundo es una esfera, no un cuadrado), D12 (plantas
individuales y bayas) y D11 (objetos sueltos). Se parte en dos mitades para
poder mirar algo pronto.

### 1a — La bola ✅ TERMINADA

**Resultado**: 55 tests en verde. Planeta de 2.562 celdas con sus doce
pentágonos obligatorios, vecindad recíproca comprobada celda a celda, y celdas
que no se diferencian en tamaño más de un 30 %. Terreno desde la semilla con
entre un 31 % y un 43 % de tierra según la semilla. El tick cuesta 0,066 ms
—casi el doble que sobre la rejilla cuadrada, por el acceso salteado a la tabla
de vecinos— y sigue muy por debajo del presupuesto de 16 ms. Masa conservada
exacta en 100.000 ticks con tres semillas.

Dos fallos encontrados y corregidos mirando el planeta dibujado, no leyendo el
código: el fondo del mar se estaba subiendo al nivel del mar en vez de hundirlo,
así que el suelo marino asomaba por encima del agua; y sin el escalón de la
costa los continentes eran una lámina sin grosor.

**Lo construido**

- **Rejilla geodésica**: icosaedro subdividido cuatro veces y su dual, que da
  **2.562 celdas** casi iguales — hexágonos con doce pentágonos, que son
  inevitables en cualquier esfera. Cada celda con su tabla de vecinos.
- Terreno desde la semilla con ruido 3D determinista sobre la esfera: sin
  costuras y sin bordes, porque una esfera no tiene ni una cosa ni la otra.
- Nivel del mar, y el océano como una esfera translúcida a esa altura.
- Render: cada celda es un prisma de tapa plana, así que **los acantilados
  aparecen solos** donde dos celdas vecinas tienen alturas distintas. Ese es el
  aspecto escalonado de la referencia, y sale de la geometría, no de un truco.
- Cámara: girar el planeta y acercarse.

*Aceptación:* se ve el planeta, la misma semilla da el mismo planeta, y la masa
sigue conservándose exactamente con la difusión sobre la nueva tabla de vecinos.

### 1b — El mundo respirando

- Rotación del planeta e inclinación del eje. **El día, la noche y las
  estaciones dejan de ser fórmulas y pasan a ser geometría**: la línea de la
  noche es dónde no da el sol, y los polos son fríos porque el sol les llega de
  lado.
- Temperatura, humedad, lluvia, escorrentía hacia el mar.
- Plantas individuales: árboles y flores que crecen según humedad, luz y
  nutrientes, dan fruto y al morir dejan trozos de materia en el suelo.
- El vector de marca del suelo, que existe desde el tick cero y nadie interpreta.
- Las dos vistas: el planeta entero y el suelo, con paso continuo entre ambas.

*Aceptación (medible):*

1. Conservación: en 100.000 ticks, materia constante exacta; la deriva se
   reporta y no crece.
2. Estacionalidad: la biomasa total oscila con periodo detectable, no es una
   meseta ni una rampa.
3. El mundo no se congela ni se satura: biomasa y humedad medias se quedan
   dentro del rango, no pegadas a ningún borde.
4. **Nada de lo que se ve es decorativo**: cada color de la pantalla es la
   lectura de un número real de la simulación. Las nubes se dibujan de la
   humedad, así que donde hay nube va a llover.
5. 30 fps en un móvil de gama media, con la simulación por debajo de su
   presupuesto.

## Fase 2 — Química ✅ TERMINADA

Aparecen ciclos autocatalíticos sin que nadie los ponga, **y cada mundo tiene
los suyos**. Medido a 8.000 ticks por semilla:

| | al empezar la fase | al terminarla |
|---|---|---|
| Moléculas distintas vivas | 42 – 241 | **14.500 – 15.400** |
| Largo medio de cadena | 2,77 | **6,16** |
| Moléculas dominantes distintas entre celdas | 7 de 2.562 | **548 de 2.562** |
| Autocatalíticas sostenidas | 12, siempre las mismas | **66 – 73 por semilla** |
| De ellas, propias de un solo mundo | 0 | **34 de 88** |
| Coste del tick | 5,8 ms | 6,3 ms (de 16) |

Ejemplos de las que salen en un mundo y no en otro: `FAFBEBEB`, `EBDCDCDC`,
`CDCDCDBE`. No son los patrones alternos simples de antes — son cadenas
mezcladas, hijas de la historia concreta de ese planeta.

### Qué lo desatascó, y no era lo que parecía

Se probaron cuatro cosas. Las tres primeras mejoraron la química pero **no**
movieron la aguja de lo que importaba:

1. **Afinidad graduada** en vez de binaria (42 → 7.500 moléculas distintas).
2. **Dímeros con cajón propio**, fuera de las 24 ranuras que acaparaban al 100 %
   (7.500 → 50.000, y las cadenas largas por fin sobreviven).
3. **Catalizador desaturado**: con la unión base a 620 y empuje ×14 la
   probabilidad salía 8.680 sobre 1.000, o sea siempre. Era un mecanismo que
   parecía que estaba y no estaba.

La cuarta fue **la escasez de alimento**. Con átomos sueltos abundantes, cada
molécula alcanzaba su equilibrio sin estorbar a nadie y todas las celdas del
planeta acababan idénticas. Con átomos escasos, los ciclos **compiten por
ellos**: el que se adelanta en una celda se lleva la comida y ahoga a los demás,
y el ganador depende de quién tuvo suerte primero.

**Sin escasez no hay competencia, y sin competencia no hay historia.**

*Hipótesis descartada por el camino*: se creyó que era la difusión química la que
homogeneizaba el planeta. Se midió: con difusión lenta salían 534 dominantes
distintas y con rápida 548. **La difusión no pintaba nada.** Queda anotado
porque un descarte medido vale tanto como un acierto.

---

### Lo que se construyó

**Se construye**

- Alfabeto de átomos (arranque: 6 tipos) con valencia, afinidad, energía de
  enlace y estabilidad al calor. Único catálogo permitido.
- Moléculas = cadenas de átomos, longitud máxima inicial 12. **La identidad es
  la cadena**; se representan como enteros empaquetados, no strings.
- Reglas de reescritura: partir, unir, sustituir. Tasa en función de las
  propiedades de los átomos implicados, la temperatura de la celda y las
  concentraciones. Cada reacción consume o libera energía hacia/desde la
  temperatura local.
- **Regla de catálisis**, una sola, sin catálogo: una cadena cataliza una
  reacción cuando sus extremos son complementarios con los de los reactivos.
  Esta regla decide si la fase 2 pasa o no (ver `RIESGOS.md` §2).
- Termodinámica abierta: sol inyectando energía (más de día, más en verano),
  disipación de calor, lavado por lluvia con gradiente hacia el agua, difusión
  entre celdas vecinas.
- Rendimiento desde el primer día: top-N moléculas por celda (arranque N=24),
  resto al sumidero inerte con su masa conservada; actualización por lotes
  rotativos deterministas; Float32Array e índices enteros, cero objetos y cero
  strings en el bucle caliente.
- **Detector de ciclos autocatalíticos** a posteriori: se construye la red de
  reacciones activas de una muestra de celdas y se buscan ciclos donde una
  molécula participa en su propia producción. Corre fuera del bucle caliente,
  cada K ticks, sobre un muestreo. No es una entidad del modelo.
- Visor de química: seleccionar celda, ver moléculas, concentraciones y red de
  reacciones. Es el modo por defecto mientras no haya vida macroscópica, así
  que se hace bien y bonito desde ya.

**Aceptación (medible)**

1. Con **al menos 10 semillas distintas** corridas en laboratorio, aparece un
   ciclo autocatalítico detectado, sostenido más de X ticks, en al menos una.
   Se reporta la fracción exacta de semillas en las que ocurrió.
2. Diversidad viva: el número de moléculas distintas se estabiliza por encima
   de un umbral y **no colapsa a un puñado** ni explota hasta saturar el top-N
   en todas las celdas.
3. No-equilibrio: la tasa de reacciones por tick, promediada, no tiende a cero
   en 500.000 ticks.
4. Masa conservada exactamente, incluido el sumidero inerte.
5. Presupuesto: la química cabe en su parte de los 16 ms con el tamaño de lote
   configurado, medido y reportado.

**Si no aparece ningún ciclo**, no se siembra nada: se reporta y se propone qué
parámetro tocar, en este orden — generosidad de la regla de catálisis, tamaño
del alfabeto, longitud máxima de cadena, tasa de inyección solar, tasa de
difusión.

---

## Fase 3 — Cuerpos y reproducción ✅ TERMINADA

**Se construye**

- **Puente química → cuerpos**: la transición de ciclo autocatalítico a cuerpo
  macroscópico es una regla física explícita, parametrizada y documentada. Es
  el punto más delicado del proyecto y se escribe honestamente como lo que es
  (ver `RIESGOS.md` §3), nunca disfrazado de emergencia.
- Genoma = molécula. De su estructura salen tamaño, velocidad máxima, tasa
  metabólica, reacciones que sabe catalizar (o sea dieta y toxicidad),
  longevidad, alcance de visión, sensibilidad olfativa, umbral de dolor, tamaño
  de cerebro, coste de emitir, edad reproductiva. Longevidad con varianza fuerte
  entre linajes, a propósito.
- Cuerpo: energía que baja según metabolismo y movimiento, daño, edad,
  temperatura corporal peleando con el entorno. Muerte por hambre, daño, frío,
  calor, veneno o vejez. Cadáver que se pudre, alimenta y devuelve sus moléculas
  al suelo.
- Sentidos como vector normalizado: visión por rayos, olfato por gradiente,
  tacto, interocepción, canal social, vector de marca del suelo.
- Los cinco verbos, con su coste energético. Morder daña lo que sea. Agarrar
  levanta objetos y crías. Rascar escribe en la marca de la celda.
- Reproducción sin verbo nuevo: gemación por umbral de energía (mutación =
  errores de copia de la propia química) y sexo por gametos químicamente
  compatibles al entrar en contacto.
- Especiación: sin campo "especie". Compatibilidad de gametos por similitud
  química con umbral difuso, con híbridos de fertilidad parcial.
- Crías: construidas con materia que el progenitor comió, masa conservada.
  Nacen chicas, con poca energía. Si nadie las carga ni alimenta, se mueren.
- Control todavía aleatorio: los verbos se eligen por ruido sembrado.

**Aceptación (medible)**

1. Con control aleatorio, en laboratorio: hay linajes que persisten más de N
   generaciones y otros que se extinguen, sin que nadie los haya diseñado.
   Se reporta la distribución de duración de linaje.
2. La curva de población no es ni una explosión hasta el tope de seguridad ni
   una extinción total antes de M ticks, en la mayoría de las semillas.
3. Masa conservada con cuerpos, crías, cadáveres y objetos en la contabilidad.
4. Al menos una semilla donde dos poblaciones aisladas dejan de poder cruzarse
   (compatibilidad de gametos cae por debajo del umbral), detectado por la
   telemetría, no declarado.

### Cómo se cerró

Lo que ya está de pie: el puente, los cuerpos viviendo y muriendo, la gemación,
y la masa y el determinismo aguantando con cuerpos dentro. Lo que falta para
poder cerrar la fase: los sentidos, el sexo por gametos, y la detección de
especiación. El criterio 4 no se puede ni intentar todavía porque el sexo no
existe.

**El puente no cruzaba nadie.** `UMBRAL_DEL_PUENTE` pedía 260 copias de una
molécula autocatalítica en una celda, y desde que la sopa se volvió escasa (fase
2) el máximo real de copias de cualquier molécula en una celda es **4**. Cero
criaturas en 50.000 ticks. Bajado a 4: nacen linajes.

**La reproducción no disparaba.** Medido en la semilla 1234 a los 20.000 ticks:
de 95 criaturas vivas, 35 tenían energía de sobra y 30 materia de sobra, pero
**ninguna cumplía las tres condiciones a la vez**. La que sobraba era la edad:
la edad mediana al morir era 328 ticks y la edad fértil mediana, 793. Les pedía
madurar al doble de lo que este mundo deja vivir. `EDAD_REPRODUCTIVA` de 700 a
120 (rango real 48–240 con el gen). Ni la energía ni la materia se tocaron: esas
dos sí filtran de verdad y esa escasez es lo que hace que haya competencia.

**La población la decidía mi constante, no el hambre.** Con `MAX_CRIATURAS` en
1.200, la semilla 1234 se quedaba clavada en 1.195. Subido a 8.000 para ver qué
pasaba, los picos a 40.000 ticks fueron 1.521, 1.249, 26, 1.680 y 1.681 según la
semilla, y la población se frenaba sola. Fijado en 3.000: red de seguridad que
no manda.

**Cómo queda el mundo con las constantes definitivas** (8.000 ticks cada una):

| semilla | vivas | pico | del puente | crías | muertes | linajes vivos | tope | masa |
|---|---|---|---|---|---|---|---|---|
| 1 | 322 | 579 | 52 | 5.807 | 5.537 | 1 | no | ok |
| 7 | 726 | 935 | 56 | 7.209 | 6.537 | 2 | no | ok |
| 42 | 0 | 15 | 58 | 8 | 66 | 0 | no | ok |
| 1234 | 1.114 | 1.776 | 55 | 19.373 | 18.314 | 1 | no | ok |

Lo que dice esa tabla, en orden de importancia:

- **La reproducción sostiene el mundo, no el puente.** En la 1234 hay 55 cuerpos
  condensados de la química contra 19.373 crías. Antes de esta sesión la segunda
  columna era cero.
- **Nadie toca el tope** en ninguna semilla, así que la curva de población
  significa algo.
- **La semilla 42 se extingue.** Eso es un resultado, no un fallo: hay mundos
  donde la vida no arranca, y no se va a tocar nada para que arranque.
- **Quedan uno o dos linajes vivos de los 52–58 fundados.** El criterio 1 de la
  fase se cumple —unos aguantan y otros no— pero acaba en casi monocultivo, y eso
  hay que mirarlo cuando lleguen la especiación y el sexo.

### Los cuatro criterios, uno por uno

**1. Hay linajes que persisten y otros que se extinguen, y se reporta la
distribución.** ✅ Medido en dos semillas a 16.000 ticks (tabla más abajo): entre
83 y 131 linajes fundados, casi todos extinguidos, 3 y 5 vivos al final. Mediana
de duración por debajo de 120 ticks y una cola que llega a 10.007. Los que
siguen vivos llevan más de cincuenta generaciones. Nadie decidió cuál prende.

**2. Ni explosión hasta el tope ni extinción total en la mayoría de las
semillas.** ✅ El tope de población **no se toca en ninguna semilla** — y eso
costó trabajo, porque antes sí mandaba. De cuatro semillas, tres sostienen
población a los 8.000 ticks (322, 726 y 1.114) y la 42 se extingue. Que un mundo
se muera es un resultado legítimo y se deja así.

**3. Masa conservada con cuerpos, crías, cadáveres y objetos.** ✅ con una
salvedad honesta: **objetos no hay**, siguen aplazados (decisión D11). De lo que
existe —cuerpos, gametos, crías, carroña— la masa cuadra al entero en las cuatro
semillas y tras 10.000 ticks, y el gameto obligó a contar una cosa más: materia
que un cuerpo lleva apartada y que vuelve al suelo si se muere sin gastarla.

**4. Al menos una semilla donde dos poblaciones no pueden cruzarse, detectado por
la telemetría.** ✅ En las semillas 7 y 1234 llegan a convivir **tres grupos
incompatibles a la vez**, con parecidos mínimos de 0,000 y 0,008 cuando para
cruzarse hace falta 0,75. Lo dice el censo de especies, que agrupa con el mismo
umbral que usa la física y que se puede borrar entero sin que el mundo cambie.

Y el matiz que no se guarda: esos grupos son linajes de puentes distintos, con
genomas que nunca tuvieron nada que ver. **Especiación por divergencia no se ha
visto**, y la cuenta dice que harían falta unas 130 generaciones aisladas. Queda
apuntado para mirarlo en corridas largas, y no se va a tocar la tasa de mutación
para forzarlo.

### Lo que queda pendiente, dicho antes de pasar a la fase 4

- **El gen de longevidad no lo puede ver la selección.** Nadie llega a viejo: la
  longevidad mediana sale en 16.583 ticks y la edad mediana al morir en 328. Es
  un mecanismo que parece estar y no está.
- **El archivo guardado crece con el tope de población, no con lo que vive.**
  24 MB con 500 criaturas dentro. Hay que arreglarlo antes de la fase 6
  (`RIESGOS.md` §14).
- **Objetos, bayas con color emergente, la crónica y el diario, y fundir plantas
  y hongos en el mismo espacio de genomas** siguen aplazados a propósito
  (decisiones D11, D12, D17, D19).
- **Los sentidos no los lee nadie todavía.** Están construidos y medidos, y esa
  es justamente la idea: llegar a la fase 4 pudiendo culpar al cerebro y solo al
  cerebro.

### El sexo, y las especies que salieron de él

Con los cuerpos vivos y reproduciéndose, tocaba lo que pide el plan: gametos
químicamente compatibles al entrar en contacto. **Sin verbo nuevo** — CLAUDE.md
§1.2 dice que aparearse es contacto más química, y eso es literalmente lo que
hay: nadie busca pareja, nadie elige y a nadie se le premia por juntarse.

Lo primero que escribí estaba mal, y se vio midiendo. Puse que dos cuerpos
fértiles que coincidieran en una celda juntaran gametos. Resultado: **18 cruces
en 19.519 nacimientos**. La razón es que un cuerpo que llega al umbral de
fertilidad gema en ese mismo tick y vuelve a estar por debajo, así que dos no se
solapan fértiles jamás. Eso no eran gametos: era "dos cuerpos fértiles que se
tocan". **Un gameto es algo que se lleva encima**, y esa diferencia lo es todo.

La segunda versión —el gameto como materia apartada que el cuerpo transporta—
extinguió el mundo entero: de 875 criaturas vivas a cero. El gameto era peso
muerto, porque si no aparecía pareja esa materia no se podía usar para nada y
además dejaba al cuerpo por debajo del umbral para gemar. La corrección es la
que tenía que haber estado desde el principio: **gemar también gasta el gameto**.
Un cuerpo solo pone las dos mitades; dos cuerpos ponen una cada uno. El gameto
nunca se desperdicia, solo espera.

Con eso, la semilla 1234:

| tick | vivas | nacimientos | de dos | linajes | especies | parecido mín/medio |
|---|---|---|---|---|---|---|
| 2.000 | 3 | 51 | 0 | 1 | 1 | 1,000 / 1,000 |
| 4.000 | 539 | 1.759 | **1.251** | 3 | **2** | 0,313 / 0,941 |
| 8.000 | 979 | 25.788 | **19.610** | 4 | **2** | 0,297 / 0,683 |
| 16.000 | 958 | 56.667 | 39.115 | 3 | 1 | 0,891 / 0,959 |

Tres cosas de esa tabla:

- **El sexo pasó a ser el camino normal**: tres de cada cuatro crías salen de
  dos cuerpos. No porque se premie: porque una cría entre dos la pagan dos.
- **Hubo dos especies conviviendo** entre los ticks 4.000 y 8.000, con un
  parecido mínimo de 0,297 — muy por debajo del 0,75 que hace falta para
  cruzarse. Eso es el criterio 4 de la fase, detectado por el censo y no
  declarado en ninguna parte.
- **El sexo cambió el mundo cualitativamente.** Antes, a los 8.000 ticks quedaba
  un solo linaje con un parecido interno de 0,984: monocultivo. Ahora conviven
  grupos incompatibles y el parecido medio baja a 0,683. Y en el 16.000 uno se
  come al otro y vuelve a haber una sola especie — exclusión competitiva, que
  también es un resultado.

**Un fallo de los feos, y por qué no lo vio nadie.** El paso entre criaturas
dentro del archivo guardado estaba escrito a mano como `c * 24` en cuatro sitios
distintos. Al añadir el gameto como séptimo campo, cada criatura escribía su
gameto **encima de la celda de la siguiente**: el mundo se guardaba mal y al
cargarlo tenía otro futuro. Lo cazó el test de determinismo, y de milagro — el
test de ida y vuelta que ya existía no lo vio porque corre sobre un mundo sin
cuerpos y ni llegaba a tocar esos bytes. Arreglado atando el paso a una
constante en vez de repetir el número, y con un test nuevo que pone valores
reconocibles en los siete campos de doce criaturas y comprueba que ninguno pisa
al vecino. Comprobado que el test tiene dientes: con el paso mal falla en 159 ms
en vez de depender de que una corrida de diez minutos tenga la suerte de llevar
gametos encima.

(Los números de la tabla de arriba no están afectados: `serializar` lee el
estado y escribe en un buffer aparte, así que el fallo solo estropeaba el
archivo, nunca el mundo en marcha.)

**Y el matiz honesto, que es el que importa.** Esas dos especies no son un linaje
que se partió en dos: son dos linajes de puentes distintos, con genomas que
nunca tuvieron nada que ver (el parecido entre ellos es 0,297, y entre dos
genomas al azar es 0,328). Son dos especies según la única definición que hay en
el proyecto —no pueden cruzarse—, pero **no ha habido especiación por
divergencia**, que es lo que el criterio 4 pide de verdad. La cuenta de por qué:
con `ERRATA_POR_DIEZ_MIL = 9`, dos ramas separadas se alejan un 0,18 % por
generación, así que bajar de 0,98 a 0,75 pide unas 130 generaciones aisladas,
que en este mundo son unos cuarenta mil ticks sin mezclarse. No se ha visto
todavía. Y **no se va a subir la tasa de mutación para que salga antes**.

### Cuánto dura un linaje (criterio 1, la parte que faltaba)

El criterio 1 pide reportar la distribución, no solo decir que unos aguantan y
otros no. Medido en la semilla 7 a 16.000 ticks: **83 linajes fundados, 78
extinguidos y 5 todavía vivos al final**.

En la 1234, con los mismos 16.000 ticks: **131 fundados, 128 extinguidos, 3
vivos**. La distribución de los que se extinguieron, en ticks:

| | semilla 7 | semilla 1234 |
|---|---|---|
| mínimo | 56 | 29 |
| p25 | 79 | 88 |
| mediana | 109 | 118 |
| p75 | 231 | 241 |
| p95 | 1.276 | 1.162 |
| **máximo** | 2.544 | **10.007** |
| media | 248 | 418 |
| no pasaron de 100 ticks | 42 % | 35 % |
| aguantaron más de 2.000 | 1 | 5 |

Las dos semillas dan la misma forma, que es lo que hace pensar que es del mundo
y no de la suerte: mediana por debajo de 120 ticks y una cola que se estira
hasta diez mil.

Lo que dice esa forma: **casi todos los linajes no arrancan**. Un cuerpo se
condensa, no encuentra comida a tiempo o le toca una celda fría, y se acaba ahí.
Y luego hay una cola larga — unos pocos que sí prenden y duran cientos o miles
de ticks, y cinco que siguen vivos cuando se acaba la medición. Con generaciones
de unos 300 ticks, esos cinco llevan más de cincuenta generaciones.

Nadie ha diseñado cuál prende. La diferencia entre el que dura 56 ticks y el que
lleva 16.000 es dónde le tocó caer y qué genoma le salió del ciclo que se
condensó.

### El canal existía en el papel y no en el mundo

Este es el agujero más grande que ha tenido el proyecto, y estuvo ahí desde el
principio sin que se notara: **emitir una señal costaba energía y no dejaba
rastro en ninguna parte**. Se restaba `COSTE_DE_EMITIR`, se sumaba uno a un
contador de telemetría, y se acababa ahí. Rascar el suelo, igual: costaba y no
escribía nada.

O sea que el canal era **físicamente incapaz de llevar información**, y ninguna
cantidad de cerebro en la fase 4 lo habría arreglado. La visión del proyecto
dice que ponerle nombre a los peligros es el corazón de todo, y el corazón no
estaba conectado.

Ahora cada celda tiene dos campos de cuatro números:

- **El aire** (`senalAire`). Un bicho que emite suma sus cuatro números a los de
  su celda. Cada tick se reparte un poco a las vecinas y se apaga deprisa. Que
  se reparta es lo único que hace que avisar sirva de algo: el que ve el peligro
  y el que no lo ve están en celdas distintas, así que una señal que se quedara
  quieta solo llegaría a quien ya está mirando lo mismo que tú.
- **El suelo** (`marcaSuelo`). Lo que deja un rascado. Se apaga cientos de veces
  más despacio, así que sigue estando cuando el que lo rascó se ha muerto. Es lo
  único de este mundo que se parece a escribir.

Ninguno de los ocho números significa nada, y no hay diccionario. En la fase 3
los cuatro que emite un bicho salen del azar, porque no hay cerebro que los
elija — y eso es exactamente la línea base contra la que se medirá en la fase 4
si lo que emitan lleva información o sigue siendo ruido. Sin esa medida,
"están hablando" sería una impresión.

### Los sentidos, y por qué llegan antes que el cerebro

Un vector de 24 números entre -1 y 1: cómo está uno por dentro (5), dónde está
(3), hacia dónde huele a comida y cuánta hay (3), hacia dónde hay cuerpos y
cuántos (3), con cuántos está pegado (2), lo que suena en su celda (4) y lo que
hay rascado en ella (4). Ni uno solo es una decisión: no hay "hay comida al
norte" ni "viene un peligro", hay cuánta materia comestible hay hacia cada lado.

En la fase 3 **no los lee nadie**: los verbos siguen saliendo del azar. Se
construyen ahora a propósito, y la razón es de método: si llegaran junto con el
cerebro y las criaturas no espabilaran, no habría forma de saber si el fallo es
del cerebro o es que los sentidos no llevan información. Separados se puede
medir una cosa sin la otra — y se mide: hay un test que pone toda la comida en
una celda vecina y comprueba que **la flecha del olfato apunta a esa y no a
otra**, para las seis vecinas, una por una.

Dos detalles que parecen menores y no lo son:

- En una bola no hay norte que valga para todos, así que cada celda arma sus dos
  direcciones a partir de dónde está, siempre igual. Sin eso, "hacia la derecha"
  querría decir algo distinto cada vez que un bicho pasa por el mismo sitio, y
  no habría nada que aprender.
- La función que aplasta los números al rango -1..1 es `x / (1 + |x|)` y no
  `tanh`, porque las funciones trascendentes de JavaScript no están
  especificadas bit a bit y meterían una diferencia entre navegadores **justo en
  la entrada del cerebro** (§2.1).

**Lo que cuesta el canal.** Medido en un planeta de nivel 3 **sin una sola
criatura viva**, para aislar el coste: la capa de cuerpos se lleva 2,28 ms de un
tick de 39,09, o sea el **6 %**, y casi todo es repartir y apagar el aire. No es
una regresión seria. Lo que domina el tick es la química, con el 80 % — que es
justo lo que CLAUDE.md §2.4 manda recortar primero si algún día no se llega, con
`LOTES_DE_QUIMICA` como palanca.

**Lo que va a costar en la fase 4.** Medido con 1.605 criaturas vivas: sentir a
todas cuesta **el 5,3 % de un tick** (9,10 ms de 171, las dos cifras tomadas en
la misma corrida y en la misma máquina — el número absoluto no vale, la
proporción sí). O sea que los sentidos son baratos y lo caro de la fase 4 va a
ser el cerebro, no lo que le entra por delante.

### Las formas salen del genoma, no de un catálogo

Un bicho, en la simulación, **no tiene forma**. Tiene tamaño, metabolismo,
dieta, aguante al dolor — números. No tiene patas ni cabeza. Así que dibujarlo
como un lobo sería mentir, y tener una lista de modelos (lobo, ciervo, pájaro)
sería declarar especies a mano, que es lo único que el proyecto no permite
(§1.3).

Lo que sí se puede hacer es la misma jugada que el color: **que la silueta sea
una lectura de genes que ya significan algo**.

- **Lo picudo sale del gen de la dieta.** Cuatro poliedros, de cuatro caras a
  veinte, y un cuerpo cae en el que le toca según de qué lado del gen esté. Puro
  carnívoro sale en tetraedro y puro herbívoro en icosaedro. Cuatro y no
  cuarenta a propósito: con más, dos genomas casi iguales caerían en formas
  distintas por un pelo y se verían diferencias que no existen.
- **Lo estirado sale del gen de velocidad.** Un cuerpo hecho para moverse se ve
  alto y estrecho; uno lento, bajo y ancho.
- **El color sale de proyectar el genoma entero**, como ya estaba.
- **Los árboles también**: el porte sale del gen de la sed, así que un bosque de
  secano se ve bajo y ancho y uno de ribera alto y estrecho. Ya no solo cambian
  de color entre climas: cambian de forma.

Lo que hay que dejar dicho con todas las letras, porque es fácil confundirse al
mirar la pantalla: **que un carnívoro salga picudo no es una causa, es una
lectura**. La forma no hace nada en el mundo — no muerde mejor por ser
puntiaguda ni corre menos por ser redonda. Nada del render entra en la
simulación. Es una manera de ver un gen con los ojos en vez de abrir un menú.

Y lo que se gana con eso es lo que se buscaba desde el principio: un linaje
entero comparte silueta porque comparte genes, así que **una rama que se separa
se ve cambiar de forma y de color a la vez**, sin que nadie la anuncie.

Sabido y no arreglado: un bicho puntiagudo y un árbol se parecen de lejos. Hoy
los separa el color —los cuerpos van saturados y los árboles en verdes
apagados— pero si a un linaje le toca un tinte verdoso, se confunden.

### Ahora se les ve

Hasta esta sesión el render dibujaba terreno, mar, nubes y vegetación, y **las
criaturas no salían por ningún lado**. Un mundo con 800 bichos dentro que en
pantalla parecía vacío. CLAUDE.md §0 dice que la capa de observación es la mitad
del proyecto y que si no se puede ver lo que pasa, no pasa.

Ahora se dibuja cada cuerpo, uno por uno y no un resumen por celda, porque lo
que se quiere mirar es a los bichos. El panel dice cuántos hay vivos y en
cuántas celdas — lo segundo importa más de lo que parece, porque dice si están
repartidos o amontonados, y de eso depende que lleguen a encontrarse para
cruzarse.

**El color sale del genoma, y eso es lo mejor que tiene.** No hay tabla de
especies ni la va a haber (§1.3): el tono es una proyección del genoma, un
número que se saca de promediar una ventana de átomos, igual que el color de los
frutos en la decisión D12. Nadie dentro del mundo lo lee, no entra en ninguna
cuenta, y borrar esa función no cambiaría un solo tick.

Lo que consigue es que **una especie nueva se vea**: dos cuerpos que pueden
cruzarse tienen genomas parecidos, así que salen del mismo color solos, sin que
nadie se lo diga. El día que un grupo se separe lo bastante como para no poder
cruzarse con los demás, va a aparecer una mancha de otro color en la pantalla.
La especiación se mira, no se consulta en un menú.

Primer intento fallido, anotado: los hice de la mitad de tamaño que un árbol y
con poca saturación, y no se distinguían de la vegetación. Un bicho que no se ve
es un bicho que no existe.

**La vida necesita mundo.** Medido de paso: en el planeta de nivel 3 (642 celdas,
el que usan los tests centrales) los cuerpos no aguantan — picos de 3, 7, 4 y 53
y extinción total antes de los 12.000 ticks. Menos celdas es menos comida y
menos sitio donde esconderse. Por eso los tests de cuerpos van en el planeta
grande aunque cuesten minutos.

**El gen de la longevidad no hace nada.** Medido de paso: la longevidad mediana
sale en 16.583 ticks y la edad mediana al morir en 328. Nadie llega a viejo, así
que la selección no puede ver ese gen. Es el mismo tipo de mecanismo fantasma
que el multiplicador del catalizador saturado de la fase 2. Se arregla bajando
`LONGEVIDAD_MINIMA` y `RANGO_DE_LONGEVIDAD` hasta que la vejez mate a alguien,
pero eso pide su propia medición y no se ha hecho.

**Lo que costó poder subir el tope.** El tick estaba en 10,66 ms de los 16.
Sospeché de `morder`, que recorría las 1.200 ranuras de criatura para encontrar
a un vecino, y me equivoqué: arreglarlo bajó de 10,54 a 10,35 ms, o sea nada. El
bucle caro era `mordisqueaUnaPlanta`, que recorría las **16.000** ranuras de
planta. Con un índice de quién hay en cada celda, las criaturas pasaron de 4,28 a
1,62 ms y el tick de 10,66 a 7,65. Los dos índices
son estado derivado: no se guardan, se reconstruyen al cargar, y hay un test que
comprueba que dicen lo mismo que el recorrido largo y que sobreviven a
guardar/cargar. La huella del mundo a 8.000 ticks es idéntica antes y después
del atajo (`3226744334`), que es la prueba de que es velocidad y no un cambio de
física.

**Un test viejo que llevaba fallando sin saberlo.** La tanda lenta pedía más de
100 uniones químicas en un tick y salían 50. No era la sopa: la escasez del
commit anterior dejó seis veces menos átomos libres y `UNION_POR_MIL` bajó de
620 a 45, así que se une menos cosa por tick — que es justo lo que se buscaba —
y la tanda lenta no se volvió a correr después de aquel cambio. Medido: mediana
68 uniones por tick, rango 49–91, y con el puente cerrado y cero criaturas sale
exactamente lo mismo, así que los cuerpos no tienen nada que ver. La sopa está
viva: 15.305 moléculas distintas y cadenas de 6,11 átomos de media. El test
ahora mide una barrida entera del planeta en vez de un tick suelto, porque la
química va en ocho lotes y un tick es un octavo del mundo.

**Y una advertencia sobre esos milisegundos.** Al final de la sesión la misma
medición daba 72–88 ms/tick, con siete criaturas vivas y todo. La máquina se
había vuelto unas diez veces más lenta —misma carga, mismo proceso, cuatro CPUs
libres—, así que **el número absoluto no es reproducible y no hay que fiarse de
él**. Lo que sí vale son las proporciones, que se midieron seguidas y con la
máquina igual: la química se lleva el 46 % del tick, y las criaturas bajaron del
40 % al 21 %. El presupuesto de 16 ms de CLAUDE.md §2.4 se mide donde tiene que
medirse, que es en el navegador con el Worker de la fase 5, no aquí.
5. El tope duro de seguridad de población, si se toca, queda registrado con
   aviso claro; nunca se recorta en silencio.

---

## Fase 4 — Cerebros — EN CURSO, **el criterio 1 no se cumple**

### Dónde está esto ahora mismo, sin adornos

El cerebro está construido y conectado: 24 sentidos entran, 64 neuronas ocultas
con recurrencia e inercia piensan, salen los nueve números de los cinco verbos.
Los pesos vienen del genoma —un átomo, un peso—, la capa de salida aprende en
vida con la única recompensa que existe, y hay imitación entre vecinos.

**Y aun así los cerebros lo hacen peor que tirar los dados.** Medido en la
semilla 7 a 2.500 ticks: con cerebro la población hace un pico de 8 criaturas y
con el control aleatorio hace 39. El criterio 1 de la fase dice que la esperanza
de vida con cerebros tiene que superar a la del control, y hoy no lo hace.

Eso es un resultado nulo y se deja escrito como tal (CLAUDE.md §1.6). Lo que
sigue es lo que se ha encontrado por el camino, que no es poco.

### Cuatro fallos de verdad, los cuatro cazados midiendo

**1. El tanh estaba saturado.** Con ~40 entradas de peso hasta 1,2 y signos al
azar, la suma antes del tanh se iba a ±7. Las nueve salidas salían clavadas en
+1 o -1, sin un solo valor intermedio: un interruptor binario en vez de un
cerebro. Arreglado repartiendo cada suma entre la raíz de cuántas cosas se
suman, que es lo que mantiene la suma donde el tanh todavía distingue.

**2. Un premio fantasma en el primer tick de vida.** El bienestar arrancaba en
cero y el cuerpo nacía con 120 de energía, así que la primera recompensa que veía
el aprendizaje era **+120** y lanzaba todos los pesos contra su tope. Cada
cerebro nacía ya deformado. Arreglado estrenando el cerebro después de darle su
energía al cuerpo, no antes.

**3. El aprendizaje apagaba a los bichos.** Estar vivo cuesta, así que el cambio
de energía es negativo casi todos los ticks: el aprendizaje se pasaba la vida
castigando lo que el bicho estuviera haciendo, fuera lo que fuera. Medido
apagando el aprendizaje del todo, las tasas de acción saltaron del 2,2 % al
20,6 %, y eso señaló al culpable sin lugar a dudas. Dos arreglos: la recompensa
es ahora cuánto mejor le va **de lo que le suele ir** (que es lo que hace la
dopamina, y no añade ninguna recompensa nueva), y la tasa de aprendizaje bajó cien
veces — movía un peso 0,21 por tick sobre un rango de ±1,2, o sea que en quince
ticks lo tenía contra el tope.

**4. El gordo: todos los cerebros eran una sola neurona repetida.** El genoma se
construía repitiendo en bucle la cadena del ciclo autocatalítico. Un ciclo tiene
tres o cuatro átomos y los sentidos son veinticuatro, que es múltiplo de los dos,
así que **la fila de pesos de cada neurona salía idéntica a la de todas las
demás**. Medido: dos neuronas cualesquiera compartían el **92,9 %** de sus pesos
cuando por azar sería el 16,7 %. Un cerebro de sesenta y cuatro neuronas era una
neurona repetida sesenta y cuatro veces, y con eso no se puede calcular nada.

Arreglado usando la cadena como **semilla de un generador** en vez de repetirla.
No mete ni una pizca de azar de más: el mismo ciclo da exactamente el mismo
genoma y dos ciclos distintos dan genomas que no se parecen en nada, así que
sigue siendo la química la que decide qué cuerpo sale. Tras el arreglo, dos
neuronas comparten el 16,8 % — exactamente lo que predice el azar.

### La lección de método, que vale más que los cuatro arreglos

Cinco veces seguidas calibré los umbrales de los verbos sobre la población
equivocada, y cinco veces el mundo real dio números que no tenían nada que ver:

| dónde medí | qué salió en el mundo |
|---|---|
| cerebros de un mundo agonizante | dos cerebros repetidos mil veces |
| genomas al azar, sentidos al azar | 1,3 % de acción contra el 35 % del control |
| genomas al azar, sentidos reales | igual |
| genomas al azar, sentidos reales fijos | igual |
| **genomas reales del mundo que vive** | ya en el orden correcto |

La moraleja, apuntada para no repetirla: **un banco de pruebas alimentado con
datos inventados mide el banco, no el mundo**. Y hubo un momento en que el
contador de señales decía 409 millones porque nunca se reiniciaba — un fallo que
venía de la fase 3 y que su propio test no cazó porque le bastaba con que fuera
mayor que cero.

### Y al final el problema no era el cerebro: era que saber no sirve de nada

El control bueno tardó en aparecer. Comparar cerebros contra verbos al azar tiene
una trampa: los dados están **obligados** a moverse el 35 % de los ticks, así que
la comparación mide cuánto te mueves y no si piensas. El control que hacía falta
es **el mismo cerebro con los ojos tapados**: mismo genoma, mismos umbrales,
mismo temblor, mismos costes, y lo único que cambia es que no se entera de nada.
Cualquier diferencia es información usada y no puede ser otra cosa.

Y el resultado fue el contrario del esperado:

| semilla | modo | pico | come/tick | mover | morder |
|---|---|---|---|---|---|
| 7 | ve | 12 | 0,84 | 62 % | 54 % |
| 7 | **ojos tapados** | **456** | **8,66** | **2 %** | ~100 % |
| 1234 | ve | 107 | 2,14 | 23 % | 35 % |

**El ciego gana por goleada**, y se ve exactamente por qué: converge a quedarse
quieto y masticar sin parar. El que ve se mueve el 62 % del tiempo y come diez
veces menos.

O sea que en este mundo **tener información es activamente malo**, porque lo
único que hace es que te muevas, y moverse no compensa jamás. Y eso, mirándolo,
resultó ser dos cosas encadenadas:

**Una:** moverse costaba 1,4 por paso, que con un cuerpo medio son 2,1 — más de
lo que se come en un tick entero (1,55). Buscar comida era ruinoso por
construcción y ningún cerebro podía aprender a hacerlo por listo que fuera. No se
vio antes porque los dados se mueven un 35 % fijo pase lo que pase, y el mundo
quedó equilibrado alrededor de esa cifra. Bajado a 0,45.

**Dos, y es la de fondo:** una celda puede tener doce plantas, cada una crece 3
por tick y un bocado son 6. Una sola celda regenera 36 por tick y un bicho come
6. **Una celda da de comer para siempre a quien se plante encima.** La jugada
ganadora del mundo es no moverse nunca, y eso es exactamente lo que el cerebro
ciego descubrió solo.

Un mundo cuya estrategia óptima es sentarse a masticar es un mundo de ermitaños,
y la visión dice con todas las letras que entre dos diseños gana el que produzca
más interacción, porque un bicho que se las arregla solo no tiene nada que ver
con otro.

### Lo que hay que construir, y que está en el plan desde el principio

Releyendo el propio plan de la fase 4 aparece el apartado que me había saltado, y
es el que resuelve todo esto de raíz — **"Presión para comunicar, que es el
corazón del juego"**:

- **Comida enterrada rica**, que solo se huele estando encima de la celda, y como
  fuente principal de calorías. Eso hace que haya que buscar, que haya algo que
  saber y que sepa uno lo que otro no sabe.
- **Peligro letal que llega desde fuera del alcance visual de la mayoría**, y a
  menudo. Eso hace que el que lo vio primero tenga algo que decir.
- **Vida solitaria con esperanza claramente peor que la acompañada.**

Sin esas tres cosas, este mundo no tiene ningún motivo para moverse, ninguno para
mirar y ninguno para hablar, y **el cerebro no puede ganar sabiendo porque saber
no vale nada**. No es un fallo de la red: es que le he pedido que resuelva un
problema que no existe.

Eso es lo siguiente, y es lo que faltaba de verdad.

**Aviso:** bajar `COSTE_DE_MOVERSE` cambia el mundo también para la fase 3, así
que sus números medidos (población, especies, duración de linaje) hay que
volver a tomarlos. Masa y determinismo no dependen del equilibrio y siguen en
verde.

### Lo que queda por probar

Los umbrales siguen sin cuadrar del todo (50 % de movimiento contra el 35 % del
control) y la población sigue sin arrancar. Los sitios donde mirar, por orden:

1. **Que solo aprenda la capa de salida.** El instinto —la capa oculta y su
   recurrencia— no cambia en toda la vida. Puede que no dé para tanto.
2. **La resolución de los pesos.** Un átomo son seis valores posibles. Es basto.
3. **El coste de pensar y de actuar**, que en una economía tan justa como esta
   puede estar comiéndose el margen entero.

---

## Fase 4 — Cerebros (el plan original)

**Se construye**

- Red por criatura: feedforward con una capa recurrente. **Tamaño fijo en
  memoria (64 ocultas) con máscara genética** de neuronas activas entre 16 y 64,
  para que herencia e imitación tengan un espacio de índices común
  (ver `RIESGOS.md` §5). Float32Array a mano, en el worker, sin librerías.
- Herencia: pesos iniciales de los padres con mutación gaussiana.
- Aprendizaje en vida: modulación por recompensa = cambio de energía menos
  dolor, con traza de elegibilidad que decae. Local, sin backprop.
- Imitación: al observar dentro del campo visual a otra que acaba de recibir
  una recompensa fuerte, se copia parcialmente un subconjunto de pesos con
  ruido, pesado por proximidad y por diferencia de edad (más de los viejos).
  **Nada evita que se copie una asociación equivocada.**
- **Presión para comunicar**, que es el corazón del juego:
  comida enterrada rica detectable por olfato solo estando encima de la celda,
  como fuente principal de calorías; peligro letal que llega desde fuera del
  alcance visual de la mayoría y con frecuencia alta; vida solitaria con
  esperanza claramente peor que la acompañada.
- Visor de cerebro: activaciones en vivo, entradas, salidas, recompensa.
- Detectores de degeneración en telemetría.

**Aceptación (medible)**

1. **Contra un control aleatorio con la misma semilla**: la esperanza de vida
   media de la población con cerebros supera significativamente la del control
   con verbos aleatorios, tras G generaciones. Sin esto, no hay aprendizaje.
2. La presión social existe y se mide: la esperanza de vida de individuos con
   pocos vecinos es claramente peor que la de individuos acompañados. Si no,
   se sube el valor de la información antes de seguir.
3. La transmisión por imitación se detecta: hay pares (observador, observado)
   con similitud de pesos por encima de la esperada por parentesco solo.
4. **Reporte honesto del canal de señales**: tasa de emisión, y si esa tasa
   correlaciona con el contexto o es ruido. Se dice sin adornos si despegó o
   quedó mudo. Quedar mudo aquí es un resultado aceptable de la fase 4; lo que
   no es aceptable es maquillarlo.
5. Presupuesto de 16 ms respetado con la población objetivo.

---

## Fase 5 — Lenguaje y observación

**Se construye**

- Registro de cada señal emitida con su contexto: qué había cerca, qué pasó
  después.
- **Grupos sociales detectados**, no declarados: clustering por proximidad e
  interacción a lo largo del tiempo.
- Clustering online del espacio de vectores de señal, por grupo. Cada nube
  estable es una palabra que nadie escribió.
- **Glifos**: SVG procedural determinista desde el centroide del cluster.
  Mismo vector, mismo dibujo siempre. Dos grupos separados dan glifos distintos
  para la misma cosa y eso se ve de un vistazo.
- Etiquetado estadístico del glifo ("aparece cuando hay un depredador cerca —
  71%") **incluyendo las asociaciones erróneas**, que son contenido.
- Detección de clusters estables en los vectores de marca del suelo cerca de
  recursos o rutas: sería escritura emergiendo. Puede no pasar nunca; no se
  ayuda.
- Inspector de criatura: sensores en vivo, estado del cerebro, de quién copió,
  linaje, qué palabras usa, en qué se equivoca.
- Léxico por grupo, con divergencia entre grupos.
- Crónica que **avisa de los hitos sociales**: la primera vez que una señal
  salva a alguien, la primera palabra que se estabiliza, la primera vez que dos
  grupos se encuentran y no se entienden. Narrada sobria y con sus glifos.
- Genealogía navegable.
- Todo pensado para el dedo primero, en pantalla chica.

**Aceptación (medible)**

1. Al menos un cluster de señal estable, sostenido más de X ticks, con
   información mutua medible entre la señal y su contexto por encima del ruido.
2. Dos grupos aislados producen glifos distintos para contextos equivalentes,
   verificado por la métrica de divergencia.
3. Cualitativo, pero es la puerta real de la fase: se puede hacer clic en una
   criatura y entender qué cree y por qué, incluido en qué se equivoca.

---

## Fase 6 — Tiempo, intervención y publicación

**Se construye**

- Persistencia en IndexedDB con guardado incremental (no el mundo entero cada
  tick), migraciones automáticas, export/import del mundo a archivo.
- Catch-up al abrir, **con tope explícito y visible**: si transcurrieron más
  ticks de los que se pueden correr, la interfaz dice cuántos se corrieron de
  cuántos. Nunca se miente sobre eso (ver `RIESGOS.md` §7).
- Velocidad elegida al crear el mundo — x1, x10, x100 — y fija para ese mundo.
- Pantalla de creación honesta: corre la química acelerada, muestra el número
  **real** de ticks corridos y qué apareció, que puede ser nada.
- Semilla compartible: el mundo queda definido por semilla + lista de
  intervenciones. Link que le nazca a otra persona exactamente este mundo, e
  importar el de otro sin perder el propio.
- Intervenciones del jugador sin límites — clima, sequía, lluvia, incendio,
  mover o crear objetos, alimentar, matar, partir un grupo, teletransportar —
  entrando siempre **como estímulo sensorial normal**, nunca como magia
  invisible, y registradas en la crónica.
- PWA instalable: manifest, service worker, icono, pantalla completa. Deploy a
  GitHub Pages.

**Aceptación (medible)**

1. Cierro la app un día entero, la abro, y el mundo avanzó de forma coherente
   **y verificable**: el estado tras el catch-up es idéntico (mismo hash) al de
   correr esos mismos ticks sin cerrar.
2. Un mundo guardado con `SCHEMA_VERSION = 1` se abre y migra sin perder nada
   tras varios cambios de esquema.
3. La semilla compartida reproduce el mismo mundo en otro dispositivo, con la
   salvedad de motor documentada en `RIESGOS.md` §6.
4. Instalable como PWA en móvil, 30 fps, sin mantener la pantalla despierta y
   sin simular en segundo plano.

---

## Fase L — El laboratorio (transversal, no es una fase aparte)

Existe desde la fase 0 y crece con cada fase. Es el banco de pruebas de todo:
sin él, probar un parámetro cuesta días. Su trabajo es correr muchas semillas,
descartar las que no despegan y **promover a mundo jugable solo las que sí**.
Cada fase agrega sus métricas a la telemetría exportable.
