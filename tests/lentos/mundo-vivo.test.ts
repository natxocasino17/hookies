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
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    for (let i = 0; i < 6000; i++) avanzarUnTick(estado, geo);

    expect(estado.reaccionesEsteTick).toBeGreaterThan(100);
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
