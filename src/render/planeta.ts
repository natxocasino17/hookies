/**
 * El planeta dibujado.
 *
 * Cada celda es un prisma de tapa plana a la altura de su terreno. De ahí sale
 * solo el aspecto de mesetas y acantilados: donde dos celdas vecinas están a
 * alturas distintas queda una pared. No hay ningún filtro ni truco de estilo —
 * es la geometría del mundo, dibujada tal cual.
 *
 * Lo mismo con la luz: el foco que ilumina la bola está donde la simulación dice
 * que está el sol. La línea de la noche no está pintada, es dónde deja de llegar.
 *
 * Este archivo solo mira. No puede tocar el estado ni tomar decisiones de
 * simulación: recibe instantáneas y las convierte en triángulos.
 */

import * as THREE from 'three';
import { MAX_VECINOS, NIVEL_DEL_MAR, RADIO_PLANETA, TEMP_CONGELACION } from '../sim/constants.js';
import { construirGeometria, type Geometria } from '../sim/geodesica.js';
import { radioDeCelda, radioDelMar } from '../sim/terreno.js';
import { direccionDelSol } from '../sim/clima.js';
import { colorDeCelda } from './paleta.js';

/** Qué vértices del dibujo pertenecen a cada celda, para repintarlas sin rehacerlas. */
interface Trozos {
  malla: THREE.BufferGeometry;
  inicio: Int32Array;
  cuantos: Int32Array;
}

function construirMallaTerreno(geo: Geometria, altura: Float32Array): Trozos {
  const posiciones: number[] = [];
  const inicio = new Int32Array(geo.nCeldas);
  const cuantos = new Int32Array(geo.nCeldas);

  const radios = new Float32Array(geo.nCeldas);
  for (let i = 0; i < geo.nCeldas; i++) radios[i] = radioDeCelda(altura[i]!, RADIO_PLANETA);

  for (let celda = 0; celda < geo.nCeldas; celda++) {
    inicio[celda] = posiciones.length / 3;
    const lados = geo.nVecinos[celda]!;
    const r = radios[celda]!;

    const cx = geo.centro[celda * 3]! * r;
    const cy = geo.centro[celda * 3 + 1]! * r;
    const cz = geo.centro[celda * 3 + 2]! * r;

    // La celda más baja de su vecindario no necesita falda: la tapan las
    // paredes de sus vecinas.
    let radioMasBajo = r;
    for (let k = 0; k < lados; k++) {
      const v = geo.vecinos[celda * MAX_VECINOS + k]!;
      if (radios[v]! < radioMasBajo) radioMasBajo = radios[v]!;
    }

    for (let k = 0; k < lados; k++) {
      const a = (celda * MAX_VECINOS + k) * 3;
      const b = (celda * MAX_VECINOS + ((k + 1) % lados)) * 3;
      const ax = geo.esquinas[a]!, ay = geo.esquinas[a + 1]!, az = geo.esquinas[a + 2]!;
      const bx = geo.esquinas[b]!, by = geo.esquinas[b + 1]!, bz = geo.esquinas[b + 2]!;

      posiciones.push(cx, cy, cz, ax * r, ay * r, az * r, bx * r, by * r, bz * r);

      if (radioMasBajo < r) {
        const rb = radioMasBajo;
        posiciones.push(
          ax * r, ay * r, az * r, ax * rb, ay * rb, az * rb, bx * r, by * r, bz * r,
          bx * r, by * r, bz * r, ax * rb, ay * rb, az * rb, bx * rb, by * rb, bz * rb,
        );
      }
    }
    cuantos[celda] = posiciones.length / 3 - inicio[celda]!;
  }

  const malla = new THREE.BufferGeometry();
  malla.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  malla.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(posiciones.length), 3));
  malla.computeVertexNormals();
  return { malla, inicio, cuantos };
}

