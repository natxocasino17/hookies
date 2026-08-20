/**
 * EL LABORATORIO.
 *
 * Corre el mundo a máxima velocidad, sin dibujar nada, y escupe métricas.
 *
 * Es el banco de pruebas de todo el desarrollo y existe desde la fase 0 por una
 * razón práctica: sin esto, probar el efecto de un parámetro cuesta días de
 * mirar una pantalla. Con esto cuesta minutos.
 *
 * Y cumple la regla de trabajo del proyecto: ningún mundo llega a tiempo real
 * sin haber pasado por acá. Se corren muchas semillas, se mira la telemetría, y
 * solo las que despegaron se promueven a mundo jugable. Las demás se descartan
 * sin que nadie las mire.
 *
 *   npm run lab -- --ticks 100000 --semilla 1234 --csv salida.csv
 */

import { writeFileSync } from 'node:fs';
import { Mundo } from '../sim/mundo.js';
import { SEMILLA_POR_DEFECTO } from '../sim/constants.js';
import { materiaTotal } from '../sim/estado.js';

interface Opciones {
  ticks: number;
  semillas: number[];
  csv: string | null;
  json: string | null;
}

function leerArgumentos(argv: string[]): Opciones {
  const op: Opciones = { ticks: 100_000, semillas: [SEMILLA_POR_DEFECTO], csv: null, json: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--ticks' && v) op.ticks = Number(v);
    else if (a === '--semilla' && v) op.semillas = [Number(v)];
    else if (a === '--semillas' && v) op.semillas = v.split(',').map(Number);
    else if (a === '--csv' && v) op.csv = v;
    else if (a === '--json' && v) op.json = v;
  }
  return op;
}

function correrUna(semilla: number, ticks: number) {
  const mundo = Mundo.nuevo(semilla, { reloj: () => performance.now() });
  const masaInicial = materiaTotal(mundo.estado);

  const t0 = performance.now();
  mundo.avanzar(ticks);
  const duracionMs = performance.now() - t0;

  const masaFinal = materiaTotal(mundo.estado);
  return { mundo, semilla, masaInicial, masaFinal, duracionMs };
}

function main(): void {
  const op = leerArgumentos(process.argv.slice(2));

  console.log(`Laboratorio — ${op.ticks.toLocaleString('es')} ticks por semilla`);
  console.log(`Semillas: ${op.semillas.join(', ')}`);
  console.log('');

  let huboFallo = false;

  for (const semilla of op.semillas) {
    const r = correrUna(semilla, op.ticks);
    const msPorTick = r.duracionMs / op.ticks;
    const ticksPorSegundo = op.ticks / (r.duracionMs / 1000);
    const masaOk = r.masaInicial === r.masaFinal;
    if (!masaOk) huboFallo = true;

    console.log(`Semilla ${semilla}`);
    console.log(`  tiempo total .......... ${(r.duracionMs / 1000).toFixed(2)} s`);
    console.log(`  por tick .............. ${msPorTick.toFixed(4)} ms`);
    console.log(`  ticks por segundo ..... ${Math.round(ticksPorSegundo).toLocaleString('es')}`);
    console.log(
      `  masa .................. ${r.masaInicial.toLocaleString('es')} → ${r.masaFinal.toLocaleString('es')} ` +
        `${masaOk ? '(conservada)' : `(¡PERDIDA DE ${r.masaInicial - r.masaFinal} ÁTOMOS!)`}`,
    );

    const avisos = r.mundo.telemetria.avisos;
    if (avisos.length === 0) {
      console.log('  avisos ................ ninguno');
    } else {
      // Los avisos no se ocultan ni se resumen a la baja: son el contenido útil
      // de la corrida, sobre todo los detectores de degeneración.
      const porClase = new Map<string, number>();
      for (const a of avisos) porClase.set(a.clase, (porClase.get(a.clase) ?? 0) + 1);
      console.log(`  avisos ................ ${avisos.length}`);
      for (const [clase, n] of porClase) console.log(`      ${clase}: ${n}`);
      console.log(`      primero: ${avisos[0]!.detalle}`);
    }
    console.log('');

    if (op.csv) {
      const nombre = op.semillas.length > 1 ? op.csv.replace(/\.csv$/, `.${semilla}.csv`) : op.csv;
      writeFileSync(nombre, r.mundo.telemetria.aCSV());
      console.log(`  telemetría escrita en ${nombre}`);
    }
    if (op.json) {
      const nombre = op.semillas.length > 1 ? op.json.replace(/\.json$/, `.${semilla}.json`) : op.json;
      writeFileSync(nombre, r.mundo.telemetria.aJSON());
      console.log(`  telemetría escrita en ${nombre}`);
    }
  }

  if (huboFallo) {
    console.error('FALLO: la masa no se conservó. Es un error de física, no de contabilidad.');
    process.exit(1);
  }
}

main();
