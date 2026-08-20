import { crearEstado, geometriaDe } from './src/sim/estado.js';
import { avanzarUnTick } from './src/sim/tick.js';
import { aguaTotal } from './src/sim/clima.js';
import { NIVEL_DEL_MAR, TICKS_POR_ANO } from './src/sim/constants.js';
const estado = crearEstado(1234);
const geo = geometriaDe(estado);
const agua0 = aguaTotal(estado);
const todas = [...Array(geo.nCeldas).keys()];
const tierra = todas.filter((i) => estado.altura[i]! >= NIVEL_DEL_MAR);
const media = (c: Float32Array | Int32Array, ce: number[]) => ce.reduce((s, i) => s + c[i]!, 0) / ce.length;
console.log(' año | suelo medio  seco  húmedo  ríos | temp media');
for (let ano = 0; ano <= 20; ano += 2) {
  while (estado.tick < ano * TICKS_POR_ANO) avanzarUnTick(estado, geo);
  const seco = tierra.filter((i) => estado.aguaSuelo[i]! < 40).length;
  const humedo = tierra.filter((i) => estado.aguaSuelo[i]! > 150).length;
  const rios = tierra.filter((i) => estado.flujoAgua[i]! > 15).length;
  console.log(`${String(ano).padStart(4)} | ${media(estado.aguaSuelo, tierra).toFixed(0).padStart(11)} ${String(seco).padStart(5)} ${String(humedo).padStart(7)} ${String(rios).padStart(5)} | ${media(estado.temperatura, todas).toFixed(1).padStart(6)}`);
}
console.log(`\nagua ${agua0} → ${aguaTotal(estado)} ${aguaTotal(estado) === agua0 ? '(conservada)' : 'PERDIDA'}`);
console.log(`de ${tierra.length} celdas de tierra`);
