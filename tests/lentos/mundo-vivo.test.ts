/**
 * Los tests LENTOS: los que necesitan correr años de mundo para comprobar algo.
 *
 * Están separados por un motivo práctico y no menor: la batería entera pasaba de
 * diez minutos, y **un test que no se corre porque tarda mucho es un test que no
 * existe**. Con `npm run test:rapido` van los de siempre en menos de un minuto;
 * estos van antes de cerrar una fase.
 *
 * Y son justo los que comprueban lo que emerge — clima, viento, adaptación — así
 * que no se pueden quitar: solo se corren menos veces.
 */

import { describe, expect, it } from 'vitest';
import {
  GENES_PLANTA,
  LOTES_DE_QUIMICA,
  MAX_CRIATURAS,
  MAX_PLANTAS,
  MAX_VECINOS,
  TICKS_POR_ANO,
  TICKS_POR_DIA,
} from '../../src/sim/constants.js';
import { crearEstado, geometriaDe, materiaTotal } from '../../src/sim/estado.js';
import { avanzarUnTick } from '../../src/sim/tick.js';
import { aguaTotal, direccionDelSol } from '../../src/sim/clima.js';
import { GEN_TEMPERATURA } from '../../src/sim/plantas.js';
import { atomosTotales, censoDeMoleculas } from '../../src/sim/quimica.js';
import { buscarCiclos } from '../../src/sim/autocatalisis.js';
import { linajesVivos } from '../../src/sim/criaturas.js';
import { censarEspecies } from '../../src/sim/especies.js';

