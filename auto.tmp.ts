import { crearEstado, geometriaDe } from './src/sim/estado.js';
import { avanzarUnTick } from './src/sim/tick.js';
import { buscarCiclos, autocataliticasPosibles } from './src/sim/autocatalisis.js';
import { atomosTotales, censoDeMoleculas } from './src/sim/quimica.js';
import { MAX_CADENA_SOPA } from './src/sim/constants.js';

console.log(`De todas las cadenas posibles hasta ${MAX_CADENA_SOPA} átomos, ${autocataliticasPosibles(MAX_CADENA_SOPA).toLocaleString('es')} podrían catalizarse a sí mismas.`);
console.log('Eso es lo que PERMITEN las reglas. Lo que pasa de verdad es otra cosa:\n');

const semillas = [1, 7, 42, 1234, 20260819, 99, 555, 31337, 8080, 4242];
let conCiclo = 0;
console.log('semilla | distintas  largo | autocatalíticas presentes');
for (const semilla of semillas) {
  const estado = crearEstado(semilla);
  const geo = geometriaDe(estado);
  const a0 = atomosTotales(estado);
  for (let i = 0; i < 12000; i++) avanzarUnTick(estado, geo);
  const censo = censoDeMoleculas(estado);
  const h = buscarCiclos(estado);
  if (h.directas.length > 0 || h.parejas.length > 0) conCiclo++;
  const lista = h.directas.slice(0, 4).map((d) => `${d.texto}×${(d.copias / 1000).toFixed(0)}k`).join(' ');
  const ok = atomosTotales(estado) === a0 ? '' : ' ¡MASA PERDIDA!';
  console.log(`${String(semilla).padStart(8)} | ${String(censo.distintas).padStart(9)} ${censo.longitudMedia.toFixed(2).padStart(6)} | ${String(h.directas.length).padStart(2)} dir, ${String(h.parejas.length).padStart(2)} par  ${lista}${ok}`);
}
console.log(`\nSemillas con al menos un ciclo: ${conCiclo} de ${semillas.length}`);
