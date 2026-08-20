/**
 * El planeta dibujado.
 *
 * Cada celda es un prisma de tapa plana a la altura de su terreno. De ahí sale
 * solo el aspecto de mesetas y acantilados: donde dos celdas vecinas están a
 * alturas distintas queda una pared entre ellas. No hay ningún filtro ni ningún
 * truco de estilo — es la geometría del mundo, dibujada tal cual.
 *
 * Este archivo solo mira. No puede tocar el estado ni tomar decisiones de
 * simulación: recibe instantáneas y las convierte en triángulos.
 */

import * as THREE from 'three';
import { MAX_VECINOS, NIVEL_DEL_MAR, RADIO_PLANETA } from '../sim/constants.js';
import { construirGeometria, type Geometria } from '../sim/geodesica.js';
import { radioDeCelda, radioDelMar } from '../sim/terreno.js';

/**
 * Color de una celda según su altura.
 *
 * PROVISIONAL, y queda dicho: en la fase 1b esto se sustituye por la lectura de
 * la humedad y la biomasa reales, para cumplir la regla de que nada de lo que
 * se ve sea decorativo. Hoy la altura sí es un número real de la simulación,
 * así que el mapa de color ya está leyendo algo de verdad, pero es lo único.
 */
function colorDeAltura(altura: number, destino: THREE.Color): THREE.Color {
  // Los cortes están puestos sobre la distribución real de alturas, medida en
  // el laboratorio: la tierra llega a 0,67 con la mediana en 0,167, y el mar
  // baja hasta 0,8. Con ellos el verde domina y la roca sale solo en lo alto.
  const bajoElAgua = NIVEL_DEL_MAR - altura;
  if (bajoElAgua > 0) {
    if (bajoElAgua > 0.42) return destino.setRGB(0.04, 0.10, 0.23); // fosa
    if (bajoElAgua > 0.14) return destino.setRGB(0.07, 0.20, 0.40); // fondo
    return destino.setRGB(0.20, 0.46, 0.58); // bajío
  }

  const sobre = altura - NIVEL_DEL_MAR;
  if (sobre < 0.04) return destino.setRGB(0.87, 0.81, 0.58); // arena de la orilla
  if (sobre < 0.21) return destino.setRGB(0.44, 0.68, 0.28); // pradera
  if (sobre < 0.38) return destino.setRGB(0.27, 0.53, 0.21); // bosque
  if (sobre < 0.54) return destino.setRGB(0.20, 0.41, 0.19); // bosque alto
  if (sobre < 0.63) return destino.setRGB(0.52, 0.45, 0.35); // roca desnuda
  return destino.setRGB(0.93, 0.94, 0.96); // nieve
}

/** Construye la malla del terreno: tapas planas y las paredes de los cantiles. */
function construirMallaTerreno(geo: Geometria, altura: Float32Array): THREE.BufferGeometry {
  const posiciones: number[] = [];
  const colores: number[] = [];
  const color = new THREE.Color();

  const radios = new Float32Array(geo.nCeldas);
  for (let i = 0; i < geo.nCeldas; i++) radios[i] = radioDeCelda(altura[i]!, RADIO_PLANETA);

  for (let celda = 0; celda < geo.nCeldas; celda++) {
    const lados = geo.nVecinos[celda]!;
    const r = radios[celda]!;
    colorDeAltura(altura[celda]!, color);

    const cx = geo.centro[celda * 3]! * r;
    const cy = geo.centro[celda * 3 + 1]! * r;
    const cz = geo.centro[celda * 3 + 2]! * r;

    // La celda más baja de todo el vecindario no necesita falda: la tapan las
    // paredes de sus vecinas.
    let radioMasBajo = r;
    for (let k = 0; k < lados; k++) {
      const v = geo.vecinos[celda * MAX_VECINOS + k]!;
      if (radios[v]! < radioMasBajo) radioMasBajo = radios[v]!;
    }

    for (let k = 0; k < lados; k++) {
      const a = (celda * MAX_VECINOS + k) * 3;
      const b = (celda * MAX_VECINOS + ((k + 1) % lados)) * 3;

      const ax = geo.esquinas[a]!;
      const ay = geo.esquinas[a + 1]!;
      const az = geo.esquinas[a + 2]!;
      const bx = geo.esquinas[b]!;
      const by = geo.esquinas[b + 1]!;
      const bz = geo.esquinas[b + 2]!;

      // Tapa: un abanico de triángulos desde el centro de la celda.
      posiciones.push(cx, cy, cz, ax * r, ay * r, az * r, bx * r, by * r, bz * r);
      for (let n = 0; n < 3; n++) colores.push(color.r, color.g, color.b);

      // Pared del cantil, hasta la vecina más baja.
      if (radioMasBajo < r) {
        const rb = radioMasBajo;
        posiciones.push(
          ax * r, ay * r, az * r,
          ax * rb, ay * rb, az * rb,
          bx * r, by * r, bz * r,
          bx * r, by * r, bz * r,
          ax * rb, ay * rb, az * rb,
          bx * rb, by * rb, bz * rb,
        );
        // La pared va un poco más oscura, como una roca en sombra.
        for (let n = 0; n < 6; n++) colores.push(color.r * 0.62, color.g * 0.58, color.b * 0.55);
      }
    }
  }

  const malla = new THREE.BufferGeometry();
  malla.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  malla.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
  malla.computeVertexNormals();
  return malla;
}

