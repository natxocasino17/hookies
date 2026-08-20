# Lo que me parece frágil, ambiguo o irrealizable

Lista honesta, antes de escribir código, ordenada por gravedad. Cada punto
dice **qué falla**, **por qué**, y **qué propongo**. Al final, las decisiones
que necesito que tomes vos.

Los cálculos de rendimiento asumen JavaScript sobre `Float32Array` y enteros,
en el rango de 100–500 millones de operaciones útiles por segundo en un móvil
de gama media. Son estimaciones de orden de magnitud, no benchmarks; el
laboratorio de la fase 0 existe justamente para reemplazarlas por números
medidos.

---

## 1. El puente química → cuerpos no está especificado, y no puede ser emergente

**El problema.** La especificación prohíbe instanciar criaturas por evento
(§2, §7) y dice que la vida macroscópica sale de la química. Pero la sección
4.3 describe a la criatura como genoma + cuerpo + red neuronal, y en ningún
lado dice **cómo** un ciclo autocatalítico de la sopa se convierte en eso. La
sección 7 habla de "revisar el umbral del puente entre química y cuerpos",
dando por supuesto un puente que nunca se define.

**Por qué es grave.** Cualquier regla del tipo "si el ciclo X supera la
concentración Y, nace una criatura" **es** un evento por decreto: tiene un
disparador químico en vez de un disparador temporal, pero sigue siendo una
instanciación escrita por mí. No hay continuidad física entre "cadenas de 12
átomos reaccionando en una celda" y "un cuerpo con visión por rayos y una red
recurrente de 64 neuronas". Es un salto, y llamarlo emergencia sería
exactamente el resultado bonito y falso que el documento prohíbe.

**Qué propongo.** Escribirlo como lo que es: **una sola regla de transición,
explícita, en el archivo de constantes, documentada como el punto menos
emergente del proyecto**. Un ciclo autocatalítico que se sostiene por encima
de un umbral durante N ticks condensa su materia en un cuerpo cuyo genoma se
deriva determinísticamente de las cadenas del ciclo. Sin listas, sin
plantillas, con masa conservada. Y no venderlo nunca como emergente: la
emergencia real está en *qué* ciclo aparece y en qué pasa después, no en el
salto.

**Alternativa que descarto**: fingir que el cuerpo es "solo química a otra
escala". Sería mentira y costaría meses.

---

## 2. La autocatálisis probablemente no aparezca sola, y el top-N puede impedirla

Son dos problemas y los dos bloquean la fase 2.

**2a. Falta la regla de catálisis.** La sección 4.1 dice que la ocurrencia de
una reacción depende de las propiedades de los átomos, la temperatura y las
concentraciones, y después afirma que "algunas moléculas van a catalizar
reacciones que las producen a ellas mismas". Eso no se sigue de lo anterior:
con esas tres variables no hay catálisis en absoluto, porque ninguna molécula
influye en la tasa de una reacción en la que no participa. En las químicas
artificiales que sí producen conjuntos autocatalíticos, la catálisis es una
regla explícita basada en la *forma* de la cadena, más un conjunto de
alimento repuesto continuamente.

*Propongo*: una regla única, sin catálogo — una cadena cataliza una reacción
cuando sus extremos son complementarios con los de los reactivos, multiplicando
la tasa por un factor. Es una ley física más, del mismo rango que "partir" o
"unir". Es el parámetro que más va a decidir si la fase 2 pasa.

**2b. El top-N puede matar precisamente lo que buscamos.** Seguir solo las 24
moléculas más concentradas por celda y mandar el resto al sumidero inerte tiene
un sesgo estructural: **un ciclo autocatalítico nuevo es raro antes de ser
abundante**. Nace con concentración baja, cae del top-N, se va al sumidero y
nunca llega a arrancar. La optimización de rendimiento estaría filtrando
exactamente el fenómeno que la fase 2 tiene que detectar.

*Propongo*: que el sumidero no sea un pozo sin retorno sino un depósito con
reingreso probabilístico determinista, y medir en el laboratorio la tasa de
aparición de ciclos con y sin él. Si el efecto es fuerte, subir N y bajar el
tamaño de lote (más lento pero honesto) antes que aceptar el sesgo.

