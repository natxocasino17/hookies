/**
 * Los cuerpos.
 *
 * ── EL PUENTE, SIN DISFRAZARLO ──────────────────────────────────────────────
 *
 * Cuando un ciclo autocatalítico se sostiene en una celda por encima de un
 * umbral durante un rato, su materia se condensa en un cuerpo. **Esa regla la
 * escribí yo**, y es el único punto del proyecto donde el resultado lo decide
 * una regla mía en vez de salir de la física (decisión D1). No hay continuidad
 * honesta entre cadenas de ocho átomos reaccionando y un cuerpo con sentidos:
 * es un salto, y llamarlo emergencia sería exactamente el resultado bonito y
 * falso que el proyecto prohíbe.
 *
 * Lo que sí es enteramente emergente: **qué** ciclo aparece, cuándo, en qué
 * celda, con qué genoma — y absolutamente todo lo que pase después de nacer.
 *
 * ── Y lo que NO hay aquí ────────────────────────────────────────────────────
 *
 * Ninguna función de este archivo describe la intención de una criatura. No hay
 * buscar comida, ni huir, ni cortejar. Hay energía que baja, daño que sube,
 * materia que cambia de sitio y muerte. Lo que las criaturas hagan con eso —si
 * es que llegan a hacer algo— es cosa suya y de la fase 4.
 */

import {
  CONSTANCIA_DEL_PUENTE,
  COSTE_DE_EMITIR,
  COSTE_DE_MORDER,
  COSTE_DE_MOVERSE,
  COSTE_DE_RASCAR,
  CURACION_POR_TICK,
  DANO_MORTAL,
  DANO_POR_GRADO,
  DANO_POR_MORDISCO,
  EDAD_REPRODUCTIVA,
  EFICACIA_MINIMA_DIETA,
  ENERGIA_AL_NACER,
  ENERGIA_DE_LA_CRIA,
  ENERGIA_DEL_GAMETO,
  ENERGIA_PARA_CURARSE,
  ENERGIA_PARA_GEMAR,
  ENERGIA_POR_BOCADO,
  ENERGIA_POR_CURARSE,
  EXCRECION_POR_TICK,
  FUERZA_DE_LA_SENAL,
  FUERZA_DEL_RASCADO,
  FERTILIDAD_MINIMA,
  INERCIA_TERMICA_DEL_CUERPO,
  LONGEVIDAD_MINIMA,
  MARGEN_TERMICO,
  MATERIA_AL_NACER,
  MATERIA_DE_LA_CRIA,
  MATERIA_DEL_GAMETO,
  MATERIA_POR_MORDISCO,
  MUESTRAS_DE_GAMETO,
  AGUANTE_MINIMO,
  MAX_CADENA_GENOMA,
  MAX_CRIATURAS,
  MAX_VECINOS,
  METABOLISMO_BASE,
  MIRAR_EL_PUENTE_CADA,
  N_TIPOS_ATOMO,
  PERMANENCIA_MARCA_POR_MIL,
  PERMANENCIA_SENAL_POR_MIL,
  PARECIDO_MINIMO_PARA_CRUZAR,
  PARECIDO_SEGURO_PARA_CRUZAR,
  PROB_EMITIR,
  PROB_MORDER,
  PROB_MOVER,
  PROB_RASCAR,
  PUDRICION_DIVISOR,
  RANGO_DE_FERTILIDAD,
  RANGO_DE_LONGEVIDAD,
  RANGO_DE_TAMANO,
  RANGO_TEMPERATURA_CUERPO,
  REPARTO_SENAL_POR_MIL,
  RITMO_MINIMO,
  SILENCIO,
  TAMANO_MINIMO,
  TEMPERATURA_PREFERIDA_MINIMA,
  TOP_N_MOLECULAS,
  UMBRAL_DEL_PUENTE,
} from './constants.js';
import type { EstadoMundo } from './estado.js';
import type { Geometria } from './geodesica.js';
import { siguienteDecimal, siguienteEntero } from './rng.js';
import { esAutocatalitica } from './autocatalisis.js';
import { atomoEn, longitud, MOLECULA_VACIA } from './molecula.js';
import {
  copiarConErratas,
  genomaDesdeLaCadena,
  leerRasgo,
  parecidoEntreGenomas,
  recombinarConErratas,
  RASGO_DIETA_CARNE,
  RASGO_DIETA_VEGETAL,
  RASGO_EDAD_FERTIL,
  RASGO_LONGEVIDAD,
  RASGO_METABOLISMO,
  RASGO_TAMANO,
  RASGO_TEMPERATURA,
  RASGO_UMBRAL_DOLOR,
} from './genoma.js';