/** Un puñado de estrellas de fondo, para que la bola se lea como un planeta. */
function construirEstrellas(): THREE.Points {
  const n = 1200;
  const pos = new Float32Array(n * 3);
  // Colocadas con un generador propio para que el fondo también sea el mismo
  // siempre y no parpadee entre recargas.
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
  return new THREE.Points(
    g,
    new THREE.PointsMaterial({ color: 0xbcd0e6, size: 0.055, sizeAttenuation: true }),
  );
}

export class VistaPlaneta {
  private readonly escena = new THREE.Scene();
  private readonly camara: THREE.PerspectiveCamera;
  private readonly render: THREE.WebGLRenderer;
  private readonly pivote = new THREE.Group();
  private terreno: THREE.Mesh | null = null;

  /** Giro acumulado de la cámara y distancia, que es lo que mueve el dedo. */
  private giroX = 0.35;
  private giroY = 0.6;
  private distancia = 3.1;
  private nivelDibujado = -1;

  constructor(private readonly lienzo: HTMLCanvasElement) {
    this.render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
    this.render.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camara = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    this.escena.background = new THREE.Color(0x0a1020);
    this.escena.add(this.pivote);
    this.escena.add(construirEstrellas());

    // El sol. En la fase 1b este mismo foco define dónde es de día: la línea de
    // la noche será dónde deja de llegar, no una fórmula aparte.
    const sol = new THREE.DirectionalLight(0xfff2dd, 2.4);
    sol.position.set(4, 2.2, 3);
    this.escena.add(sol);
    // Luz de relleno: el azul del cielo por arriba y el rebote del mar por abajo.
    this.escena.add(new THREE.HemisphereLight(0x93b6e8, 0x1b2a3a, 0.85));

    this.conectarGestos();
    this.ajustarTamano();
    window.addEventListener('resize', () => this.ajustarTamano());
  }

  /** Rehace el terreno cuando llega una instantánea con alturas nuevas. */
  actualizar(nivel: number, altura: Float32Array): void {
    if (this.nivelDibujado === nivel && this.terreno) return;

    const geo = construirGeometria(nivel);
    if (this.terreno) {
      this.terreno.geometry.dispose();
      this.pivote.remove(this.terreno);
    }

    this.terreno = new THREE.Mesh(
      construirMallaTerreno(geo, altura),
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    );
    this.pivote.add(this.terreno);

    // El océano: una esfera lisa justo al nivel del mar. El efecto de agua
    // llenando los valles es literalmente eso, una bola azul translúcida.
    const mar = new THREE.Mesh(
      new THREE.SphereGeometry(radioDelMar(RADIO_PLANETA), 128, 80),
      new THREE.MeshLambertMaterial({
        color: 0x2b79ae,
        transparent: true,
        // Translúcido a propósito: así los bajíos se ven turquesa y las fosas
        // casi negras, y la profundidad se lee sin dibujar nada aparte.
        opacity: 0.74,
      }),
    );
    this.pivote.add(mar);

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

  /** Arrastrar para girar el planeta, rueda o pellizco para acercarse. */
  private conectarGestos(): void {
    let arrastrando = false;
    let ultimoX = 0;
    let ultimoY = 0;
    let pellizcoPrevio = 0;

    const empezar = (x: number, y: number) => {
      arrastrando = true;
      ultimoX = x;
      ultimoY = y;
    };
    const mover = (x: number, y: number) => {
      if (!arrastrando) return;
      this.giroY -= (x - ultimoX) * 0.006;
      this.giroX += (y - ultimoY) * 0.006;
      // Sin pasarse de los polos, que da mareo.
      const tope = 1.45;
      this.giroX = Math.max(-tope, Math.min(tope, this.giroX));
      ultimoX = x;
      ultimoY = y;
    };
    const soltar = () => {
      arrastrando = false;
    };
    const acercar = (delta: number) => {
      this.distancia = Math.max(1.12, Math.min(9, this.distancia * (1 + delta)));
    };

    this.lienzo.addEventListener('pointerdown', (e) => empezar(e.clientX, e.clientY));
    this.lienzo.addEventListener('pointermove', (e) => mover(e.clientX, e.clientY));
    window.addEventListener('pointerup', soltar);
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
