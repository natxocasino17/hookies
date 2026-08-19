# Decisiones tomadas

Las dudas abiertas en `RIESGOS.md` quedan resueltas acá. Cada decisión dice qué
se eligió, por qué sirve a la visión, y qué se pierde. Si más adelante alguna
resulta mala, se cambia acá y se anota; no se cambia en silencio dentro del
código.

Criterio único para desempatar, en orden:
1. ¿Hace más probable que se hablen?
2. ¿Sigue siendo cierto que nadie escribió el resultado?
3. ¿Entra en el presupuesto?

---

## D1 — Cómo nace la vida de la química

**Se elige**: una regla de transición explícita. Cuando un ciclo químico que se
alimenta a sí mismo se sostiene por encima de un umbral durante N ticks, su
materia se condensa en un cuerpo, y el genoma de ese cuerpo se deriva
determinísticamente de las cadenas del ciclo.

**Por qué**: no hay forma honesta de que un cuerpo con sentidos y cerebro salga
por continuidad de una sopa de cadenas cortas. Es un salto.

**Qué se pierde**: este es **el único punto del proyecto donde el resultado lo
decide una regla mía**. Va escrito así en el código y así en la pantalla. Lo que
sigue siendo enteramente emergente es *qué* ciclo aparece, cuándo, con qué
genoma, y absolutamente todo lo que pase después.

**Lo que NO se hace**: sembrar criaturas por evento, por tiempo, ni "porque
hacía falta que hubiera vida".

---

## D2 — El genoma es una molécula larga

**Se elige**: dos longitudes máximas de cadena. Las moléculas del ambiente
siguen siendo cortas (12 átomos) por rendimiento. El genoma es una cadena de
miles de átomos, que no compite en la sopa de la celda y solo entra en
reacciones metabólicas propias.

**Por qué**: en 12 átomos entran 31 bits de información, y un cerebro necesita
miles de números. Con el genoma largo, un átomo del genoma es un peso del
cerebro, y **la mutación sigue siendo lo que tiene que ser: un error de copia de
la propia química**, pequeño y local. Así el instinto se acumula generación a
generación en vez de reiniciarse con cada mutación.

**Qué se pierde**: una cadena de miles de átomos no se ensambla sola desde la
sopa. Refuerza que D1 es un salto.

---

## D3 — El peligro es una fuerza del mundo, no un bicho

**Se elige**: la amenaza letal es física del mundo, del mismo rango que una
tormenta o el fuego: algo que se mueve, mata, y llega desde más allá de donde
alcanza la vista de la mayoría.

**Por qué**: es la decisión más importante de la lista, porque de ella depende
que haya algo que decir. Si el peligro solo pudiera venir de depredadores
evolucionados, no habría forma de garantizar que existan, ni que sean letales,
ni que sean frecuentes — y sin peligro que avisar, el canal de señales se queda
mudo y el proyecto fracasa en su único objetivo.

**Qué se pierde**: no es un bicho, y no se disfraza de bicho. Es clima que
mata. Cuando la depredación evolucione sola entre criaturas —que puede pasar,
morder ya existe— mejor, pero la presión no depende de que ocurra.

---

## D4 — Mundo chico: 64×64 y población densa

**Se elige**: empezar con un grid de 64×64 y del orden de 500 criaturas.

**Por qué**: sirve dos veces. Entra en el presupuesto (128×128 con cerebros no
entra), y sobre todo cumple lo que el proyecto pide: encuentros constantes. 500
bichos en 64×64 es uno cada ocho celdas, se chocan todo el tiempo. En 128×128
serían bichos perdidos en un continente vacío, y los bichos solos no hablan.

**Qué se pierde**: menos espacio para que dos grupos se aíslen y diverjan en
idiomas distintos. Se compensa con barreras de terreno (agua, montaña) en vez
de con distancia.

---

## D5 — El fuego es química, no una tecnología

**Se elige**: el fuego no es una entidad ni un desbloqueo. Es una reacción muy
exotérmica que se dispara por encima de cierta temperatura y se propaga porque
suelta el calor que enciende a la vecina. Quema biomasa, hace daño, calienta,
deja el suelo cambiado.

**Por qué**: es exactamente lo que pide la visión. "Descubrir el fuego" no puede
ser un evento que yo dispare; tiene que ser algo que ya está en el mundo y que
un linaje aprende a usar, a evitar o a nombrar. Sale gratis: la química ya tiene
reacciones que sueltan energía a la temperatura local, y la temperatura ya se
difunde entre celdas. El fuego es un caso extremo de lo que ya existe, no un
sistema nuevo.

**Qué se pierde**: nada. Y se gana algo importante — el fuego es un fenómeno
visible, peligroso y localizado, o sea **un candidato ideal a que le pongan
nombre**.

---

## D6 — Comida que uno solo no puede derribar

**Se elige**: entre las fuentes de calorías tiene que haber alguna que requiera
más daño del que una criatura sola puede hacer antes de agotarse o de recibir
demasiado.

**Por qué**: "juntarse para cazar" está en la visión, y la caza en grupo no se
programa: se hace necesaria. Si un bicho solo se las arregla, nadie se junta
jamás. Es el mismo principio que la comida enterrada y el peligro invisible:
**el mundo se ajusta para que estar acompañado e informado sea mucho mejor que
estar solo**.

**Qué se pierde**: nada. No hay ninguna regla de "grupo", ni de "manada", ni de
reparto de presa. Solo hay carne que aguanta más mordiscos de los que uno da.

---

## D7 — La materia se cuenta en enteros

**Se elige**: la materia son cuentas enteras de átomos, no números decimales.
La energía sí puede ser decimal.

**Por qué**: la conservación de masa tiene que ser exacta, y con decimales cada
suma pierde un pelo, así que "la materia total no cambia jamás" sería falso a
los pocos miles de ticks. Con enteros es exacto por construcción y el test es de
verdad. Además es lo correcto: los átomos son discretos, no se parten.

**Qué se pierde**: algo de precisión en concentraciones muy bajas. A cambio,
cada átomo del mundo tiene dueño en todo momento y se puede demostrar.

---

## D8 — Sobre los mundos guardados antes de la fase 6

La maquinaria de versionado y migración existe desde el primer commit. Pero el
formato va a cambiar mucho entre fases, así que los mundos creados antes de la
fase 6 se marcan como desechables. La promesa de "nunca se borra un mundo"
empieza a valer cuando el formato se estabiliza. Prefiero decirlo ahora a
romper un mundo de meses más adelante.
