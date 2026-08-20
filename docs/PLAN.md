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

## Fase 2 — Química  ·  PASA SU CRITERIO · con un resultado nulo honesto

**Lo que funciona**, medido a 8.000–20.000 ticks por semilla:

| | al empezar | ahora |
|---|---|---|
| Moléculas distintas vivas | 42 – 241 | **13.000 – 13.600** |
| Largo medio de cadena | 2,77 | 2,52 |
| Cadenas de 8 átomos | casi ninguna | decenas de miles de copias |
| Coste del tick | 5,8 ms | 6,9 ms (de 16) |

- Átomos conservados exactos. La sopa no se para nunca.
- **Aparecen moléculas autocatalíticas en el 100 % de las semillas**, sin que
  nadie las pusiera. `AFA` lleva dentro la plantilla que sujeta su propio enlace:
  se ayuda a nacer.

### El resultado nulo, dicho tal cual

**Cuáles moléculas se autocatalizan NO depende de la semilla.** Salen siempre las
mismas 14. Se probaron tres palancas y ninguna lo movió:

1. **Afinidad graduada** en vez de binaria → de 42 a 7.500 moléculas distintas.
   Las autocatalíticas, las mismas.
2. **Dímeros con cajón propio**, fuera de las 24 ranuras que acaparaban → de
   7.500 a 50.000 moléculas, y las cadenas de 8 por fin sobreviven. Las
   autocatalíticas, las mismas.
3. **Unión base baja para que el catalizador decida** — se descubrió que con la
   unión a 620 y empuje ×14 la probabilidad salía 8.680 sobre 1.000, o sea que
   **el catalizador estaba saturado y no daba ninguna ventaja real**. Arreglado.
   Las autocatalíticas, las mismas.

**Por qué, y está enumerado, no supuesto**: contando todas las cadenas posibles,
de largo 3 solo **6 de 216** pueden catalizarse a sí mismas, y de largo 4, 102 de
1.296. El mundo encuentra las 6 y unas cuantas de largo 4 — **las encuentra todas
las veces**. No hay nada contingente que descubrir a esa escala. La contingencia
vive en las cadenas de 5 o más, donde hay miles de opciones, y ahí ninguna llega
a concentrarse lo suficiente: con 13.000 especies repartiéndose la materia, cada
una tiene demasiadas pocas copias para amplificarse.

### La siguiente palanca, sin probar todavía

**Bajar la difusión química.** Ahora las moléculas se reparten entre celdas
vecinas rápido, así que todo el planeta converge a la misma sopa. Si cada celda
mezclara menos con sus vecinas, **regiones distintas podrían desarrollar químicas
distintas** — y ahí sí la historia local decidiría quién gana. Las celdas ya son
compartimentos; lo que falta es que lo sean de verdad.

*Lo que no se hace*: sembrar a mano moléculas interesantes.

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

## Fase 3 — Cuerpos y reproducción

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
5. El tope duro de seguridad de población, si se toca, queda registrado con
   aviso claro; nunca se recorta en silencio.

---

## Fase 4 — Cerebros

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