---

## 3. Un genoma de 12 átomos no puede contener un cerebro

**Los números.** Alfabeto de 6 átomos y cadena máxima de 12 dan como mucho
6¹² ≈ 2·10⁹ genomas distintos, es decir **unos 31 bits de información**. De ahí
tienen que salir once rasgos corporales (tamaño, velocidad, metabolismo, dieta,
longevidad, visión, olfato, umbral de dolor, tamaño de cerebro, coste de emitir,
edad reproductiva) **y además** los pesos de una red de ~6.700 conexiones. No
entra, por tres órdenes de magnitud.

**Por qué no sirve la salida obvia.** Usar el genoma como semilla de un PRNG
que expande los pesos rompe la sección 4.5.1: si un átomo muta, el generador
produce una red completamente distinta, y el instinto **no puede acumularse a
lo largo de generaciones**, que es el mecanismo entero de la herencia de
comportamiento.

**Qué propongo.** Dos longitudes máximas distintas, no una:
- `MAX_CHAIN_SOPA = 12` para la química ambiental, por rendimiento.
- `MAX_CHAIN_GENOMA` en el orden de los miles, para el genoma, que **no
  participa del top-N de la celda** y solo entra en reacciones metabólicas
  explícitas.

Con un átomo por peso (6 niveles de peso, suficiente si hay aprendizaje en
vida) un genoma de ~7.000 átomos codifica rasgos y cerebro entero, y la
mutación sigue siendo lo que pide la especificación: **errores de copia de la
propia química**, locales y graduales. Almacenamiento: ~7 KB por criatura,
~3,5 MB con 500 criaturas. Aceptable.

**El costo honesto de esto**: una cadena de miles de átomos jamás se va a
ensamblar sola desde una sopa de cadenas de 12. Refuerza el punto 1 — el
puente es un salto, no un continuo.

---

## 4. El presupuesto de 16 ms no da para 128×128 + N=24 + población densa

**Las cuentas.**

*Química*: 16.384 celdas × 276 pares de moléculas (con N=24) × ~50 operaciones
por par ≈ 226 M operaciones para recorrer el grid entero. Para caber en 16 ms
(unos 3,2 M operaciones) hay que actualizar **unas 230 celdas por tick**, o sea
cada celda reacciona una vez cada 70 ticks. Con tick = 1 s, la química corre 70
veces más lenta que el resto del mundo.

*Cerebros*: ~6.700 multiplicaciones-acumulaciones por criatura y tick. Con 2.000
criaturas son 13,4 M, entre 27 y 67 ms: **por sí solos ya se pasan del
presupuesto**. Con 500 criaturas quedan en 7–17 ms, justo en el límite, y sin
dejar nada para la química.

**Medido, capa a capa** (laboratorio, planeta de 2.562 celdas salvo la primera):

| Qué hay en el mundo | ms por tick |
|---|---|
| Solo difusión de materia, rejilla plana 64×64 | 0,037 |
| Lo mismo sobre la esfera | 0,066 |
| Con clima, agua y viento | 1,00 |
| Con casi 8.000 plantas encima | 1,55 |

Dos cosas que dice esta tabla. Una: pasar a la esfera costó **casi el doble** por
el acceso desordenado a la tabla de vecinos, exactamente el riesgo que se
anticipó aquí. Dos: **lo caro es el clima, no la vida** — las 8.000 plantas
suman 0,25 ms y el clima solo 0,95. Se intentó quitar las copias por tick
creyendo que eran la culpable y no cambió nada: el coste está en saltar por la
memoria, no en pedirla.

A 1,55 ms queda margen de diez veces sobre el presupuesto de 16 ms, pero el
margen se lo van a comer los cerebros, que es donde estaba la estimación
peligrosa.

**Efecto secundario que ya molesta**: la batería de tests tarda unos cuatro
minutos la parte rápida y más de diez la completa, porque comprobar lo que
emerge exige simular años. Se partió en dos (`npm run test:rapido` y
`npm test`), porque **un test que no se corre porque tarda mucho es un test que
no existe**.