/** Tamaño del cuerpo a partir del gen. Entre medio y dos y medio. */
function tamanoDe(genomas: Uint8Array, base: number): number {
  return TAMANO_MINIMO + leerRasgo(genomas, base, RASGO_TAMANO) * RANGO_DE_TAMANO;
}

/**
 * Cuántos ticks vive antes de morirse de vieja.
 *
 * Hoy no llega a pasar nunca: se mueren de hambre mucho antes. Está medido y
 * anotado junto a `LONGEVIDAD_MINIMA`.
 */
function longevidadDe(genomas: Uint8Array, base: number): number {
  return LONGEVIDAD_MINIMA + leerRasgo(genomas, base, RASGO_LONGEVIDAD) * RANGO_DE_LONGEVIDAD;
}

/** La temperatura que le sienta bien a este linaje. */
function temperaturaPreferidaDe(genomas: Uint8Array, base: number): number {
  return (
    TEMPERATURA_PREFERIDA_MINIMA +
    leerRasgo(genomas, base, RASGO_TEMPERATURA) * RANGO_TEMPERATURA_CUERPO
  );
}

/**
 * Mete una criatura en la lista de su celda, **en orden de ranura**.
 *
 * El orden no es cosmético: morder muerde a la primera de la celda, así que
 * quién va delante decide a quién le toca el mordisco. Manteniéndolo ordenado
 * por ranura, es la misma que elegía el recorrido de todas las ranuras, y
 * además el índice se puede reconstruir al cargar un mundo sin cambiar nada.
 */
function entrarEnLaCelda(estado: EstadoMundo, c: number, celda: number): void {
  let previa = -1;
  let actual = estado.cabezaEnCelda[celda]!;
  while (actual >= 0 && actual < c) {
    previa = actual;
    actual = estado.siguienteEnCelda[actual]!;
  }
  estado.siguienteEnCelda[c] = actual;
  if (previa < 0) estado.cabezaEnCelda[celda] = c;
  else estado.siguienteEnCelda[previa] = c;
}

/** La saca de la lista de su celda. */
function salirDeLaCelda(estado: EstadoMundo, c: number, celda: number): void {
  let previa = -1;
  let actual = estado.cabezaEnCelda[celda]!;
  while (actual >= 0 && actual !== c) {
    previa = actual;
    actual = estado.siguienteEnCelda[actual]!;
  }
  if (actual !== c) return;
  const detras = estado.siguienteEnCelda[c]!;
  if (previa < 0) estado.cabezaEnCelda[celda] = detras;
  else estado.siguienteEnCelda[previa] = detras;
  estado.siguienteEnCelda[c] = -1;
}

/** Busca un hueco libre en la lista de criaturas. Determinista. */
function huecoLibre(estado: EstadoMundo): number {
  for (let n = 0; n < MAX_CRIATURAS; n++) {
    const i = (estado.cursorCriatura + n) % MAX_CRIATURAS;
    if (estado.criaturaCelda[i]! < 0) {
      estado.cursorCriatura = (i + 1) % MAX_CRIATURAS;
      return i;
    }
  }
  return -1;
}

/** Devuelve el cuerpo a la tierra: su materia pasa a ser carroña. */
function morir(estado: EstadoMundo, c: number): void {
  const celda = estado.criaturaCelda[c]!;
  if (celda < 0) return;
  // El gameto que no llegó a gastarse es carne como el resto del cuerpo.
  estado.carrona[celda] =
    estado.carrona[celda]! + estado.criaturaMateria[c]! + estado.criaturaGameto[c]!;
  estado.criaturaMateria[c] = 0;
  estado.criaturaGameto[c] = 0;
  salirDeLaCelda(estado, c, celda);
  estado.criaturaCelda[c] = -1;
  estado.muertesEsteTick++;
}

// ---------------------------------------------------------------------------
// EL PUENTE
// ---------------------------------------------------------------------------

/**
 * Mira si alguna celda tiene un ciclo autocatalítico lo bastante fuerte y
 * constante como para condensarse en un cuerpo.
 *
 * Esta es la regla escrita a mano. Todo lo demás del archivo es física.
 */