/** Estrellas de fondo, colocadas con un generador propio para que no parpadeen. */
function construirEstrellas(): THREE.Points {
  const n = 1400;
  const pos = new Float32Array(n * 3);
  let s = 0x9e3779b9;
  const siguiente = () => {
    s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d);
    s = Math.imul(s ^ (s >>> 12), 0x297a2d39);
    return ((s ^ (s >>> 15)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    const z = siguiente() * 2 - 1;
    const radio = Math.sqrt(1 - z * z);
    const t = siguiente() * Math.PI * 2;
    const d = 26 + siguiente() * 10;
    pos[i * 3] = Math.cos(t) * radio * d;
    pos[i * 3 + 1] = Math.sin(t) * radio * d;
    pos[i * 3 + 2] = z * d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbcd0e6, size: 0.055 }));
}

export class VistaPlaneta {
  private readonly escena = new THREE.Scene();
  private readonly camara: THREE.PerspectiveCamera;
  private readonly render: THREE.WebGLRenderer;
  private readonly pivote = new THREE.Group();
  private readonly sol: THREE.DirectionalLight;

  private trozos: Trozos | null = null;
  private terreno: THREE.Mesh | null = null;
  private nubes: THREE.InstancedMesh | null = null;
  private arboles: THREE.InstancedMesh | null = null;
  private geo: Geometria | null = null;
  private nivelDibujado = -1;

  private giroX = 0.35;
  private giroY = 0.6;
  private distancia = 3.1;

  constructor(private readonly lienzo: HTMLCanvasElement) {
    this.render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
    this.render.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camara = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    this.escena.background = new THREE.Color(0x0a1020);
    this.escena.add(this.pivote);
    this.escena.add(construirEstrellas());

    // El sol de verdad: se coloca donde la simulación dice que está, así que la
    // línea de la noche es dónde deja de llegar, no algo pintado encima.
    this.sol = new THREE.DirectionalLight(0xfff4e2, 2.6);
    this.escena.add(this.sol);
    // Relleno: el azul del cielo por arriba, el rebote del mar por abajo. Sin
    // esto la cara de noche sería un agujero negro y no se vería nada.
    this.escena.add(new THREE.HemisphereLight(0x8fb2e0, 0x1a2436, 0.8));

    this.conectarGestos();
    this.ajustarTamano();
    window.addEventListener('resize', () => this.ajustarTamano());
  }

