# CLAUDE.md — Reglas innegociables del proyecto

Este archivo se lee en cada sesión. Las reglas de abajo no se negocian, no se
suspenden "solo por esta vez" y no se relajan para que una fase pase su
criterio de aceptación. Si una regla impide que algo funcione, el resultado
correcto es **decirlo y proponer qué parámetro tocar**, no saltarse la regla.

---

## 0. El objetivo, para ordenar prioridades

Lo que se busca es **interacción y lenguaje**: que las criaturas se junten, se
avisen, inventen una señal y que esa señal signifique algo. Todo lo demás está
subordinado.

Consecuencia operativa: **entre dos opciones de diseño gana siempre la que
aumente la presión social**, aunque haga el mundo menos realista. Sobrevivir
solo tiene que ser muy difícil; sobrevivir informado, mucho más fácil. Ese es
el parámetro más importante del sistema.

Herramientas, construcción y objetos son secundarios. No se invierte esfuerzo
ahí hasta que el canal de señales funcione.

---

## 1. Prohibido

### 1.1 Programar un comportamiento
Se programa la física que lo hace posible, nunca el comportamiento.

- **Prohibido**: construir refugio, formar tribu, cortejar, cazar en grupo,
  aprender fuego, enseñar, huir del depredador, cuidar a la cría, migrar.
- **Permitido**: temperatura, energía, daño, contacto, difusión, marcas en el
  suelo, coste de moverse, coste de emitir.

Prueba de olfato: si el nombre de una función, una rama `if` o un comentario
describe una *intención* de la criatura, está mal. Solo se describen fuerzas.

### 1.2 Agregar un sexto verbo
Los verbos son cinco y no hay más:
1. mover (x, y)
2. agarrar / soltar
3. morder
4. emitir señal (vector de 4)
5. rascar el suelo

No se agrega "comer" (comer es morder), ni "aparearse" (es contacto + química),
ni "hablar" (es emitir señal), ni "atacar" (es morder). El test de ausencia de
guion falla si el vector de salida del cerebro cambia de tamaño.

### 1.3 Listas predefinidas
Prohibido declarar en el código: tabla de especies, catálogo de moléculas,
diccionario de palabras, lista de glifos, enum de sustancias, tipos de bicho.

Todo eso **se detecta a posteriori** analizando el estado y se etiqueta solo
para mostrarlo en la interfaz. Una especie es un cluster en el espacio de
genomas. Una palabra es una nube estable en el espacio de señales. Un microbio
es un ciclo autocatalítico detectado en la red de reacciones. Ninguno de los
tres existe como campo que gobierne nada.

Excepción única y explícita: el **alfabeto de átomos** (4–8 tipos con sus
propiedades) y las **reglas de reescritura** (partir, unir, sustituir). Son
las leyes de la física del mundo, son pocas y no cambian nunca. Toda la
variedad sale del espacio de cadenas, no de la tabla.

### 1.4 Disparar eventos por decreto
Que aparezca vida, que llegue una plaga, que se descubra algo, que nazca un
depredador: todo sale de las reglas o no sale. No hay `if (tick == N) spawn(...)`.

### 1.5 Dar recompensa por comportamientos
La única señal de recompensa que existe es **energía menos dolor**. Prohibido
premiar reproducirse, comunicar, cooperar, explorar, agruparse o emitir. Si el
canal de señales queda mudo, se sube el valor de la información (depredadores
más letales, comida enterrada más rica, vida solitaria más dura); **nunca** se
premia el acto de emitir.

### 1.6 Casos especiales
Prohibido meter una excepción para que algo "por fin funcione". Un resultado
nulo honesto vale más que uno falso. Prohibido escribir a mano un resultado
bonito y presentarlo como emergente.

### 1.7 Parámetros escondidos
Todo parámetro vive en un **único archivo de constantes**, comentado, con
unidades y con el rango que se probó. Cero números mágicos dentro de la lógica.

---

## 2. Obligatorio

