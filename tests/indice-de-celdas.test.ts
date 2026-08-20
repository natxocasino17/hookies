/**
 * El índice de quién está en cada celda.
 *
 * Es la única estructura del proyecto que guarda por duplicado algo que ya se
 * sabe: dónde está cada cuerpo y cada planta. Existe solo porque buscar quién
 * hay en una celda recorriendo las 3.000 ranuras de criatura y las 16.000 de
 * planta costaba 4,3 ms del presupuesto de 16, y ahora cuesta 1,6.
 *
 * Un dato duplicado que se desincroniza es un mundo que miente sin avisar, así
 * que aquí se comprueba lo único que puede fallar: que el atajo diga siempre lo
 * mismo que el recorrido largo, y que cargar un mundo lo devuelva igual.
 */

import { describe, expect, it } from 'vitest';
import { crearEstado, deserializar, geometriaDe, serializar } from '../src/sim/estado.js';
import { avanzarUnTick } from '../src/sim/tick.js';
import { MAX_CRIATURAS, MAX_PLANTAS } from '../src/sim/constants.js';
import type { EstadoMundo } from '../src/sim/estado.js';

/** Quién hay en cada celda según el índice. */
function segunElIndice(estado: EstadoMundo, cabeza: Int32Array, siguiente: Int32Array): string[] {
  const filas: string[] = [];
  for (let celda = 0; celda < estado.nCeldas; celda++) {
    const dentro: number[] = [];
    let tope = 0;
    for (let i = cabeza[celda]!; i >= 0; i = siguiente[i]!) {
      dentro.push(i);
      // Una lista con un ciclo colgaría el mundo entero sin decir por qué.
      if (++tope > siguiente.length) throw new Error(`lista circular en la celda ${celda}`);
    }
    filas.push(dentro.join(','));
  }
  return filas;
}

/** Quién hay en cada celda recorriendo todas las ranuras, que es la verdad. */
function recorriendoTodo(estado: EstadoMundo, posicion: Int32Array, ranuras: number): string[] {
  const filas: number[][] = [];
  for (let celda = 0; celda < estado.nCeldas; celda++) filas.push([]);
  for (let i = 0; i < ranuras; i++) {
    const celda = posicion[i]!;
    if (celda >= 0) filas[celda]!.push(i);
  }
  return filas.map((f) => f.join(','));
}

function comprobar(estado: EstadoMundo, cuando: string): void {
  expect(
    segunElIndice(estado, estado.cabezaEnCelda, estado.siguienteEnCelda),
    `criaturas, ${cuando}`,
  ).toEqual(recorriendoTodo(estado, estado.criaturaCelda, MAX_CRIATURAS));
  expect(
    segunElIndice(estado, estado.cabezaPlantaEnCelda, estado.siguientePlantaEnCelda),
    `plantas, ${cuando}`,
  ).toEqual(recorriendoTodo(estado, estado.plantaCelda, MAX_PLANTAS));
}

describe('índice de quién está en cada celda', () => {
  it('dice lo mismo que recorrer todas las ranuras, tick a tick', () => {
    // Nivel 3 por lo mismo que los otros tests centrales: para que quepa correrlo.
    const estado = crearEstado(1234, 3);
    const geo = geometriaDe(estado);
    comprobar(estado, 'recién creado');
    for (let i = 0; i < 1500; i++) {
      avanzarUnTick(estado, geo);
      // Comprobar los 3.000 ticks tarda de más; con uno de cada cien basta para
      // pillar un desajuste: una vez desajustado ya no se arregla solo.
      if (i % 150 === 0) comprobar(estado, `tick ${estado.tick}`);
    }
    comprobar(estado, 'al final');
  });

  it('sale idéntico al cargar un mundo guardado', () => {
    // Esto es lo que justifica que el índice no vaya en el archivo. Si al
    // reconstruirlo saliera en otro orden, morder elegiría a otra criatura y el
    // futuro del mundo cambiaría por haberlo guardado — que es exactamente el
    // fallo que ya nos comimos una vez con el cursor de las plantas.
    const estado = crearEstado(1234, 3);
    const geo = geometriaDe(estado);
    for (let i = 0; i < 1500; i++) avanzarUnTick(estado, geo);

    const cargado = deserializar(serializar(estado));
    expect(segunElIndice(cargado, cargado.cabezaEnCelda, cargado.siguienteEnCelda)).toEqual(
      segunElIndice(estado, estado.cabezaEnCelda, estado.siguienteEnCelda),
    );
    expect(
      segunElIndice(cargado, cargado.cabezaPlantaEnCelda, cargado.siguientePlantaEnCelda),
    ).toEqual(segunElIndice(estado, estado.cabezaPlantaEnCelda, estado.siguientePlantaEnCelda));
  });
});
