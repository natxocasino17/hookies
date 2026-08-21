/**
 * El sexo y las especies.
 *
 * Lo que se comprueba aquí no es que "funcione": es que **no haya nada
 * escrito a mano** donde debería haber física. En concreto:
 *
 *  · Que la cría de dos lleve tramos enteros de cada progenitor, y no una media
 *    de los dos. Si saliera la media, la recombinación no daría nada nuevo y el
 *    sexo sería un adorno caro.
 *  · Que el detector de especies no decida nada: que agrupe por el MISMO umbral
 *    que usa la física, y que un mundo sano salga como una sola especie.
 *
 * Estos van con genomas construidos a mano a propósito. Es un test, no el
 * mundo: aquí sí se puede fabricar el caso que se quiere mirar.
 */

import { describe, expect, it } from 'vitest';
import {
  ERRATA_POR_DIEZ_MIL,
  LARGO_DE_TRAMO,
  MAX_CADENA_GENOMA,
  MUESTRAS_DE_GAMETO,
  N_TIPOS_ATOMO,
  PARECIDO_MINIMO_PARA_CRUZAR,
  VENTANA_DE_RASGO,
} from '../src/sim/constants.js';
import { parecidoEntreGenomas, recombinarConErratas } from '../src/sim/genoma.js';
import { crearRng } from '../src/sim/rng.js';
import { readFileSync } from 'node:fs';
import { crearEstado, deserializar, materiaTotal, serializar } from '../src/sim/estado.js';
import { censarEspecies } from '../src/sim/especies.js';

/** Dos genomas planos y distintos, para poder ver de cuál viene cada átomo. */
function dosPadres(): Uint8Array {
  const g = new Uint8Array(MAX_CADENA_GENOMA * 3);
  g.fill(0, 0, MAX_CADENA_GENOMA);
  g.fill(N_TIPOS_ATOMO - 1, MAX_CADENA_GENOMA, MAX_CADENA_GENOMA * 2);
  return g;
}

describe('la recombinación', () => {
  it('la cría lleva átomos de los dos, no la media de los dos', () => {
    // Con un padre todo a 0 y otro todo al máximo, la media seria un genoma
    // entero de valores intermedios. Lo que tiene que salir es lo contrario:
    // casi todos los átomos valen 0 o el máximo, y los intermedios son solo las
    // erratas.
    const g = dosPadres();
    const cria = MAX_CADENA_GENOMA * 2;
    recombinarConErratas(g, 0, MAX_CADENA_GENOMA, cria, crearRng(1234));

    let deUno = 0;
    let deOtro = 0;
    let niUno_niOtro = 0;
    for (let i = 0; i < MAX_CADENA_GENOMA; i++) {
      const a = g[cria + i]!;
      if (a === 0) deUno++;
      else if (a === N_TIPOS_ATOMO - 1) deOtro++;
      else niUno_niOtro++;
    }

    expect(deUno, 'átomos del primer progenitor').toBeGreaterThan(MAX_CADENA_GENOMA / 8);
    expect(deOtro, 'átomos del segundo progenitor').toBeGreaterThan(MAX_CADENA_GENOMA / 8);
    // Los intermedios solo pueden venir de erratas, que son raras. Se deja
    // margen de sobra porque una errata sobre un padre plano cae siempre en
    // medio, pero ni de lejos puede ser la mayoría.
    expect(niUno_niOtro / MAX_CADENA_GENOMA).toBeLessThan((ERRATA_POR_DIEZ_MIL / 10000) * 4);
  });

  it('hereda tramos largos, más largos que la ventana con la que se lee un rasgo', () => {
    // Esto es lo que hace que la recombinación sirva de algo. Si los tramos
    // fueran más cortos que VENTANA_DE_RASGO, cada rasgo de la cría saldría
    // siempre en el punto medio de sus padres y no aparecería nada nuevo.
    const g = dosPadres();
    const cria = MAX_CADENA_GENOMA * 2;
    recombinarConErratas(g, 0, MAX_CADENA_GENOMA, cria, crearRng(7));

    let cambios = 0;
    for (let i = 1; i < MAX_CADENA_GENOMA; i++) {
      const antes = g[cria + i - 1]!;
      const ahora = g[cria + i]!;
      // Solo se cuentan los saltos entre los dos valores planos: un átomo
      // intermedio es una errata, no un cambio de progenitor.
      const planoAntes = antes === 0 || antes === N_TIPOS_ATOMO - 1;
      const planoAhora = ahora === 0 || ahora === N_TIPOS_ATOMO - 1;
      if (planoAntes && planoAhora && antes !== ahora) cambios++;
    }

    const tramoMedio = MAX_CADENA_GENOMA / (cambios + 1);
    expect(tramoMedio, 'largo medio de tramo').toBeGreaterThan(VENTANA_DE_RASGO);
    // Y que de verdad se mezclen: un solo tramo no seria recombinar nada.
    expect(cambios, 'cambios de progenitor').toBeGreaterThan(1);
    // El largo medido tiene que andar cerca del que dicen las constantes.
    expect(tramoMedio).toBeGreaterThan(LARGO_DE_TRAMO / 3);
    expect(tramoMedio).toBeLessThan(LARGO_DE_TRAMO * 3);
  });

  it('una cría se parece a sus padres mucho más que dos desconocidos', () => {
    const g = dosPadres();
    const cria = MAX_CADENA_GENOMA * 2;
    recombinarConErratas(g, 0, MAX_CADENA_GENOMA, cria, crearRng(42));
    const conPadre = parecidoEntreGenomas(g, cria, 0, MUESTRAS_DE_GAMETO);
    const conMadre = parecidoEntreGenomas(g, cria, MAX_CADENA_GENOMA, MUESTRAS_DE_GAMETO);
    const entrePadres = parecidoEntreGenomas(g, 0, MAX_CADENA_GENOMA, MUESTRAS_DE_GAMETO);
    expect(entrePadres, 'dos padres opuestos no se parecen en nada').toBe(0);
    expect(conPadre + conMadre, 'la cría es de los dos').toBeGreaterThan(0.9);
  });
});