describe('el clima', () => {
  it('el agua del planeta no cambia jamás', () => {
    // El ciclo del agua mueve enteros de un sitio a otro: lo que se evapora sale
    // de una celda y entra en otra. Si esto falla, hay agua naciendo o
    // desapareciendo, y cualquier conclusión sobre el mundo deja de valer.
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    const inicial = aguaTotal(estado);
    for (let i = 0; i < 8_000; i++) avanzarUnTick(estado, geo);
    expect(aguaTotal(estado)).toBe(inicial);
  });

  it('ninguna celda queda con agua negativa', () => {
    const estado = crearEstado(7);
    const geo = geometriaDe(estado);
    for (let i = 0; i < 5000; i++) avanzarUnTick(estado, geo);
    for (let i = 0; i < estado.nCeldas; i++) {
      expect(estado.aguaSuelo[i]!, `suelo de la celda ${i}`).toBeGreaterThanOrEqual(0);
      expect(estado.humedadAire[i]!, `aire de la celda ${i}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('el sol da una vuelta al día y sube y baja con el año', () => {
    // Las estaciones no son una regla: son la latitud donde el sol cae a plomo
    // subiendo y bajando entre los trópicos.
    const mediodia = direccionDelSol(0);
    const medianoche = direccionDelSol(TICKS_POR_DIA / 2);
    // Medio día después, el sol está justo al otro lado.
    expect(mediodia[0]! * medianoche[0]! + mediodia[2]! * medianoche[2]!).toBeLessThan(0);

    // A lo largo del año el sol cruza de un hemisferio al otro.
    const alturas = [0, 0.25, 0.5, 0.75].map((f) => direccionDelSol(Math.floor(f * TICKS_POR_ANO))[1]!);
    expect(Math.max(...alturas)).toBeGreaterThan(0.3);
    expect(Math.min(...alturas)).toBeLessThan(-0.3);
  });

  it('el ecuador es más caliente que los polos, y hay hielo', () => {
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    // Un año basta: el gradiente ecuador-polos ya está formado.
    for (let i = 0; i < TICKS_POR_ANO; i++) avanzarUnTick(estado, geo);

    const todas = [...Array(estado.nCeldas).keys()];
    const media = (celdas: number[]) =>
      celdas.reduce((s, i) => s + estado.temperatura[i]!, 0) / celdas.length;
    const ecuador = todas.filter((i) => Math.abs(geo.centro[i * 3 + 1]!) < 0.2);
    const polos = todas.filter((i) => Math.abs(geo.centro[i * 3 + 1]!) > 0.9);

    expect(media(ecuador)).toBeGreaterThan(media(polos) + 20);
    // Casquetes helados, pero no una bola de nieve.
    const helado = todas.filter((i) => estado.temperatura[i]! < 0).length / estado.nCeldas;
    expect(helado).toBeGreaterThan(0.05);
    expect(helado).toBeLessThan(0.6);
  });
});

describe('el viento', () => {
  it('sopla pegado al suelo, sin salirse de la esfera', () => {
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    for (let i = 0; i < 2000; i++) avanzarUnTick(estado, geo);

    for (let i = 0; i < estado.nCeldas; i++) {
      const haciaFuera =
        estado.viento[i * 3]! * geo.centro[i * 3]! +
        estado.viento[i * 3 + 1]! * geo.centro[i * 3 + 1]! +
        estado.viento[i * 3 + 2]! * geo.centro[i * 3 + 2]!;
      expect(Math.abs(haciaFuera), `celda ${i}`).toBeLessThan(1e-4);
    }
  });

  it('deja sombra de lluvia detrás de las montañas', () => {
    // Nadie escribe "desierto" en ninguna parte. El aire sube la montaña, se
    // enfría, descarga de un lado, y al otro lado baja seco. Es la consecuencia
    // de que el viento tenga dirección: sin él, la humedad se repartía por igual
    // en todas direcciones y no había sotavento ni barlovento.
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    for (let i = 0; i < TICKS_POR_ANO; i++) avanzarUnTick(estado, geo);

    const cumbres = [...Array(estado.nCeldas).keys()].filter((i) => estado.altura[i]! > 0.35);
    let barlovento = 0;
    let sotavento = 0;
    let nBarlovento = 0;
    let nSotavento = 0;

    for (const i of cumbres) {
      for (let k = 0; k < geo.nVecinos[i]!; k++) {
        const j = geo.vecinos[i * MAX_VECINOS + k]!;
        if (estado.altura[j]! >= estado.altura[i]!) continue;
        const proyeccion =
          (geo.centro[j * 3]! - geo.centro[i * 3]!) * estado.viento[i * 3]! +
          (geo.centro[j * 3 + 1]! - geo.centro[i * 3 + 1]!) * estado.viento[i * 3 + 1]! +
          (geo.centro[j * 3 + 2]! - geo.centro[i * 3 + 2]!) * estado.viento[i * 3 + 2]!;
        if (proyeccion > 0) {
          sotavento += estado.aguaSuelo[j]!;
          nSotavento++;
        } else {
          barlovento += estado.aguaSuelo[j]!;
          nBarlovento++;
        }
      }
    }

    expect(nBarlovento).toBeGreaterThan(10);
    expect(nSotavento).toBeGreaterThan(10);
    expect(barlovento / nBarlovento).toBeGreaterThan((sotavento / nSotavento) * 1.3);
  });

  it('no llueve en todo el planeta a la vez', () => {
    // Antes del viento llovía en el 85 % de las celdas en cada tick: llovizna de
    // equilibrio, no tiempo meteorológico. Con viento hay sitios secos.
    const estado = crearEstado(7);
    const geo = geometriaDe(estado);
    for (let i = 0; i < TICKS_POR_ANO; i++) avanzarUnTick(estado, geo);
    const llueve = [...Array(estado.nCeldas).keys()].filter((i) => estado.lluvia[i]! > 0).length;
    expect(llueve / estado.nCeldas).toBeLessThan(0.7);
    expect(llueve).toBeGreaterThan(0);
  });
});

describe('las plantas', () => {
  it('la masa del mundo no cambia aunque crezcan, se reproduzcan y se mueran', () => {
    // Este test cazó un escape real: la semilla se cobraba al suelo pero además
    // se restaba del fruto, así que cada siembra hacía desaparecer treinta
    // unidades de materia. El mundo pasó de 2.562.000 a 80.040 en doce años.
    // Leyendo el código no se veía.
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    const inicial = materiaTotal(estado);
    for (let i = 0; i < 6_000; i++) avanzarUnTick(estado, geo);
    expect(estado.plantasVivas).toBeGreaterThan(0);
    expect(materiaTotal(estado)).toBe(inicial);
  });

  it('ni la materia del suelo ni la masa de una planta se van a negativo', () => {
    const estado = crearEstado(7);
    const geo = geometriaDe(estado);
    for (let i = 0; i < 3000; i++) avanzarUnTick(estado, geo);
    for (let i = 0; i < estado.nCeldas; i++) {
      expect(estado.materia[i]!, `celda ${i}`).toBeGreaterThanOrEqual(0);
    }
    for (let p = 0; p < MAX_PLANTAS; p++) {
      if (estado.plantaCelda[p]! < 0) continue;
      expect(estado.plantaMasa[p]!, `planta ${p}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('no se extinguen ni cubren el planeta entero', () => {
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    for (let i = 0; i < TICKS_POR_ANO; i++) avanzarUnTick(estado, geo);
    expect(estado.plantasVivas).toBeGreaterThan(100);
    expect(estado.plantasVivas).toBeLessThan(MAX_PLANTAS);
  });

  it('los linajes se adaptan al clima donde les tocó caer', () => {
    // Nadie mueve una planta a un sitio mejor: la semilla cae donde cae. Lo que
    // pasa es que las que no encajan se mueren y las que sí dejan más semillas.
    // Si esto fallara, la herencia con erratas no estaría haciendo nada.
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    for (let i = 0; i < TICKS_POR_ANO * 2; i++) avanzarUnTick(estado, geo);

    const calidas: number[] = [];
    const frias: number[] = [];
    for (let p = 0; p < MAX_PLANTAS; p++) {
      const celda = estado.plantaCelda[p]!;
      if (celda < 0) continue;
      const latitud = Math.abs(geo.centro[celda * 3 + 1]!);
      const gen = estado.plantaGenoma[p * GENES_PLANTA + GEN_TEMPERATURA]!;
      if (latitud < 0.35) calidas.push(gen);
      else if (latitud > 0.6) frias.push(gen);
    }

    expect(calidas.length).toBeGreaterThan(30);
    expect(frias.length).toBeGreaterThan(30);
    const media = (l: number[]) => l.reduce((s, v) => s + v, 0) / l.length;
    // Las del trópico prefieren más calor que las de latitudes altas.
    expect(media(calidas)).toBeGreaterThan(media(frias) + 8);
  });
});

describe('la química', () => {
  it('los átomos del planeta no cambian jamás', () => {
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    const inicial = atomosTotales(estado);
    for (let i = 0; i < 4000; i++) avanzarUnTick(estado, geo);
    expect(atomosTotales(estado)).toBe(inicial);
  });

  it('la sopa no se para ni se queda en un puñado de moléculas', () => {
    // Los dos modos de fallo de la fase 2: que todo llegue al equilibrio y se
    // quede quieto, o que se colapse a tres sustancias.
    //
    // Este test pedía más de 100 reacciones en un tick y empezó a fallar con 50.
    // No era la sopa: era el umbral, que se quedó viejo. Con la escasez del
    // commit anterior hay seis veces menos átomos libres y `UNION_POR_MIL` bajó
    // de 620 a 45, así que se unen menos cosas por tick — que es exactamente lo
    // que se buscaba. Y la tanda lenta no se volvió a correr después de aquello.
    //
    // Medido en la semilla 1234 a partir del tick 6.000: mediana 68 uniones por
    // tick, rango de 49 a 91. Comprobado además que los cuerpos no tienen nada
    // que ver: con el puente cerrado y cero criaturas, el mismo mundo da mediana
    // 68 y rango 49-91.
    //
    // Y se mide sobre una barrida entera del planeta, no sobre un tick suelto:
    // la química va en LOTES_DE_QUIMICA lotes, así que un tick es un octavo del
    // mundo y oscila casi el doble entre uno y otro.
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    for (let i = 0; i < 6000; i++) avanzarUnTick(estado, geo);

    let uniones = 0;
    for (let i = 0; i < LOTES_DE_QUIMICA; i++) {
      avanzarUnTick(estado, geo);
      uniones += estado.reaccionesEsteTick;
    }
    // Lo que se vigila es que la sopa NO se pare. Con mediana 68 por tick, una
    // barrida entera anda por las 540 uniones; por debajo de 100 es que se paró.
    expect(uniones, 'uniones en una barrida entera del planeta').toBeGreaterThan(100);

    const censo = censoDeMoleculas(estado);
    expect(censo.distintas).toBeGreaterThan(10);
    expect(censo.longitudMedia).toBeGreaterThan(1.5);
  });

  it('aparecen moléculas autocatalíticas sin que nadie las ponga', () => {
    // El criterio de aceptación de la fase 2. Ojo al matiz honesto: aparecen
    // siempre, pero son SIEMPRE LAS MISMAS en cualquier semilla, porque quién
    // puede catalizarse a sí misma lo decide el alfabeto y no el mundo.
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    for (let i = 0; i < 6000; i++) avanzarUnTick(estado, geo);

    const hallazgo = buscarCiclos(estado);
    expect(hallazgo.directas.length).toBeGreaterThan(0);
  });
});

describe('los cuerpos', () => {
  /**
   * Correr un mundo entero es caro, así que cada semilla se corre UNA vez y
   * todas las comprobaciones leen de la misma corrida. Escrito de la manera
   * obvia —una corrida por comprobación— esta tanda sola pasaba de la hora, y un
   * test que tarda una hora acaba sin correrse.
   *
   * Y van en el planeta grande, no en el de nivel 3 de los tests centrales.
   * Medido: a nivel 3 (642 celdas) los cuerpos no aguantan — picos de 3, 7, 4 y
   * 53 criaturas, y extinción total antes de los 12.000 ticks. Menos celdas es
   * menos comida y menos sitio donde esconderse, así que la vida no arranca. No
   * es un fallo del test: es que hace falta mundo.
   */
  const TICKS = 8_000;
  const SEMILLAS = [1, 7, 1234];
  const corridas = new Map<number, ReturnType<typeof correr>>();

  function correr(semilla: number) {
    const estado = crearEstado(semilla);
    const geo = geometriaDe(estado);
    const materiaInicial = materiaTotal(estado);
    let nacimientos = 0;
    let cruzamientos = 0;
    let muertes = 0;
    let pico = 0;
    let masEspeciesALaVez = 0;
    let parecidoMinimo = 1;
    for (let i = 0; i < TICKS; i++) {
      avanzarUnTick(estado, geo);
      nacimientos += estado.nacimientosEsteTick;
      cruzamientos += estado.cruzamientosEsteTick;
      muertes += estado.muertesEsteTick;
      if (estado.criaturasVivas > pico) pico = estado.criaturasVivas;
      // El censo de especies es caro (compara todas las muestras contra todas),
      // así que se mira de tanto en tanto y solo cuando hay gente suficiente
      // como para que el número quiera decir algo.
      if (i % 400 === 0 && estado.criaturasVivas > 20) {
        const censo = censarEspecies(estado);
        if (censo.especies > masEspeciesALaVez) masEspeciesALaVez = censo.especies;
        if (censo.parecidoMinimo < parecidoMinimo) parecidoMinimo = censo.parecidoMinimo;
      }
    }
    // Cada condensación del puente funda un linaje nuevo, así que los linajes
    // fundados son exactamente los nacimientos que NO son crías de nadie.
    const porElPuente = estado.siguienteLinaje - 1;
    return {
      estado,
      materiaInicial,
      nacimientos,
      cruzamientos,
      muertes,
      pico,
      porElPuente,
      masEspeciesALaVez,
      parecidoMinimo,
    };
  }

  function mundo(semilla: number) {
    let r = corridas.get(semilla);
    if (!r) {
      r = correr(semilla);
      corridas.set(semilla, r);
    }
    return r;
  }

  it('nacen crías de otras criaturas, no solo cuerpos del puente', () => {
    // Esto estuvo en cero mucho tiempo sin que se notara: había criaturas, pero
    // todas venían de la química y ninguna de una madre. Un mundo donde nadie se
    // reproduce no tiene herencia, y sin herencia no hay nada que evolucione.
    //
    // La causa era la edad fértil: pedía 793 ticks de mediana cuando la edad
    // mediana al morir era 328. Nadie llegaba a mayor.
    //
    // Medido con las constantes de ahora, en la semilla 1234: 55 cuerpos del
    // puente contra 19.373 crías.
    const r = mundo(1234);
    expect(r.porElPuente, 'cuerpos condensados por el puente').toBeGreaterThan(0);
    expect(r.nacimientos - r.porElPuente, 'crías nacidas de una madre').toBeGreaterThan(
      r.porElPuente,
    );
  });

  it('el tope de población no llega a mandar', () => {
    // `MAX_CRIATURAS` es una red de seguridad para la memoria, no una regla del
    // mundo. Mientras se toque, la población la decide ese número y no el hambre,
    // y la curva de población deja de querer decir nada. Estuvo mandando: con el
    // tope en 1.200, la semilla 1234 se quedaba clavada en 1.195.
    for (const semilla of SEMILLAS) {
      const r = mundo(semilla);
      expect(r.estado.topeDePoblacionTocado, `semilla ${semilla}`).toBe(false);
      expect(r.pico, `pico de la semilla ${semilla}`).toBeLessThan(MAX_CRIATURAS);
    }
  });

  it('ni explotan hasta el tope ni se extinguen todas', () => {
    // Criterio 2 de la fase 3. Se mira "en la mayoría de las semillas" a
    // propósito: que un mundo se muera es un resultado legítimo, no un bug.
    //
    // Aquí van tres semillas y no más porque cada mundo cuesta minutos. La 42 se
    // midió aparte y **se extingue del todo**: pico de 15 criaturas y cero vivas
    // a los 8.000 ticks. Se deja fuera del test por eso, no para maquillar el
    // resultado: hay mundos donde la vida no arranca, y no se va a tocar nada
    // para que arranquen.
    const vivos = SEMILLAS.filter((s) => mundo(s).estado.criaturasVivas > 0).length;
    expect(vivos).toBeGreaterThanOrEqual(2);
  });

  it('unos linajes aguantan y otros se extinguen', () => {
    // Criterio 1 de la fase 3, en su parte medible hoy. Nadie decide cuál cae: se
    // funda un linaje por cada condensación y la mayoría no llega a nada.
    //
    // Ojo al matiz honesto: de los 52 a 58 linajes que se fundan, acaban vivos
    // uno o dos. Se cumple el criterio, pero el final es casi monocultivo, y eso
    // habrá que mirarlo cuando lleguen el sexo y la especiación.
    const r = mundo(1234);
    const vivos = linajesVivos(r.estado);
    expect(r.porElPuente, 'linajes fundados').toBeGreaterThan(20);
    expect(vivos, 'linajes vivos al final').toBeGreaterThan(0);
    expect(vivos, 'linajes vivos al final').toBeLessThan(r.porElPuente);
  });

  it('hay crías que salen de dos cuerpos, no solo de uno', () => {
    // El sexo no es un adorno: tiene que llegar a ocurrir de verdad. La primera
    // versión que escribí daba 18 cruces en 19.519 nacimientos, o sea nada, y
    // parecía funcionar mirando el código.
    //
    // Cuánto pesa depende muchísimo del mundo, y eso es un resultado, no ruido:
    // medido a 8.000 ticks, en la semilla 1 son el 16 % de las crías y en la
    // 1234 el 76 %. La diferencia es la densidad — hacen falta dos cuerpos en la
    // misma celda, y en un mundo vacío eso no pasa casi nunca. Por eso aquí solo
    // se exige que ocurra, y que en algún mundo sea el camino principal.
    const conCruces = SEMILLAS.filter((s) => mundo(s).cruzamientos > 0).length;
    expect(conCruces, 'mundos donde el sexo llega a ocurrir').toBeGreaterThanOrEqual(2);

    const fracciones = SEMILLAS.map((s) => {
      const r = mundo(s);
      return r.cruzamientos / Math.max(1, r.nacimientos);
    });
    expect(Math.max(...fracciones), 'en el mundo más poblado el sexo manda').toBeGreaterThan(0.5);
  });

  it('llega a haber dos grupos que no pueden cruzarse entre sí', () => {
    // Criterio 4 de la fase 3, y lo dice el censo, no yo. En la semilla 1234
    // conviven dos grupos entre los ticks 4.000 y 8.000 con un parecido mínimo
    // de 0,297 cuando para cruzarse hace falta 0,75.
    //
    // El matiz honesto, que está medido y no se esconde: esos dos grupos son
    // linajes que vienen de puentes distintos, con genomas que nunca tuvieron
    // nada que ver. NO es un linaje que se haya partido en dos. Especiación por
    // divergencia todavía no se ha visto, y la cuenta dice que harían falta unas
    // 130 generaciones aisladas.
    const maximo = Math.max(...SEMILLAS.map((s) => mundo(s).masEspeciesALaVez));
    expect(maximo, 'grupos incompatibles conviviendo a la vez').toBeGreaterThan(1);
  });

  it('la masa se conserva con cuerpos, crías, gametos y carroña dentro', () => {
    for (const semilla of SEMILLAS) {
      const r = mundo(semilla);
      expect(r.nacimientos, `nacimientos, semilla ${semilla}`).toBeGreaterThan(0);
      expect(r.muertes, `muertes, semilla ${semilla}`).toBeGreaterThan(0);
      expect(materiaTotal(r.estado), `masa, semilla ${semilla}`).toBe(r.materiaInicial);
    }
  });
});