function mirarElPuente(estado: EstadoMundo, geo: Geometria): void {
  for (let celda = 0; celda < geo.nCeldas; celda++) {
    const base = celda * TOP_N_MOLECULAS;
    let mejor = MOLECULA_VACIA;
    let mejorCantidad = 0;

    for (let k = 0; k < TOP_N_MOLECULAS; k++) {
      const m = estado.sopaMolecula[base + k]!;
      if (m === MOLECULA_VACIA) continue;
      const cuantas = estado.sopaCantidad[base + k]!;
      if (cuantas < UMBRAL_DEL_PUENTE || cuantas <= mejorCantidad) continue;
      if (!esAutocatalitica(m)) continue;
      mejor = m;
      mejorCantidad = cuantas;
    }

    if (mejor === MOLECULA_VACIA) {
      estado.constanciaDelCiclo[celda] = 0;
      continue;
    }

    // Un pico pasajero no vale: tiene que sostenerse.
    estado.constanciaDelCiclo[celda] = estado.constanciaDelCiclo[celda]! + MIRAR_EL_PUENTE_CADA;
    if (estado.constanciaDelCiclo[celda]! < CONSTANCIA_DEL_PUENTE) continue;
    if (estado.materia[celda]! < MATERIA_AL_NACER) continue;

    const hueco = huecoLibre(estado);
    if (hueco < 0) {
      estado.topeDePoblacionTocado = true;
      continue;
    }

    // La materia del cuerpo sale del suelo de la celda, no de la nada.
    estado.materia[celda] = estado.materia[celda]! - MATERIA_AL_NACER;
    estado.constanciaDelCiclo[celda] = 0;

    const atomos: number[] = [];
    for (let i = 0; i < longitud(mejor); i++) atomos.push(atomoEn(mejor, i));
    genomaDesdeLaCadena(estado.criaturaGenoma, hueco * MAX_CADENA_GENOMA, atomos, estado.rng);

    estado.criaturaCelda[hueco] = celda;
    entrarEnLaCelda(estado, hueco, celda);
    estado.criaturaMateria[hueco] = MATERIA_AL_NACER;
    estado.criaturaGameto[hueco] = 0;
    estado.criaturaEnergia[hueco] = ENERGIA_AL_NACER;
    estado.criaturaDano[hueco] = 0;
    estado.criaturaEdad[hueco] = 0;
    estado.criaturaTemperatura[hueco] = estado.temperatura[celda]!;
    // Cada condensación funda un linaje nuevo. Los hijos heredan el número.
    estado.criaturaLinaje[hueco] = estado.siguienteLinaje++;
    estado.nacimientosEsteTick++;
  }
}

// ---------------------------------------------------------------------------
// Vivir
// ---------------------------------------------------------------------------