  actualizar(inst: {
    tick: number;
    nivel: number;
    altura: Float32Array;
    temperatura: Float32Array;
    aguaSuelo: Int32Array;
    humedadAire: Int32Array;
    flujoAgua: Int32Array;
    lluvia: Int32Array;
    vegetacion: Int32Array;
    vegetacionTinte: Uint8Array;
  }): void {
    if (this.nivelDibujado !== inst.nivel) this.construirMundo(inst.nivel, inst.altura);
    if (!this.trozos || !this.geo || !this.nubes || !this.arboles) return;

    // --- Repintar cada celda con lo que dicen sus números ---------------------
    const colores = this.trozos.malla.getAttribute('color') as THREE.BufferAttribute;
    const array = colores.array as Float32Array;
    const tinte: [number, number, number] = [0, 0, 0];

    for (let celda = 0; celda < this.geo.nCeldas; celda++) {
      colorDeCelda(
        inst.altura[celda]!,
        inst.temperatura[celda]!,
        inst.aguaSuelo[celda]!,
        inst.flujoAgua[celda]!,
        tinte,
      );
      // Las paredes de los cantiles van más oscuras, como roca en sombra.
      const desde = this.trozos.inicio[celda]!;
      const hasta = desde + this.trozos.cuantos[celda]!;
      const tapa = this.geo.nVecinos[celda]! * 3;
      for (let v = desde; v < hasta; v++) {
        const enSombra = v - desde >= tapa;
        const k = enSombra ? 0.58 : 1;
        array[v * 3] = tinte[0] * k;
        array[v * 3 + 1] = tinte[1] * k;
        array[v * 3 + 2] = tinte[2] * k;
      }
    }
    colores.needsUpdate = true;

    // --- Las nubes son la humedad del aire, no un adorno ---------------------
    //
    // Se dibuja nube DONDE ESTÁ LLOVIENDO. Ni por el agua que lleva el aire ni
    // por la humedad relativa: las dos salían casi iguales en todas partes —la
    // regla de lluvia deja el aire siempre al borde de saturarse— y el planeta
    // acababa tapado de blanco de polo a polo. La lluvia sí distingue, y además
    // es lo que de verdad quieres ver: si hay nube, ahí está cayendo agua.
    const matriz = new THREE.Matrix4();
    const vacio = new THREE.Vector3(0, 0, 0);
    const sinRotar = new THREE.Quaternion();
    const escala = new THREE.Vector3();
    const sitio = new THREE.Vector3();
    let dibujadas = 0;
    for (let celda = 0; celda < this.geo.nCeldas; celda++) {
      // Solo la lluvia fuerte. Medido: con el umbral bajo llueve en el 85 % del
      // planeta a la vez —una llovizna constante en todas partes, que no es
      // tiempo meteorológico— y salían nubes hasta en el último rincón. Con 45
      // se ven solo los frentes de verdad, que son un 14 % de las celdas.
      const cae = inst.lluvia[celda]!;
      if (cae < 45) continue;
      const tamano = 0.016 + Math.min(0.022, (cae - 45) * 0.0004);
      const r = RADIO_PLANETA * 1.055;
      sitio.set(
        this.geo.centro[celda * 3]! * r,
        this.geo.centro[celda * 3 + 1]! * r,
        this.geo.centro[celda * 3 + 2]! * r,
      );
      escala.set(tamano, tamano * 0.45, tamano);
      matriz.compose(sitio, sinRotar, escala);
      this.nubes.setMatrixAt(dibujadas++, matriz);
    }
    // Las instancias sobrantes se aparcan en el centro con tamaño cero.
    matriz.compose(vacio, sinRotar, new THREE.Vector3(0, 0, 0));
    for (let i = dibujadas; i < this.geo.nCeldas; i++) this.nubes.setMatrixAt(i, matriz);
    this.nubes.instanceMatrix.needsUpdate = true;

    // --- Los árboles son la materia vegetal que hay en cada celda -------------
    //
    // El tamaño es la masa que tienen las plantas ahí, y el color sale del gen
    // de temperatura del linaje que domina la celda. Así, dos bosques adaptados
    // a climas distintos se ven de tonos distintos: la divergencia de linajes
    // se ve con los ojos, sin abrir ningún menú.
    let arboles = 0;
    const tono = new THREE.Color();
    for (let celda = 0; celda < this.geo.nCeldas; celda++) {
      const masa = inst.vegetacion[celda]!;
      if (masa < 12) continue;
      const alto = 0.010 + Math.min(0.030, masa * 0.00018);
      const r = radioDeCelda(inst.altura[celda]!, RADIO_PLANETA) + alto * 0.5;
      sitio.set(
        this.geo.centro[celda * 3]! * r,
        this.geo.centro[celda * 3 + 1]! * r,
        this.geo.centro[celda * 3 + 2]! * r,
      );
      // El árbol se pone de pie: apunta hacia fuera del planeta.
      const arriba = new THREE.Vector3(
        this.geo.centro[celda * 3]!,
        this.geo.centro[celda * 3 + 1]!,
        this.geo.centro[celda * 3 + 2]!,
      );
      const giro = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), arriba);
      escala.set(alto * 0.75, alto, alto * 0.75);
      matriz.compose(sitio, giro, escala);
      this.arboles!.setMatrixAt(arboles, matriz);

