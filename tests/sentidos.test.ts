/**
 * Los sentidos, y el canal que ahora existe.
 *
 * Lo que se comprueba aquí no es que devuelvan números: es que **lleven
 * información**. Un sentido que siempre da lo mismo, o que da ruido, es peor
 * que no tenerlo, porque en la fase 4 haría creer que el fallo está en el
 * cerebro.
 *
 * Por eso el olfato se prueba poniendo comida a un lado y comprobando que la
 * flecha apunta hacia allá, y el canal se prueba comprobando que lo que se dice
 * en una celda llega a la de al lado y luego se calla.
 */

import { describe, expect, it } from 'vitest';
import { crearEstado, geometriaDe } from '../src/sim/estado.js';
import { avanzarUnTick } from '../src/sim/tick.js';
import { N_SENTIDOS, DESPLAZAMIENTO_SENTIDO, sentir, SENTIDOS, ANCHO_SENTIDO } from '../src/sim/sentidos.js';
import {
  MATERIA_AL_NACER,
  MAX_VECINOS,
  PERMANENCIA_SENAL_POR_MIL,
  SILENCIO,
} from '../src/sim/constants.js';

const NIVEL = 3;

/** Un mundo con una criatura puesta a mano en la celda que se diga. */
function mundoConUnBicho(celda: number) {
  const estado = crearEstado(1, NIVEL);
  const geo = geometriaDe(estado);
  estado.criaturaCelda.fill(-1);
  estado.cabezaEnCelda.fill(-1);
  estado.siguienteEnCelda.fill(-1);
  estado.criaturaCelda[0] = celda;
  estado.cabezaEnCelda[celda] = 0;
  estado.criaturaMateria[0] = MATERIA_AL_NACER;
  estado.criaturaEnergia[0] = 100;
  estado.criaturaEdad[0] = 10;
  return { estado, geo, sentidos: new Float32Array(N_SENTIDOS) };
}