/** Un tick de cuerpos. */
export function avanzarLasCriaturas(estado: EstadoMundo, geo: Geometria): void {
  estado.nacimientosEsteTick = 0;
  estado.muertesEsteTick = 0;
  estado.cruzamientosEsteTick = 0;

  if (estado.tick % MIRAR_EL_PUENTE_CADA === 0) mirarElPuente(estado, geo);

  const genomas = estado.criaturaGenoma;
  let vivas = 0;
  let sumaEdadMuerte = 0;

  for (let c = 0; c < MAX_CRIATURAS; c++) {
    const celda = estado.criaturaCelda[c]!;
    if (celda < 0) continue;

    const base = c * MAX_CADENA_GENOMA;
    const tamano = tamanoDe(genomas, base);
    estado.criaturaEdad[c] = estado.criaturaEdad[c]! + 1;

    // --- Metabolismo: estar vivo cuesta ------------------------------------
    const ritmo = RITMO_MINIMO + leerRasgo(genomas, base, RASGO_METABOLISMO);
    estado.criaturaEnergia[c] = estado.criaturaEnergia[c]! - METABOLISMO_BASE * ritmo * tamano;

    // Se excreta materia, que vuelve al suelo. Nada se pierde.
    if (estado.criaturaMateria[c]! > MATERIA_DE_LA_CRIA) {
      estado.criaturaMateria[c] = estado.criaturaMateria[c]! - EXCRECION_POR_TICK;
      estado.materia[celda] = estado.materia[celda]! + EXCRECION_POR_TICK;
    }

    // --- Temperatura del cuerpo peleando con la del entorno -----------------
    const fuera = estado.temperatura[celda]!;
    estado.criaturaTemperatura[c] =
      estado.criaturaTemperatura[c]! +
      (fuera - estado.criaturaTemperatura[c]!) * INERCIA_TERMICA_DEL_CUERPO;
    const desvio = Math.abs(estado.criaturaTemperatura[c]! - temperaturaPreferidaDe(genomas, base));
    if (desvio > MARGEN_TERMICO) {
      estado.criaturaDano[c] = estado.criaturaDano[c]! + (desvio - MARGEN_TERMICO) * DANO_POR_GRADO;
    }

    // --- Los cinco verbos, elegidos al azar por ahora -----------------------
    //
    // En la fase 3 no hay cerebro: los verbos salen del azar sembrado. Es la
    // línea base contra la que se medirá si los cerebros de la fase 4 sirven
    // para algo. Sin esta comparación, "se mueven con sentido" sería una
    // impresión y no un dato.
    ejecutarVerbosAlAzar(estado, geo, c, celda, tamano);

    // --- Curarse cuesta comida (decisión D13) -------------------------------
    if (estado.criaturaDano[c]! > 0 && estado.criaturaEnergia[c]! > ENERGIA_PARA_CURARSE) {
      const cierra = Math.min(CURACION_POR_TICK, estado.criaturaDano[c]!);
      estado.criaturaDano[c] = estado.criaturaDano[c]! - cierra;
      estado.criaturaEnergia[c] = estado.criaturaEnergia[c]! - cierra * ENERGIA_POR_CURARSE;
    }

    // --- Reproducción --------------------------------------------------------
    //
    // Dos caminos, y el barato es el que necesita a otro. Con un poco de materia
    // de sobra el cuerpo aparta un gameto y lo lleva encima; si se cruza con
    // alguien que también lleva uno y las cadenas se parecen, se funden. Para
    // desprender una cría uno solo hace falta un excedente mucho mayor.
    //
    // Esa diferencia de precio no es un premio a juntarse: es que una cría hecha
    // entre dos la pagan dos cuerpos. Que a un bicho le acabe rentando estar
    // donde hay otros es justo la clase de cosa que tiene que salir sola.
    fabricarGameto(estado, genomas, c);
    if (estado.criaturaGameto[c]! > 0) juntarGametos(estado, geo, c, celda);

    const edadFertil =
      EDAD_REPRODUCTIVA *
      (FERTILIDAD_MINIMA + leerRasgo(genomas, base, RASGO_EDAD_FERTIL) * RANGO_DE_FERTILIDAD);
    if (
      estado.criaturaGameto[c]! > 0 &&
      estado.criaturaEnergia[c]! > ENERGIA_PARA_GEMAR &&
      estado.criaturaEdad[c]! > edadFertil &&
      estado.criaturaMateria[c]! > MATERIA_DE_LA_CRIA + MATERIA_DEL_GAMETO
    ) {
      gemar(estado, geo, c, celda);
    }

    // --- Morir ---------------------------------------------------------------
    const aguante = DANO_MORTAL * (AGUANTE_MINIMO + leerRasgo(genomas, base, RASGO_UMBRAL_DOLOR));
    const seMuere =
      estado.criaturaEnergia[c]! <= 0 ||
      estado.criaturaDano[c]! >= aguante ||
      estado.criaturaEdad[c]! > longevidadDe(genomas, base);

    if (seMuere) {
      sumaEdadMuerte += estado.criaturaEdad[c]!;
      morir(estado, c);
      continue;
    }
    vivas++;
  }

  estado.criaturasVivas = vivas;
  if (estado.muertesEsteTick > 0) {
    estado.edadMediaDeMuerte = sumaEdadMuerte / estado.muertesEsteTick;
  }

  pudrirLaCarrona(estado, geo);
  apagarElAireYElSuelo(estado, geo);
}

/**
 * Los cinco verbos con el mando en manos del azar.
 *
 * Ojo a lo que NO hay: ninguna elección mira si hay comida cerca, ni si hay
 * peligro, ni nada. Se tiran los dados. Lo único que hace el mundo es cobrar
 * la energía de cada acto y aplicar sus consecuencias físicas.
 */
function ejecutarVerbosAlAzar(
  estado: EstadoMundo,
  geo: Geometria,
  c: number,
  celda: number,
  tamano: number,
): void {
  const base = c * MAX_CADENA_GENOMA;

  // MOVER
  if (siguienteDecimal(estado.rng) < PROB_MOVER) {
    const k = siguienteEntero(estado.rng, geo.nVecinos[celda]!);
    const destino = geo.vecinos[celda * MAX_VECINOS + k]!;
    salirDeLaCelda(estado, c, celda);
    estado.criaturaCelda[c] = destino;
    entrarEnLaCelda(estado, c, destino);
    estado.criaturaEnergia[c] = estado.criaturaEnergia[c]! - COSTE_DE_MOVERSE * tamano;
    celda = destino;
  }

  // MORDER — lo que haya delante: plantas, carroña, u otro cuerpo.
  if (siguienteDecimal(estado.rng) < PROB_MORDER) {
    estado.criaturaEnergia[c] = estado.criaturaEnergia[c]! - COSTE_DE_MORDER * tamano;
    morder(estado, c, celda, base);
  }

  // EMITIR SEÑAL — cuesta y no da nada. **Nunca se premia emitir** (§1.5).
  //
  // Los cuatro números salen del azar porque en la fase 3 no hay cerebro que los
  // elija. O sea que ahora mismo el canal lleva ruido puro, y eso está bien: es
  // la línea base contra la que se va a medir si lo que emitan los cerebros de
  // la fase 4 lleva información o sigue siendo ruido. Sin esta medida, "están
  // hablando" sería una impresión.
  if (siguienteDecimal(estado.rng) < PROB_EMITIR) {
    estado.criaturaEnergia[c] = estado.criaturaEnergia[c]! - COSTE_DE_EMITIR;
    for (let k = 0; k < 4; k++) {
      const cuanto = (siguienteDecimal(estado.rng) * 2 - 1) * FUERZA_DE_LA_SENAL;
      estado.senalAire[celda * 4 + k] = estado.senalAire[celda * 4 + k]! + cuanto;
    }
    estado.senalesEsteTick++;
  }

  // RASCAR EL SUELO — deja cuatro números en la celda. Nadie los interpreta.
  //
  // La diferencia con la señal es cuánto dura: esto sigue estando cuando el que
  // lo rascó se ha muerto. Es lo único de este mundo que se parece a escribir.
  if (siguienteDecimal(estado.rng) < PROB_RASCAR) {
    estado.criaturaEnergia[c] = estado.criaturaEnergia[c]! - COSTE_DE_RASCAR;
    for (let k = 0; k < 4; k++) {
      const cuanto = (siguienteDecimal(estado.rng) * 2 - 1) * FUERZA_DEL_RASCADO;
      estado.marcaSuelo[celda * 4 + k] = estado.marcaSuelo[celda * 4 + k]! + cuanto;
    }
  }

  // AGARRAR / SOLTAR no hace nada todavía: no hay objetos sueltos (decisión
  // D11, pendiente). El verbo existe y su hueco está reservado.
}