**Qué propongo.** Empezar en **64×64 (4.096 celdas) y ~500 criaturas**, no en
128×128. No es solo por rendimiento: cumple mejor el objetivo declarado en §1.1
—mundo chico, población densa, encuentros constantes—. Con 500 bichos en
64×64 hay uno cada 8 celdas; con 500 en 128×128 hay uno cada 33 y son bichos
perdidos en un continente vacío, que es justo lo que el documento no quiere.
Subir el grid después, si el laboratorio dice que sobra presupuesto.

También: cuando la regla dice "se recorta la química antes que los bichos", ese
recorte tiene que ser un parámetro visible, y su efecto sobre la aparición de
ciclos (punto 2b) hay que medirlo, no suponerlo.

---

## 5. La imitación entre cerebros de tamaños distintos no está definida

Copiar "un subconjunto de pesos" de una red de 16 ocultas a una de 64 no
significa nada: los índices no se corresponden, y copiar pesos entre redes
organizadas de forma distinta es ruido destructivo, no cultura.

**Propongo**: tamaño fijo en memoria (64 ocultas) con una **máscara genética**
que activa entre 16 y 64. Todas las criaturas comparten un espacio de índices
común, así que herencia e imitación quedan bien definidas y el gen de tamaño de
cerebro sigue existiendo y sigue costando energía. Costo: unos pocos KB por
criatura de memoria desaprovechada. Barato.

---

## 6. El determinismo entre navegadores no es gratis

`Math.exp`, `Math.tanh`, `Math.pow` y `Math.sin` **no están especificados bit a
bit** por el estándar de JavaScript: cada motor puede dar un último bit distinto.
Las operaciones básicas (+, −, ×, ÷, √) sí son deterministas por IEEE-754. En un
sistema caótico corriendo 10⁶ ticks, un bit de diferencia diverge en mundos
enteros.

Esto no rompe el test de determinismo local, pero **sí rompe la semilla
compartible de §5.7**: tu mundo en Chrome y el mío en Safari serían distintos.

**Propongo**: implementaciones propias por aproximación polinómica de las cuatro
funciones que aparecen en el bucle caliente, prohibidas las del motor dentro de
`sim/`. Es trabajo de la fase 0 y hace la promesa de la semilla compartible
realista en vez de aspiracional.

---

## 7. "Millones de ticks en pocos segundos" y el catch-up de un día están fuera de escala

**Creación del mundo (§5.9).** A un coste optimista de 0,1 ms por tick de solo
química en 64×64, diez segundos dan **~100.000 ticks**, no millones. Para llegar
a millones hace falta el laboratorio en Node corriendo minutos u horas, no el
navegador durante la pantalla de creación.

*Propongo*: la pantalla de creación muestra el número **real**. Si son 100.000
ticks, dice 100.000. Nunca un número inflado, que sería la clase de resultado
falso que el documento prohíbe.

**Catch-up (§3, fase 6).** Un día cerrado son 86.400 ticks a x1, 864.000 a x10 y
**8,64 millones a x100**. Aun a 1 ms por tick en modo rápido: 86 s, 14 min y 2,4
horas respectivamente. La promesa "cierro la app un día, la abro, y el mundo
avanzó" es viable a x1, incómoda a x10 e imposible a x100.

*Propongo*: tope duro de catch-up, configurable, **visible en la interfaz** —
"se corrieron 200.000 de los 8.640.000 ticks transcurridos"—. Es una desviación
real de lo que pide la especificación y prefiero que esté a la vista antes que
resuelta en silencio.

**Y x100 contra el presupuesto de 16 ms**: a x100 hacen falta 100 ticks por
segundo real; a 16 ms cada uno son 1,6 segundos de CPU por segundo. x100 no
puede ser una garantía, solo un "lo más rápido que se pueda", con la telemetría
reportando el factor realmente alcanzado. En móvil, además, con
estrangulamiento térmico.

---

## 8. Los depredadores contradicen la prohibición de eventos por decreto

La sección 4.5 pide "depredadores letales que aparecen desde fuera del alcance
visual de la mayoría, y bastante frecuentes", como pilar de la presión para
comunicar. Pero §2 prohíbe que aparezca nada por decreto. Si los depredadores
son criaturas evolucionadas, no puedo garantizar que existan, ni que sean
letales, ni que sean frecuentes — y sin esa presión el canal de señales se
queda mudo, que es el fracaso declarado del proyecto.

