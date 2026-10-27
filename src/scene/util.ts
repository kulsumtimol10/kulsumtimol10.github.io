import * as THREE from 'three';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Facade UVs are measured in window bays and floors so every building shares one texture
// without stretching. One texture tile holds 8 x 8 windows.
export const BAY = 0.75;
export const FLOOR = 0.95;
const U = 1 / (BAY * 8);
const V = 1 / (FLOOR * 8);

/** Accumulates quads into one geometry, so hundreds of buildings become a single draw call. */
export class MeshBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  idx: number[] = [];

  quad(p: THREE.Vector3[], n: THREE.Vector3, uv: [number, number][]) {
    const base = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i].x, p[i].y, p[i].z);
      this.nor.push(n.x, n.y, n.z);
      this.uv.push(uv[i][0], uv[i][1]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Four walls of a box (no top or bottom), with UVs in facade units. */
  walls(x: number, y: number, z: number, w: number, h: number, d: number, uOff = 0, vOff = 0) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y0 = y, y1 = y + h;
    const v0 = y0 * V + vOff, v1 = y1 * V + vOff;
    const V3 = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c);
    // south (+z)
    this.quad([V3(x0, y0, z1), V3(x1, y0, z1), V3(x1, y1, z1), V3(x0, y1, z1)], V3(0, 0, 1),
      [[uOff, v0], [uOff + w * U, v0], [uOff + w * U, v1], [uOff, v1]]);
    // north (-z)
    this.quad([V3(x1, y0, z0), V3(x0, y0, z0), V3(x0, y1, z0), V3(x1, y1, z0)], V3(0, 0, -1),
      [[uOff + 0.5, v0], [uOff + 0.5 + w * U, v0], [uOff + 0.5 + w * U, v1], [uOff + 0.5, v1]]);
    // east (+x)
    this.quad([V3(x1, y0, z1), V3(x1, y0, z0), V3(x1, y1, z0), V3(x1, y1, z1)], V3(1, 0, 0),
      [[uOff + 0.25, v0], [uOff + 0.25 + d * U, v0], [uOff + 0.25 + d * U, v1], [uOff + 0.25, v1]]);
    // west (-x)
    this.quad([V3(x0, y0, z0), V3(x0, y0, z1), V3(x0, y1, z1), V3(x0, y1, z0)], V3(-1, 0, 0),
      [[uOff + 0.75, v0], [uOff + 0.75 + d * U, v0], [uOff + 0.75 + d * U, v1], [uOff + 0.75, v1]]);
  }

  /** Horizontal top face; UVs in world units / 8 so roof gravel tiles evenly. */
  top(x: number, y: number, z: number, w: number, d: number) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const s = 1 / 8;
    this.quad(
      [new THREE.Vector3(x0, y, z1), new THREE.Vector3(x1, y, z1), new THREE.Vector3(x1, y, z0), new THREE.Vector3(x0, y, z0)],
      new THREE.Vector3(0, 1, 0),
      [[x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s], [x0 * s, z0 * s]],
    );
  }

  /** A closed box: walls plus top. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, uOff = 0) {
    this.walls(x, y, z, w, h, d, uOff);
    this.top(x, y + h, z, w, d);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }

  get empty() {
    return this.pos.length === 0;
  }
}

export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