describe('el gameto en el archivo', () => {
  it('cada criatura guarda sus siete campos sin pisar a la siguiente', () => {
    // Este test existe por un fallo concreto. El paso entre criaturas dentro del
    // archivo estaba escrito a mano como `c * 24`, y al añadir el gameto como
    // séptimo campo cada criatura escribía su gameto **encima de la celda de la
    // siguiente**. El mundo se guardaba mal y al cargarlo tenía otro futuro.
    //
    // Lo cazó el test de determinismo tras diez minutos de corrida, y solo
    // porque casualmente había criaturas con gameto. El de ida y vuelta que ya
    // existía no lo vio: se hacía sobre un mundo sin cuerpos, así que ni tocaba
    // esos bytes. Esto lo comprueba en un segundo y a propósito.
    const estado = crearEstado(1, 3);
    estado.criaturaCelda.fill(-1);

    // Valores distintos y reconocibles en cada campo de cada criatura: si un
    // campo se escribe en el sitio de otro, salta a la vista cuál.
    for (let c = 0; c < 12; c++) {
      estado.criaturaCelda[c] = 100 + c;
      estado.criaturaMateria[c] = 200 + c;
      estado.criaturaEnergia[c] = 300 + c;
      estado.criaturaDano[c] = 400 + c;
      estado.criaturaEdad[c] = 500 + c;
      estado.criaturaLinaje[c] = 600 + c;
      estado.criaturaGameto[c] = 700 + c;
    }

    const vuelto = deserializar(serializar(estado));
    for (let c = 0; c < 12; c++) {
      expect(vuelto.criaturaCelda[c], `celda de ${c}`).toBe(100 + c);
      expect(vuelto.criaturaMateria[c], `materia de ${c}`).toBe(200 + c);
      expect(vuelto.criaturaEnergia[c], `energía de ${c}`).toBe(300 + c);
      expect(vuelto.criaturaDano[c], `daño de ${c}`).toBe(400 + c);
      expect(vuelto.criaturaEdad[c], `edad de ${c}`).toBe(500 + c);
      expect(vuelto.criaturaLinaje[c], `linaje de ${c}`).toBe(600 + c);
      expect(vuelto.criaturaGameto[c], `gameto de ${c}`).toBe(700 + c);
    }
    // Y que la de después de la última siga siendo un hueco libre: si alguien se
    // pasa de largo escribiendo, es aquí donde cae.
    expect(vuelto.criaturaCelda[12], 'la ranura siguiente sigue vacía').toBe(-1);
  });

  it('la materia del gameto cuenta en el total del mundo', () => {
    // Un gameto es materia apartada, no materia nueva. Si no se contara, el
    // mundo parecería perder átomos cada vez que alguien se prepara para tener
    // una cría.
    const estado = crearEstado(1, 3);
    const antes = materiaTotal(estado);
    const c = 0;
    estado.criaturaCelda[c] = 5;
    estado.criaturaMateria[c] = 50;
    estado.criaturaGameto[c] = 0;
    const conCuerpo = materiaTotal(estado);
    expect(conCuerpo).toBe(antes + 50);
    estado.criaturaMateria[c] = 27;
    estado.criaturaGameto[c] = 23;
    expect(materiaTotal(estado), 'apartar el gameto no cambia el total').toBe(conCuerpo);
  });
});