**Propongo**: que el peligro sea **una amenaza física del mundo**, no una
criatura — un peligro móvil con reglas propias, del mismo rango ontológico que
una tormenta o un incendio, declarado en el archivo de constantes como parte de
la física. Es honesto (no es un bicho disfrazado), no viola la prohibición (es
clima, no un evento puntual), y da la asimetría de información que el proyecto
necesita. Cuando la depredación evolucione sola entre criaturas, mejor; hasta
entonces, la presión existe igual.

Si preferís la lectura estricta —solo depredadores evolucionados— hay que
aceptar que las fases 4 y 5 pueden quedarse mudas por falta de presión, y decirlo
de antemano.

---

## 9. Contradicciones menores pero concretas

- **Cría con "el cerebro casi en blanco" (§4.4) vs. "los pesos iniciales vienen
  de los padres" (§4.5.1).** Se contradicen. *Propongo*: pesos heredados, pero
  ganancia de salida y plasticidad que maduran con la edad. Nacen torpes con
  instinto latente, que creo que es lo que buscás.

- **"Se puede mirar diez minutos y se ve cambiar con sentido" (fase 1).** A x1
  son 600 ticks: las plantas apenas se mueven. El criterio solo es evaluable a
  x10 o más, o con constantes de clima mucho más rápidas.

- **El test de ausencia de guion es un lint, no una prueba.** Puede detectar un
  sexto verbo (tamaño del vector de salida), un enum de especies o un array
  literal de moléculas. No puede detectar un comportamiento programado con
  nombres inocentes. Sirve como red de seguridad, no como garantía; la garantía
  es la revisión.

- **Migraciones desde el primer commit vs. un esquema que va a cambiar en cada
  fase.** Escribir migraciones para las fases 0–5 es trabajo tirado: el esquema
  no se parece a sí mismo entre fases. *Propongo*: la maquinaria de versionado
  existe desde el commit uno (es barata), pero los mundos creados antes de la
  fase 6 se marcan como desechables, y la promesa de "nunca se borra un mundo"
  empieza a valer cuando el formato se estabiliza. Prefiero decirlo ahora a
  romperte un mundo de meses en la fase 4.

- **"Grupo social" (§4.6) no está definido** y hay que detectarlo antes de poder
  clusterizar señales por grupo. Es trabajo extra de la fase 5 y sus resultados
  son inestables mientras la población es chica.

- **Guardado en IndexedDB**: un snapshot completo ronda los 10 MB con genomas
  largos. Guardar cada tick es inviable en móvil. Guardado incremental o cada N
  ticks más al ocultar la pestaña.

- **Intervenciones y semilla compartible (§5.7)** se guardan como pares
  (tick, intervención). Si el catch-up tiene tope (punto 7), el número de tick
  diverge entre dispositivos y el mundo reproducido deja de coincidir. Hay que
  fijar el reloj de intervenciones al tick simulado, no al tiempo real.

---

## 10. No hay objetos, así que la tecnología es imposible

**El problema.** Uno de los cinco verbos es agarrar y soltar. Pero el mundo
contiene celdas, cuerpos, cadáveres y marcas del suelo, y nada más. No existe
"un objeto": una cosa suelta en el suelo que se pueda coger, llevar y dejar en
otro sitio.

**Por qué importa ahora.** Se pidió ver si avanzan tecnológicamente. Sin cosas
que coger, eso no es improbable: es imposible. Y para que la tecnología pueda
aparecer, los objetos además tienen que **pesar y servir**: que llevar algo duro
suba el daño del mordisco, que llevar algo pesado cueste energía, que llevar
algo ardiendo lleve el fuego, que soltarlo tape el paso.

**Qué propongo.** Un objeto **no es un tipo de una lista** —eso rompería §1.3—:
es un trozo de materia con una composición, igual que una molécula es su cadena.
Duro porque le tocaron átomos duros; arde porque le tocaron átomos que arden.
Nadie escribe "piedra" en ninguna parte. Los trozos salen de lo que ya hay:
sólidos que precipita la química, restos de cadáveres, ceniza del fuego. Y
partir un trozo grande en dos es **morderlo**: no hace falta ningún verbo nuevo.