/** Morder: quita materia de lo que haya y la convierte en cuerpo y energía. */
function morder(estado: EstadoMundo, c: number, celda: number, base: number): void {
  const genomas = estado.criaturaGenoma;

  // Primero carroña, que es lo que hay tirado en el suelo.
  if (estado.carrona[celda]! > 0) {
    const eficacia = EFICACIA_MINIMA_DIETA + leerRasgo(genomas, base, RASGO_DIETA_CARNE);
    const bocado = Math.min(MATERIA_POR_MORDISCO, estado.carrona[celda]!);
    estado.carrona[celda] = estado.carrona[celda]! - bocado;
    estado.criaturaMateria[c] = estado.criaturaMateria[c]! + bocado;
    estado.criaturaEnergia[c] = estado.criaturaEnergia[c]! + bocado * ENERGIA_POR_BOCADO * eficacia;
    return;
  }

  // Si no hay carroña, plantas. La eficacia con cada cosa sale del genoma, así
  // que herbívoro y carnívoro son dos extremos de un mismo gen y se puede
  // derivar de uno al otro. No hay dos tipos de bicho declarados.
  const conPlantas = estado.plantasEnCelda[celda]! > 0;
  if (conPlantas) {
    const eficacia = EFICACIA_MINIMA_DIETA + leerRasgo(genomas, base, RASGO_DIETA_VEGETAL);
    const bocado = mordisqueaUnaPlanta(estado, celda, MATERIA_POR_MORDISCO);
    if (bocado > 0) {
      estado.criaturaMateria[c] = estado.criaturaMateria[c]! + bocado;
      estado.criaturaEnergia[c] = estado.criaturaEnergia[c]! + bocado * ENERGIA_POR_BOCADO * eficacia;
      return;
    }
  }

  // Y si no, lo que haya vivo en la celda. Morder hace daño a lo que sea.
  for (let otro = estado.cabezaEnCelda[celda]!; otro >= 0; otro = estado.siguienteEnCelda[otro]!) {
    if (otro === c) continue;
    estado.criaturaDano[otro] = estado.criaturaDano[otro]! + DANO_POR_MORDISCO;
    const bocado = Math.min(MATERIA_POR_MORDISCO, estado.criaturaMateria[otro]!);
    if (bocado <= 0) break;
    const eficacia = EFICACIA_MINIMA_DIETA + leerRasgo(genomas, base, RASGO_DIETA_CARNE);
    estado.criaturaMateria[otro] = estado.criaturaMateria[otro]! - bocado;
    estado.criaturaMateria[c] = estado.criaturaMateria[c]! + bocado;
    estado.criaturaEnergia[c] = estado.criaturaEnergia[c]! + bocado * ENERGIA_POR_BOCADO * eficacia;
    break;
  }
}

/** Le arranca materia a la planta más grande de la celda. */
function mordisqueaUnaPlanta(estado: EstadoMundo, celda: number, cuanto: number): number {
  let mejor = -1;
  let mejorMasa = 0;
  for (let p = estado.cabezaPlantaEnCelda[celda]!; p >= 0; p = estado.siguientePlantaEnCelda[p]!) {
    if (estado.plantaMasa[p]! > mejorMasa) {
      mejorMasa = estado.plantaMasa[p]!;
      mejor = p;
    }
  }
  if (mejor < 0 || mejorMasa <= 0) return 0;
  const bocado = Math.min(cuanto, mejorMasa);
  estado.plantaMasa[mejor] = estado.plantaMasa[mejor]! - bocado;
  return bocado;
}