      // Del verde frío al verde cálido, según a qué clima está adaptado.
      const calidez = inst.vegetacionTinte[celda]! / 255;
      tono.setRGB(0.10 + calidez * 0.36, 0.34 + calidez * 0.22, 0.13 + calidez * 0.05);
      this.arboles!.setColorAt(arboles, tono);
      arboles++;
    }
    matriz.compose(vacio, sinRotar, new THREE.Vector3(0, 0, 0));
    for (let i = arboles; i < this.geo.nCeldas; i++) this.arboles!.setMatrixAt(i, matriz);
    this.arboles!.instanceMatrix.needsUpdate = true;
    if (this.arboles!.instanceColor) this.arboles!.instanceColor.needsUpdate = true;

    // --- El sol, donde toca ---------------------------------------------------
    const d = direccionDelSol(inst.tick);
    this.sol.position.set(d[0] * 12, d[1] * 12, d[2] * 12);
  }

  private construirMundo(nivel: number, altura: Float32Array): void {
    const geo = construirGeometria(nivel);
    this.geo = geo;

    if (this.terreno) {
      this.terreno.geometry.dispose();
      this.pivote.remove(this.terreno);
    }
    this.trozos = construirMallaTerreno(geo, altura);
    this.terreno = new THREE.Mesh(
      this.trozos.malla,
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    );
    this.pivote.add(this.terreno);

    // El océano: una esfera lisa al nivel del mar. El agua llenando los valles
    // es literalmente eso, una bola azul translúcida.
    this.pivote.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(radioDelMar(RADIO_PLANETA), 128, 80),
        new THREE.MeshLambertMaterial({ color: 0x2b79ae, transparent: true, opacity: 0.72 }),
      ),
    );

    if (this.nubes) this.pivote.remove(this.nubes);
    this.nubes = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 7, 5),
      new THREE.MeshLambertMaterial({ color: 0xf4f8fd, transparent: true, opacity: 0.42 }),
      geo.nCeldas,
    );
    this.nubes.frustumCulled = false;
    this.pivote.add(this.nubes);

    if (this.arboles) this.pivote.remove(this.arboles);
    // Un cono por celda con vegetación. Miles de instancias son un solo dibujo
    // para la tarjeta gráfica: los árboles no son lo caro de este proyecto.
    this.arboles = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.5, 1, 6),
      new THREE.MeshLambertMaterial({ flatShading: true }),
      geo.nCeldas,
    );
    this.arboles.frustumCulled = false;
    this.pivote.add(this.arboles);

    this.nivelDibujado = nivel;
  }

  dibujar(): void {
    const cosX = Math.cos(this.giroX);
    this.camara.position.set(
      Math.sin(this.giroY) * cosX * this.distancia,
      Math.sin(this.giroX) * this.distancia,
      Math.cos(this.giroY) * cosX * this.distancia,
    );
    this.camara.lookAt(0, 0, 0);
    this.render.render(this.escena, this.camara);
  }

  private ajustarTamano(): void {
    const ancho = this.lienzo.clientWidth;
    const alto = this.lienzo.clientHeight;
    this.render.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
  }

  private conectarGestos(): void {
    let arrastrando = false;
    let ultimoX = 0;
    let ultimoY = 0;
    let pellizcoPrevio = 0;

    const acercar = (delta: number) => {
      this.distancia = Math.max(1.12, Math.min(9, this.distancia * (1 + delta)));
    };

    this.lienzo.addEventListener('pointerdown', (e) => {
      arrastrando = true;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
    });
    this.lienzo.addEventListener('pointermove', (e) => {
      if (!arrastrando) return;
      this.giroY -= (e.clientX - ultimoX) * 0.006;
      this.giroX += (e.clientY - ultimoY) * 0.006;
      const tope = 1.45;
      this.giroX = Math.max(-tope, Math.min(tope, this.giroX));
      ultimoX = e.clientX;
      ultimoY = e.clientY;
    });
    window.addEventListener('pointerup', () => {
      arrastrando = false;
    });
    this.lienzo.addEventListener('wheel', (e) => {
      e.preventDefault();
      acercar(e.deltaY * 0.0012);
    }, { passive: false });
    this.lienzo.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (pellizcoPrevio > 0) acercar((pellizcoPrevio - d) * 0.004);
      pellizcoPrevio = d;
    }, { passive: false });
    this.lienzo.addEventListener('touchend', () => {
      pellizcoPrevio = 0;
    });
  }
}

export { TEMP_CONGELACION, NIVEL_DEL_MAR };