describe('el vector de sentidos', () => {
  it('su tamaño sale de sumar la tabla, no está escrito a mano', () => {
    let suma = 0;
    for (const s of SENTIDOS) suma += ANCHO_SENTIDO[s];
    expect(N_SENTIDOS).toBe(suma);
  });

  it('todos los números salen entre -1 y 1, pase lo que pase', () => {
    // Se corre un mundo de verdad y se miran todas las criaturas que haya. Si
    // algún sentido se saliera del rango, el cerebro de la fase 4 recibiría un
    // número enorme por una entrada y ninguna por las demás.
    const estado = crearEstado(1234, NIVEL);
    const geo = geometriaDe(estado);
    const sentidos = new Float32Array(N_SENTIDOS);
    for (let i = 0; i < 4000; i++) {
      avanzarUnTick(estado, geo);
      if (i % 200 !== 0) continue;
      for (let c = 0; c < estado.criaturaCelda.length; c++) {
        if (estado.criaturaCelda[c]! < 0) continue;
        sentir(estado, geo, c, sentidos);
        for (let k = 0; k < N_SENTIDOS; k++) {
          expect(Number.isFinite(sentidos[k]!), `sentido ${k} en el tick ${i}`).toBe(true);
          expect(sentidos[k]!, `sentido ${k} en el tick ${i}`).toBeGreaterThanOrEqual(-1);
          expect(sentidos[k]!, `sentido ${k} en el tick ${i}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('el olfato apunta hacia donde está la comida', () => {
    // El test que justifica que los sentidos existan antes que el cerebro. Se
    // pone toda la comida en UNA vecina y se comprueba que la flecha apunta a
    // esa vecina y no a otra. Si esto fallara, en la fase 4 un cerebro que no
    // encontrara comida no diría nada sobre el cerebro.
    const { estado, geo, sentidos } = mundoConUnBicho(0);
    estado.carrona.fill(0);
    estado.plantaCelda.fill(-1);
    estado.cabezaPlantaEnCelda.fill(-1);

    const vecinos = geo.nVecinos[0]!;
    for (let k = 0; k < vecinos; k++) {
      // Toda la comida del mundo en la vecina número k, y nada en las demás.
      estado.carrona.fill(0);
      const conComida = geo.vecinos[k]!;
      estado.carrona[conComida] = 800;

      sentir(estado, geo, 0, sentidos);
      const i = DESPLAZAMIENTO_SENTIDO.OLFATO;
      const olfatoU = sentidos[i]!;
      const olfatoV = sentidos[i + 1]!;
      const fuerza = sentidos[i + 2]!;

      expect(fuerza, `huele algo con la comida en ${conComida}`).toBeGreaterThan(0);

      // La flecha del olfato tiene que parecerse más a la dirección de la celda
      // con comida que a la de cualquier otra vecina.
      let mejor = -1;
      let mejorParecido = -Infinity;
      for (let j = 0; j < vecinos; j++) {
        const otra = geo.vecinos[j]!;
        const dx = geo.centro[otra * 3]! - geo.centro[0]!;
        const dy = geo.centro[otra * 3 + 1]! - geo.centro[1]!;
        const dz = geo.centro[otra * 3 + 2]! - geo.centro[2]!;
        // Se proyecta con el mismo marco local que usa el olfato, recalculado
        // aquí a mano para no darle la razón al código consultándose a sí mismo.
        const ax = geo.centro[0]!;
        const ay = geo.centro[1]!;
        const az = geo.centro[2]!;
        let ux = az;
        let uy = 0;
        let uz = -ax;
        const nu = Math.sqrt(ux * ux + uy * uy + uz * uz);
        ux /= nu;
        uy /= nu;
        uz /= nu;
        const vx = ay * uz - az * uy;
        const vy = az * ux - ax * uz;
        const vz = ax * uy - ay * ux;
        const hu = dx * ux + dy * uy + dz * uz;
        const hv = dx * vx + dy * vy + dz * vz;
        const largo = Math.sqrt(hu * hu + hv * hv) || 1;
        const parecido = (olfatoU * hu + olfatoV * hv) / largo;
        if (parecido > mejorParecido) {
          mejorParecido = parecido;
          mejor = otra;
        }
      }
      expect(mejor, `la flecha del olfato señala a la celda con comida`).toBe(conComida);
    }
  });

  it('sin comida en ningún lado, el olfato no inventa una dirección', () => {
    const { estado, geo, sentidos } = mundoConUnBicho(0);
    estado.carrona.fill(0);
    estado.plantaCelda.fill(-1);
    estado.cabezaPlantaEnCelda.fill(-1);
    sentir(estado, geo, 0, sentidos);
    const i = DESPLAZAMIENTO_SENTIDO.OLFATO;
    expect(sentidos[i]!).toBe(0);
    expect(sentidos[i + 1]!).toBe(0);
    expect(sentidos[i + 2]!).toBe(0);
  });
});

describe('el canal', () => {
  it('lo que se dice en una celda llega a las de al lado', () => {
    // Esto es lo que hace que avisar pueda servir de algo. El que ve el peligro
    // y el que no lo ve están en celdas distintas: si la señal se quedara
    // quieta, gritar solo llegaría a quien ya está mirando lo mismo que tú.
    const estado = crearEstado(1, NIVEL);
    const geo = geometriaDe(estado);
    estado.criaturaCelda.fill(-1);
    estado.senalAire.fill(0);
    estado.senalAire[10 * 4] = 1;

    avanzarUnTick(estado, geo);

    let llegoAAlguna = false;
    for (let k = 0; k < geo.nVecinos[10]!; k++) {
      const j = geo.vecinos[10 * MAX_VECINOS + k]!;
      if (estado.senalAire[j * 4]! > 0) llegoAAlguna = true;
    }
    expect(llegoAAlguna, 'la señal llegó a alguna vecina').toBe(true);
    expect(estado.senalAire[10 * 4]!, 'y en la celda de origen ya suena menos').toBeLessThan(1);
  });

  it('una señal se apaga, y una marca se queda', () => {
    // Toda la diferencia entre decir algo y dejarlo escrito está en esto, y
    // ninguna de las dos está declarada como "grito" ni como "monumento": son
    // el mismo campo de cuatro números con distinta permanencia.
    const estado = crearEstado(1, NIVEL);
    const geo = geometriaDe(estado);
    estado.criaturaCelda.fill(-1);
    estado.senalAire.fill(0);
    estado.marcaSuelo.fill(0);
    estado.senalAire[10 * 4] = 1;
    estado.marcaSuelo[10 * 4] = 1;

    for (let i = 0; i < 60; i++) avanzarUnTick(estado, geo);

    expect(estado.senalAire[10 * 4]!, 'el grito ya no suena').toBeLessThan(SILENCIO);
    expect(estado.marcaSuelo[10 * 4]!, 'lo rascado sigue ahí').toBeGreaterThan(0.5);
  });

  it('el aire se queda en silencio del todo, no en un decimal minúsculo', () => {
    // Si no, cada celda por la que pasó alguien hace mil ticks arrastraría un
    // número diminuto para siempre y el mundo no volvería a estar quieto nunca.
    const estado = crearEstado(1, NIVEL);
    const geo = geometriaDe(estado);
    estado.criaturaCelda.fill(-1);
    estado.senalAire.fill(0);
    estado.senalAire[10 * 4] = 1;

    for (let i = 0; i < 400; i++) avanzarUnTick(estado, geo);
    for (let i = 0; i < estado.senalAire.length; i++) {
      expect(estado.senalAire[i]!, `celda ${i >> 2}`).toBe(0);
    }
    expect(PERMANENCIA_SENAL_POR_MIL).toBeLessThan(1000);
  });

  it('emitir y rascar dejan rastro de verdad en un mundo que corre', () => {
    // Hasta esta sesión emitir costaba energía y no dejaba nada en ninguna
    // parte: el canal era físicamente incapaz de llevar información. Esto
    // comprueba que ya no es así.
    const estado = crearEstado(1234);
    const geo = geometriaDe(estado);
    for (let i = 0; i < 3000; i++) avanzarUnTick(estado, geo);

    let celdasQueSuenan = 0;
    let celdasRascadas = 0;
    for (let celda = 0; celda < estado.nCeldas; celda++) {
      for (let k = 0; k < 4; k++) {
        if (estado.senalAire[celda * 4 + k] !== 0) {
          celdasQueSuenan++;
          break;
        }
      }
      for (let k = 0; k < 4; k++) {
        if (estado.marcaSuelo[celda * 4 + k] !== 0) {
          celdasRascadas++;
          break;
        }
      }
    }
    expect(estado.senalesEsteTick + celdasQueSuenan, 'alguien está emitiendo').toBeGreaterThan(0);
    expect(celdasRascadas, 'hay suelo rascado').toBeGreaterThan(0);
  });
});