describe('el detector de especies', () => {
  it('agrupa con el mismo umbral que usa la física para cruzar', () => {
    // El detector no puede tener criterio propio. Si agrupara con un umbral
    // distinto del que decide si dos gametos se funden, estaria inventándose
    // unas especies que no son las del mundo.
    //
    // Se comprueba leyendo el código en vez de con genomas: es la única forma de
    // que este test siga valiendo si mañana cambia el umbral.
    const fuente = readFileSync('src/sim/especies.ts', 'utf8');
    expect(fuente).toContain('PARECIDO_MINIMO_PARA_CRUZAR');
    expect(fuente).not.toMatch(/const\s+\w*[Uu]mbral\w*\s*=\s*0\./);
  });

  it('sabe ver dos especies cuando de verdad hay dos', () => {
    // El test más importante del archivo. Si el detector solo supiera decir "1",
    // un mundo que sale siempre con una especie no querría decir nada: podría
    // ser que no hubiera pasado nada o que el aparato de medir estuviera roto.
    // Aquí se le ponen delante dos grupos que no pueden cruzarse y tiene que
    // contarlos.
    const estado = crearEstado(1, 3);
    estado.criaturaCelda.fill(-1);
    estado.criaturaGenoma.fill(0);

    // Dos grupos de genomas planos y opuestos: parecido 0 entre grupos, 1
    // dentro de cada uno. Es el caso extremo a propósito.
    for (let c = 0; c < 20; c++) {
      estado.criaturaCelda[c] = c;
      const base = c * MAX_CADENA_GENOMA;
      estado.criaturaGenoma.fill(c < 10 ? 0 : N_TIPOS_ATOMO - 1, base, base + MAX_CADENA_GENOMA);
    }

    const censo = censarEspecies(estado);
    expect(censo.miradas).toBe(20);
    expect(censo.especies, 'grupos que no pueden cruzarse').toBe(2);
    expect(censo.tamanos).toEqual([10, 10]);
    expect(censo.parecidoMinimo).toBe(0);
  });

  it('una población que sí puede cruzarse entera sale como una sola especie', () => {
    const estado = crearEstado(1, 3);
    estado.criaturaCelda.fill(-1);
    estado.criaturaGenoma.fill(0);
    for (let c = 0; c < 20; c++) {
      estado.criaturaCelda[c] = c;
      // Todos iguales menos unos pocos átomos, que es como se ven de verdad los
      // parientes: en la semilla 1234 se parecían entre 0,962 y 1,000.
      const base = c * MAX_CADENA_GENOMA;
      for (let i = c; i < MAX_CADENA_GENOMA; i += 100) estado.criaturaGenoma[base + i] = 1;
    }
    const censo = censarEspecies(estado);
    expect(censo.especies, 'todos se pueden cruzar con todos').toBe(1);
    expect(censo.parecidoMinimo).toBeGreaterThan(PARECIDO_MINIMO_PARA_CRUZAR);
  });

  it('los umbrales dejan sitio de sobra entre una población sana y el suelo', () => {
    // Medido en la semilla 1234 a los 8.000 ticks: dentro de una población viva
    // el parecido va de 0,962 a 1,000, y dos genomas al azar dan 0,328. El
    // umbral tiene que caer holgadamente entre esas dos cosas, o parte en dos
    // una población que es una sola, o no separa nunca nada.
    expect(PARECIDO_MINIMO_PARA_CRUZAR).toBeLessThan(0.9);
    expect(PARECIDO_MINIMO_PARA_CRUZAR).toBeGreaterThan(0.5);
  });
});