/**
 * Dos cuerpos que están en la misma celda juntan sus gametos.
 *
 * Esto NO es un sexto verbo y no es cortejar. Es lo que dice CLAUDE.md §1.2:
 * aparearse es contacto más química. Nadie busca pareja, nadie la elige y nadie
 * cobra nada por hacerlo — dos cuerpos que coinciden en una celda y que los dos
 * tienen de sobra para pagar una cría sueltan gametos, y los gametos se funden
 * o no según se parezcan sus cadenas. Un bicho solo en una celda no se cruza con
 * nadie, y no porque esté "buscando": porque no hay nadie.
 *
 * Y aquí es donde nacen las especies. No hay campo "especie" en ninguna parte:
 * hay un parecido que baja cuando dos poblaciones llevan mucho separadas, y una
 * rampa de probabilidad que se cierra sola cuando ese parecido cae. El día que
 * dos grupos ya no puedan cruzarse, nadie lo habrá decidido.
 *
 * Solo mira a las criaturas de ranura mayor que la suya, para que cada pareja se
 * mire una vez por tick y no dos, y para en cuanto una fusión sale bien: un
 * cuerpo paga una cría por tick como mucho, esté en una celda vacía o llena.
 */
function juntarGametos(
  estado: EstadoMundo,
  geo: Geometria,
  c: number,
  celda: number,
): void {
  const genomas = estado.criaturaGenoma;
  const mio = c * MAX_CADENA_GENOMA;

  for (let otro = estado.cabezaEnCelda[celda]!; otro >= 0; otro = estado.siguienteEnCelda[otro]!) {
    if (otro <= c) continue;
    if (estado.criaturaGameto[otro]! <= 0) continue;

    const parecido = parecidoEntreGenomas(
      genomas,
      mio,
      otro * MAX_CADENA_GENOMA,
      MUESTRAS_DE_GAMETO,
    );
    if (parecido < PARECIDO_MINIMO_PARA_CRUZAR) continue;

    // La rampa entre los dos umbrales es la fertilidad parcial de los híbridos.
    if (parecido < PARECIDO_SEGURO_PARA_CRUZAR) {
      const cuanto =
        (parecido - PARECIDO_MINIMO_PARA_CRUZAR) /
        (PARECIDO_SEGURO_PARA_CRUZAR - PARECIDO_MINIMO_PARA_CRUZAR);
      if (siguienteDecimal(estado.rng) > cuanto) continue;
    }

    if (crearCriaDeDos(estado, geo, c, otro, celda)) return;
  }
}

/**
 * Un cuerpo con materia de sobra aparta un poco en un gameto y lo lleva encima.
 *
 * Esto es lo que hace que el sexo pueda llegar a ocurrir, y la primera versión
 * no lo tenía. Antes bastaba con que dos cuerpos coincidieran fértiles en la
 * misma celda, y eso no pasa nunca: un cuerpo que llega al umbral gema en ese
 * mismo tick y vuelve a estar por debajo, así que dos no se solapan jamás.
 * Medido: 18 cruces en 19.519 nacimientos, o sea nada.
 *
 * Con el gameto guardado, un cuerpo anda por el mundo llevándolo puesto hasta
 * que se encuentra a alguien. Y apartarlo es barato comparado con costear una
 * cría entera, así que la mayoría lleva uno.
 *
 * No hay ninguna decisión aquí: si sobra materia, se aparta. Igual que se
 * excreta cuando sobra.
 */
function fabricarGameto(estado: EstadoMundo, genomas: Uint8Array, c: number): void {
  if (estado.criaturaGameto[c]! > 0) return;
  const base = c * MAX_CADENA_GENOMA;
  const edadFertil =
    EDAD_REPRODUCTIVA *
    (FERTILIDAD_MINIMA + leerRasgo(genomas, base, RASGO_EDAD_FERTIL) * RANGO_DE_FERTILIDAD);
  if (estado.criaturaEdad[c]! <= edadFertil) return;
  if (estado.criaturaMateria[c]! <= MATERIA_DE_LA_CRIA + MATERIA_DEL_GAMETO) return;
  if (estado.criaturaEnergia[c]! <= ENERGIA_DEL_GAMETO) return;

  estado.criaturaMateria[c] = estado.criaturaMateria[c]! - MATERIA_DEL_GAMETO;
  estado.criaturaGameto[c] = MATERIA_DEL_GAMETO;
  estado.criaturaEnergia[c] = estado.criaturaEnergia[c]! - ENERGIA_DEL_GAMETO;
}