**Cómo se mediría**: un linaje coge habitualmente trozos de cierta composición
antes de hacer cierta cosa, por encima de lo que daría el azar de tropezarse con
ellos.

**El riesgo del riesgo**: llevar cuesta energía. Si llevar nunca compensa, nadie
lleva nada y esto no pasa jamás. Es un número a ajustar —cuánto suma el mordisco
contra cuánto pesa— y ajustarlo es legítimo porque es física, no es premiar un
comportamiento.

**Coste**: es una pieza nueva de verdad y toca las fases 1, 2 y 3. Barata ahora,
cara más adelante.

---

## 11. Las heridas no se curan, así que la medicina no quiere decir nada

**El problema.** Un cuerpo tiene energía, daño y edad. La energía sube y baja.
**El daño solo sube.** No hay nada en todo el diseño que baje el daño de una
criatura.

**Por qué importa ahora.** Se pidió ver si avanzan médicamente. Una medicina es
algo que cura, y en un mundo donde las heridas no cierran nunca no hay nada que
una medicina pueda hacer. No es difícil: es que la palabra no significa nada.

**Qué propongo.** Dos cosas, las dos baratas:

1. **Que curarse exista**: el cuerpo puede gastar energía y materia en bajarse el
   daño. Es fisiología normal, cicatrizar cuesta calorías.
2. **Que algunas moléculas cambien esa velocidad.** Y aquí no hay que inventar
   nada: el genoma **ya** decide qué reacciones sabe catalizar cada criatura, que
   es lo que decide qué le alimenta y qué le envenena. Curarse es una reacción
   más.

**La consecuencia buena**: la misma planta es medicina para un linaje y veneno
para otro, no porque esté escrito sino porque tienen química distinta. Dos
poblaciones vecinas con dos farmacopeas incompatibles, ninguna escrita a mano.

**Y la mejor**: la medicina puede estar equivocada. Un linaje puede aprender
"cuando duele, comer lo azul", que lo azul no haga nada, y pasarlo por
imitación. Es una superstición médica y se propaga como una cultura. El detector
tiene que medir las dos: las medicinas que funcionan y las que no.

**Coste**: casi gratis. Es un solo enlace entre la química y el cuerpo, y cabe
en la fase 3.

---

## 12. Lo que hay debajo de los dos anteriores

Los agujeros 10 y 11 son la misma cosa vista dos veces: **estaba diseñando un
mundo donde a las criaturas les pasan cosas, pero no un mundo al que las
criaturas le puedan hacer cosas**. Tienen un verbo para agarrar y casi nada que
agarrar; tienen un verbo para morder y nada que morder pueda arreglar.

Conviene tenerlo como prueba de olfato al diseñar cada capa nueva: *¿esto que
estoy añadiendo es solo algo que les ocurre, o es también algo con lo que pueden
hacer algo?*

---

## 13. Lo que sí me parece sólido

Para que la lista no parezca una queja general: la arquitectura (worker + tick
fijo + estado serializable), el determinismo como requisito de primera clase, el
laboratorio antes que el render, la telemetría desde el tick cero, los
detectores de degeneración que reportan en vez de prohibir, y sobre todo la
decisión de §1.1 de subordinar todo a la presión social — todo eso está bien
pensado y es lo que hace el proyecto viable. La mayoría de los proyectos de esta
clase mueren por no tener el laboratorio o por ajustar a ojo.

---

## Lo que necesito que decidas antes de la fase 2

Las tres primeras son las que bloquean; las demás las puedo resolver como
propongo y revisás después.

Los puntos 1, 3, 8 y 4 quedaron resueltos en `DECISIONES.md` (D1, D2, D3, D4 y
D10). Lo que sigue abierto:

1. **Los objetos** (punto 10): son la pieza que falta para que la tecnología sea
   siquiera posible, y hay que decidir si entran, porque tocan tres fases.
2. **Curarse** (punto 11): más barato y más claro. Salvo objeción, entra en la
   fase 3 tal como está propuesto.
3. **El top-N contra los ciclos raros** (punto 2b): esto solo lo puede contestar
   el laboratorio, midiendo con y sin depósito de reingreso.