### 2.1 Determinismo estricto
- RNG sembrado y explícito. Prohibido `Math.random()`, `Date.now()`,
  `performance.now()` y cualquier iteración sobre orden de `Map`/`Set` que
  dependa de inserción no determinista dentro del bucle de simulación.
- Mismo estado + misma semilla ⇒ mismo resultado tras 10.000 ticks.
- Estado completamente serializable. La simulación no guarda nada en cierres,
  variables de módulo ni en el DOM.
- El reparto en lotes de la química es determinista: función del número de
  tick, **nunca** de la cámara, del framerate ni de la visibilidad.
- Las funciones trascendentes (`exp`, `tanh`, `pow`, `sin`) no están
  especificadas bit a bit por el estándar de JavaScript: se usan las
  implementaciones propias del proyecto, no las del motor.

### 2.2 Conservación
- La materia total del mundo no cambia jamás. Cada átomo tiene dueño: celda,
  cuerpo, cadáver, objeto o sumidero inerte.
- La energía se contabiliza: lo que entra (sol) y lo que sale (disipación)
  se registran en la telemetría cada tick.

### 2.3 Estado versionado
Versión de esquema desde el primer commit, con su migración. **Nunca se borra
un mundo por un cambio de formato.** Export/import a archivo.

### 2.4 Presupuesto de rendimiento
16 ms de CPU por tick en tiempo real (tick = 1 s real). Si se pasa, **se
recorta la química antes que los bichos**. El recorte es un parámetro del
archivo de constantes, no una decisión escondida.

### 2.5 Toda la simulación en el Worker
El hilo principal solo dibuja y recibe instantáneas. El render nunca bloquea
la simulación ni al revés. Ninguna decisión de simulación depende de si hay
una pestaña visible.

### 2.6 Nada llega a tiempo real sin pasar por el laboratorio
Antes de que nadie mire un mundo, esa semilla se corre acelerada, sin render,
y la telemetría dice si el canal de señales despegó. Solo las semillas donde
emergió comunicación se promueven a mundo jugable.

---

## 3. Cómo se reporta

- Cuando algo no funcione: decirlo tal cual, con la métrica que lo muestra, y
  proponer **qué parámetro tocar**.
- Ninguna fase se da por terminada hasta cumplir su criterio de aceptación
  medible (ver `docs/PLAN.md`). "Se ve bien" no es un criterio.
- Los detectores de degeneración (bichos girando en círculo, linajes que se
  comen sus crías en bucle, señales gratis emitidas sin parar) **no prohíben**
  esos comportamientos: los reportan en la telemetría, porque casi siempre
  significan que a una acción le falta coste.
- Las supersticiones y los errores heredados son contenido, no bugs. No se
  agrega nada que los evite.

---

## 4. Modos de fallo conocidos y cómo NO arreglarlos

| Fallo | Se arregla con | NO se arregla con |
|---|---|---|
| La química se estanca en el equilibrio | más energía entrando y más saliendo | programar un replicador a mano o sembrar moléculas especiales |
| El canal de señales queda mudo | información asimétrica más valiosa | premiar el acto de emitir |
| Nunca aparece vida macroscópica | revisar el umbral del puente química→cuerpos | instanciar criaturas por evento |
| Todo degenera en un exploit aburrido | ponerle coste energético a la acción explotada | prohibir la acción |
| No se puede mirar | trabajar la capa de observación | agregar objetivos, misiones o puntuación |

---

## 5. Arquitectura fija

TypeScript + Vite · Three.js cenital con primitivas · toda la simulación en un
Web Worker · tick fijo de 1 s con catch-up acelerado · IndexedDB con versión de
esquema · PWA instalable · deploy a GitHub Pages · **sin servidor y sin
cuentas**: cada persona genera su propio mundo con su propia semilla, guardado
en su dispositivo.

---

## 6. Orden de trabajo

Se construye **por fases, en orden, una por sesión**. No se adelantan fases.
El plan y los criterios de aceptación están en `docs/PLAN.md`. Los riesgos
abiertos y las decisiones pendientes, en `docs/RIESGOS.md`; ese archivo se
actualiza al cerrar cada fase.