/**
 * La cría de dos, con el genoma recombinado y la factura partida.
 *
 * Cada progenitor pone la mitad de la materia y de la energía. Eso hace que
 * tener una cría con alguien salga a mitad de precio que hacerla uno solo, y no
 * es un premio a aparearse: es que el coste se reparte entre dos cuerpos en vez
 * de salir de uno. La consecuencia —que a un bicho le rente estar donde hay
 * otros— es justo la clase de cosa que el proyecto quiere que aparezca sola
 * (CLAUDE.md §0), no una regla que empuje a juntarse.
 */
function crearCriaDeDos(
  estado: EstadoMundo,
  geo: Geometria,
  a: number,
  b: number,
  celda: number,
): boolean {
  const hueco = huecoLibre(estado);
  if (hueco < 0) {
    estado.topeDePoblacionTocado = true;
    return false;
  }

  recombinarConErratas(
    estado.criaturaGenoma,
    a * MAX_CADENA_GENOMA,
    b * MAX_CADENA_GENOMA,
    hueco * MAX_CADENA_GENOMA,
    estado.rng,
  );

  // La cría se hace con los dos gametos y nada más. La materia ya estaba
  // apartada, así que aquí solo cambia de sitio: sale de los dos gametos y entra
  // en el cuerpo nuevo, sin redondeos que puedan perder un átomo.
  const materiaDeLaCria = estado.criaturaGameto[a]! + estado.criaturaGameto[b]!;
  estado.criaturaGameto[a] = 0;
  estado.criaturaGameto[b] = 0;
  estado.criaturaEnergia[a] = estado.criaturaEnergia[a]! - ENERGIA_DE_LA_CRIA / 2;
  estado.criaturaEnergia[b] = estado.criaturaEnergia[b]! - ENERGIA_DE_LA_CRIA / 2;

  const k = siguienteEntero(estado.rng, geo.nVecinos[celda]! + 1);
  const destino = k === geo.nVecinos[celda]! ? celda : geo.vecinos[celda * MAX_VECINOS + k]!;

  estado.criaturaCelda[hueco] = destino;
  entrarEnLaCelda(estado, hueco, destino);
  estado.criaturaMateria[hueco] = materiaDeLaCria;
  estado.criaturaGameto[hueco] = 0;
  estado.criaturaEnergia[hueco] = ENERGIA_DE_LA_CRIA;
  estado.criaturaDano[hueco] = 0;
  estado.criaturaEdad[hueco] = 0;
  estado.criaturaTemperatura[hueco] = estado.criaturaTemperatura[a]!;
  // El linaje se hereda del primero. Con sexo, ese número dice cada vez menos:
  // sirve para contar de dónde viene la rama, no para saber quién es pariente de
  // quién. Para eso está el parecido entre genomas, que es lo que se mide.
  estado.criaturaLinaje[hueco] = estado.criaturaLinaje[a]!;
  estado.nacimientosEsteTick++;
  estado.cruzamientosEsteTick++;
  return true;
}

/** Desprende una cría con el genoma de la madre y sus erratas. */
function gemar(estado: EstadoMundo, geo: Geometria, madre: number, celda: number): void {
  const hueco = huecoLibre(estado);
  if (hueco < 0) {
    estado.topeDePoblacionTocado = true;
    return;
  }

  copiarConErratas(
    estado.criaturaGenoma,
    madre * MAX_CADENA_GENOMA,
    hueco * MAX_CADENA_GENOMA,
    estado.rng,
  );

  // La cría se hace con el gameto que ya llevaba puesto más otro tanto sacado
  // del cuerpo. O sea: hacerla sola cuesta las dos mitades, y hacerla con
  // alguien cuesta una. Esa es toda la diferencia entre los dos caminos.
  //
  // Que la gemación gaste el gameto importa más de lo que parece: la primera
  // versión no lo hacía, así que un cuerpo apartaba materia que ya no podía usar
  // para nada si no aparecía pareja, y el gameto era **peso muerto**. Con eso el
  // mundo se extinguía — de 875 criaturas vivas a cero.
  const materiaDeLaCria = estado.criaturaGameto[madre]! + MATERIA_DEL_GAMETO;
  estado.criaturaGameto[madre] = 0;
  estado.criaturaMateria[madre] = estado.criaturaMateria[madre]! - MATERIA_DEL_GAMETO;
  estado.criaturaEnergia[madre] = estado.criaturaEnergia[madre]! - ENERGIA_DE_LA_CRIA;

  // Cae en una celda vecina o en la misma. Sin buscar buen sitio: donde caiga.
  const k = siguienteEntero(estado.rng, geo.nVecinos[celda]! + 1);
  const destino = k === geo.nVecinos[celda]! ? celda : geo.vecinos[celda * MAX_VECINOS + k]!;

  estado.criaturaCelda[hueco] = destino;
  entrarEnLaCelda(estado, hueco, destino);
  estado.criaturaMateria[hueco] = materiaDeLaCria;
  estado.criaturaGameto[hueco] = 0;
  estado.criaturaEnergia[hueco] = ENERGIA_DE_LA_CRIA;
  estado.criaturaDano[hueco] = 0;
  estado.criaturaEdad[hueco] = 0;
  estado.criaturaTemperatura[hueco] = estado.criaturaTemperatura[madre]!;
  estado.criaturaLinaje[hueco] = estado.criaturaLinaje[madre]!;
  estado.nacimientosEsteTick++;
}

/**
 * El aire se calla y el suelo se borra, cada uno a su ritmo.
 *
 * Dos cosas pasan aquí y las dos importan:
 *
 * La señal **se reparte a las celdas de al lado**. Eso no es un detalle: es lo
 * único que hace que avisar sirva para algo. El que ve el peligro y el que no lo
 * ve están en celdas distintas, así que si la señal se quedara quieta, gritar
 * solo llegaría a quien ya está mirando lo mismo que tú, y el canal no tendría
 * para qué existir.
 *
 * Y las dos se apagan, pero a ritmos muy distintos: la señal en unos pocos ticks
 * y la marca en cientos. De ahí sale sola la diferencia entre decir algo y
 * dejarlo escrito, sin que ninguna de las dos esté declarada como tal.
 *
 * Por debajo de SILENCIO se ponen a cero. No es limpieza: si no, cada celda por
 * la que pasó alguien hace mil ticks arrastraría un decimal minúsculo para
 * siempre y el mundo no podría volver a estar quieto nunca.
 */
function apagarElAireYElSuelo(estado: EstadoMundo, geo: Geometria): void {
  const antes = estado.copiaSenal;
  antes.set(estado.senalAire);

  for (let celda = 0; celda < geo.nCeldas; celda++) {
    const vecinos = geo.nVecinos[celda]!;
    for (let k = 0; k < 4; k++) {
      const i = celda * 4 + k;

      // Lo que llega de los vecinos, repartido en partes iguales entre ellos.
      let deFuera = 0;
      for (let v = 0; v < vecinos; v++) {
        const j = geo.vecinos[celda * MAX_VECINOS + v]!;
        deFuera += (antes[j * 4 + k]! * REPARTO_SENAL_POR_MIL) / 1000 / geo.nVecinos[j]!;
      }
      const queda = antes[i]! * (1 - REPARTO_SENAL_POR_MIL / 1000);
      let valor = ((queda + deFuera) * PERMANENCIA_SENAL_POR_MIL) / 1000;
      if (valor < SILENCIO && valor > -SILENCIO) valor = 0;
      estado.senalAire[i] = valor;

      let marca = (estado.marcaSuelo[i]! * PERMANENCIA_MARCA_POR_MIL) / 1000;
      if (marca < SILENCIO && marca > -SILENCIO) marca = 0;
      estado.marcaSuelo[i] = marca;
    }
  }
}

/** La carroña se pudre y su materia vuelve al suelo. */
function pudrirLaCarrona(estado: EstadoMundo, geo: Geometria): void {
  for (let celda = 0; celda < geo.nCeldas; celda++) {
    const hay = estado.carrona[celda]!;
    if (hay <= 0) continue;
    const sePudre = (hay / PUDRICION_DIVISOR) | 0;
    const cuanto = sePudre > 0 ? sePudre : 1;
    estado.carrona[celda] = hay - cuanto;
    estado.materia[celda] = estado.materia[celda]! + cuanto;
  }
}

/** Materia que está dentro de cuerpos o de carroña. Para el test de masa. */
export function materiaEnCriaturas(estado: EstadoMundo): number {
  let total = 0;
  for (let c = 0; c < MAX_CRIATURAS; c++) {
    if (estado.criaturaCelda[c]! < 0) continue;
    total += estado.criaturaMateria[c]! + estado.criaturaGameto[c]!;
  }
  for (let i = 0; i < estado.carrona.length; i++) total += estado.carrona[i]!;
  return total;
}

/** Cuántos linajes distintos quedan vivos. Se cuenta, no se declara. */
export function linajesVivos(estado: EstadoMundo): number {
  const vistos = new Set<number>();
  for (let c = 0; c < MAX_CRIATURAS; c++) {
    if (estado.criaturaCelda[c]! >= 0) vistos.add(estado.criaturaLinaje[c]!);
  }
  return vistos.size;
}

/** Sitio donde el laboratorio puede leer el alfabeto sin importar constantes. */
export const TIPOS_DE_ATOMO_EN_GENOMA = N_TIPOS_ATOMO;
