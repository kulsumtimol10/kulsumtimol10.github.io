import * as THREE from 'three';
import { makeFacade, makeRoof, makeSign, type FacadeSpec } from './textures';
import { MeshBuilder, rng, smooth, nextFrame } from './util';

export const FACADES: FacadeSpec[] = [
  { frame: '#7d858c', glass: '#5d6f80', spandrel: '#2a333c', style: 'curtain', lit: 0.42, seed: 1 }, // 0 blue-grey glass
  { frame: '#6e5e44', glass: '#a88a55', spandrel: '#4f3f26', style: 'curtain', lit: 0.36, seed: 2 }, // 1 gold glass (RBC Plaza)
  { frame: '#15171a', glass: '#2b3038', spandrel: '#111316', style: 'curtain', lit: 0.4, seed: 3 }, // 2 black steel (TD Centre)
  { frame: '#a39d92', glass: '#3a4048', style: 'punched', winW: 0.56, winH: 0.62, lit: 0.45, seed: 4 }, // 3 concrete
  { frame: '#7e4636', glass: '#30353b', style: 'brick', winW: 0.46, winH: 0.6, lit: 0.5, seed: 5 }, // 4 brick
  { frame: '#959c9e', glass: '#5b7472', spandrel: '#2b3a3a', style: 'curtain', lit: 0.4, seed: 6 }, // 5 green glass
  { frame: '#c4c1ba', glass: '#4a5866', style: 'ribbon', winH: 0.64, lit: 0.55, seed: 7 }, // 6 condo
];

export type CityMaterials = {
  facades: THREE.MeshStandardMaterial[];
  roof: THREE.MeshStandardMaterial;
  crown: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
};

export async function makeMaterials(size: number, aniso: number, onStep: () => void): Promise<CityMaterials> {
  const facades: THREE.MeshStandardMaterial[] = [];
  for (const spec of FACADES) {
    const t = makeFacade(spec, size, aniso);
    facades.push(new THREE.MeshStandardMaterial({
      map: t.map, emissiveMap: t.emissiveMap, roughnessMap: t.rmMap, metalnessMap: t.rmMap,
      roughness: 1, metalness: 1, emissive: 0xffffff, emissiveIntensity: 0,
    }));
    onStep();
    await nextFrame();
  }
  return {
    facades,
    roof: new THREE.MeshStandardMaterial({ map: makeRoof(aniso), roughness: 0.95 }),
    crown: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xdfe8ff, emissiveIntensity: 0 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x7c8088, roughness: 0.45, metalness: 0.8 }),
  };
}

type Rect = [number, number, number, number]; // x0, x1, z0, z1 (z0 < z1)

export const FEATURED_X = { trueline: 0, seneca: 48, needlist: 96, securevault: 144, lane: 180 };
export const LANE = { x0: 174, x1: 186, zEnd: -112 };
export const CN = { x: 245, z: -36 };
export const DOME = { x: 286, z: -44, r: 24 };

const EXCLUDE: Rect[] = [
  [-12, 12, -26, -8], [32, 64, -26, -8], [82, 110, -28, -8], [134, 154, -26, -8],
  [158, 202, LANE.zEnd - 2, -8],
  [CN.x - 16, CN.x + 16, CN.z - 16, CN.z + 16],
  [DOME.x - DOME.r - 4, DOME.x + DOME.r + 4, DOME.z - DOME.r - 4, DOME.z + DOME.r + 4],
];
const hit = (r: Rect) => EXCLUDE.some((e) => r[0] < e[1] && r[1] > e[0] && r[2] < e[3] && r[3] > e[2]);

/**
 * Downtown Toronto, procedurally: a grid of blocks whose heights peak around the
 * financial district, with condo towers along the waterfront.
 */
export function buildCity(scene: THREE.Scene, mats: CityMaterials, density: number) {
  const r = rng(2026);
  const fac = FACADES.map(() => new MeshBuilder());
  const roof = new MeshBuilder();
  const crown = new MeshBuilder();
  const metal = new MeshBuilder();
  const warn: THREE.Vector3[] = [];
  const footprints: Rect[] = [];

  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const uo = () => Math.floor(r() * 8) / 8;

  function tower(x: number, z: number, w: number, d: number, h: number, type: number) {
    let base = 0;
    if (h > 24 && w > 9 && d > 9 && r() < 0.75) {
      const ph = 3 + Math.floor(r() * 4) * 0.95;
      fac[pick([3, 4, 3])].walls(x, 0, z, w, ph, d, uo());
      roof.top(x, ph, z, w, d);
      base = ph;
      w -= 2 + r() * 2.5;
      d -= 2 + r() * 2.5;
    }
    const th = h - base;
    fac[type].walls(x, base, z, w, th, d, uo());
    let top = h, tw = w, td = d;
    if (h > 34 && r() < 0.55) {
      const cw = w * (0.6 + r() * 0.2), cd = d * (0.6 + r() * 0.2), ch = 2 + r() * 4;
      roof.top(x, h, z, w, d);
      fac[type].walls(x, h, z, cw, ch, cd, uo());
      top = h + ch;
      tw = cw;
      td = cd;
      roof.top(x, top, z, cw, cd);
      if (r() < 0.6) crown.walls(x, top - 0.5, z, cw + 0.08, 0.35, cd + 0.08);
    } else {
      roof.top(x, h, z, w, d);
      if (h > 30 && r() < 0.35) crown.walls(x, h - 0.6, z, w + 0.06, 0.3, d + 0.06);
    }
    // Rooftop plant rooms and antennas, kept inside whichever roof they stand on.
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const mw = 1 + r() * Math.min(4, tw * 0.4), md = 1 + r() * Math.min(4, td * 0.4), mh = 0.6 + r() * 1.6;
      roof.box(x + (r() - 0.5) * (tw - mw) * 0.8, top, z + (r() - 0.5) * (td - md) * 0.8, mw, mh, md);
    }
    if (h > 45 && r() < 0.5) {
      const ah = 4 + r() * 8;
      metal.box(x, top, z, 0.18, ah, 0.18);
      warn.push(new THREE.Vector3(x, top + ah + 0.2, z));
    } else if (h > 40) {
      warn.push(new THREE.Vector3(x + tw / 2 - 0.3, top + 0.3, z + td / 2 - 0.3), new THREE.Vector3(x - tw / 2 + 0.3, top + 0.3, z - td / 2 + 0.3));
    }
  }

  // The last three rows are low-rise midtown and suburbs that fade into the haze behind downtown.
  const rows: [number, number][] = [[-22, -9], [-60, -28], [-100, -66], [-140, -106], [-186, -146], [-240, -192], [-300, -246], [-370, -306], [-450, -376]];
  for (let ri = 0; ri < rows.length; ri++) {
    const [z0, z1] = rows[ri];
    for (let bx = -270; bx < 560; bx += 42) {
      const bx1 = bx + 36;
      let x = bx;
      while (x < bx1 - 5) {
        const w = Math.min(bx1 - x, 7 + r() * 9);
        const depth = z1 - z0;
        const split = depth > 24 && r() < 0.7;
        const parts: [number, number][] = split ? [[z0, z0 + depth / 2 - 1], [z0 + depth / 2 + 1, z1]] : [[z0, z1]];
        for (const [pz0, pz1] of parts) {
          if (r() > density) continue;
          const lw = w - 1.2, ld = pz1 - pz0 - 1.2;
          const cx = x + w / 2, cz = (pz0 + pz1) / 2;
          if (hit([cx - lw / 2, cx + lw / 2, cz - ld / 2, cz + ld / 2])) continue;
          if (ri > 5 && r() > 0.65) continue;
          const core = Math.exp(-(((cx - 112) / 72) ** 2 + ((cz + 82) / 52) ** 2));
          let h = 6 + r() * 10 + core * (22 + r() * 62);
          if (ri === 0) h = 12 + r() * 30 - (cx > 190 && cx < 225 ? 12 : 0);
          if (ri > 3) h *= 0.8;
          if (ri > 5) h = 3 + r() * 9;
          else if (r() < 0.08) h += 18 + r() * 18;
          // Keep clear of the camera's climb out of Projects Lane and its flight to the lake.
          if (cx > 150 && cx < 230 && cz > -120) h = Math.min(h, 34);
          footprints.push([cx - lw / 2, cx + lw / 2, cz - ld / 2, cz + ld / 2]);
          let type: number;
          if (ri === 0) type = pick([6, 6, 0, 5, 3]);
          else if (h > 48) type = pick([0, 0, 1, 2, 2, 5]);
          else if (h > 22) type = pick([0, 3, 5, 6, 2]);
          else type = pick([3, 3, 4, 4, 6]);
          tower(cx, cz, lw, ld, h, type);
        }
        x += w;
      }
    }
  }

  // Projects Lane: a Distillery-District-style row of brick warehouses on both sides of the lane.
  for (const side of [-1, 1]) {
    const cx = side < 0 ? LANE.x0 - 7 : LANE.x1 + 7;
    let z = -9;
    while (z > LANE.zEnd) {
      const d = 10 + r() * 8;
      const h = 9 + r() * 6;
      const type = r() < 0.75 ? 4 : 3;
      fac[type].walls(cx, 0, z - d / 2, 13.6, h, d - 0.2, uo());
      footprints.push([cx - 6.8, cx + 6.8, z - d + 0.1, z - 0.1]);
      roof.top(cx, h, z - d / 2, 13.6, d - 0.2);
      roof.box(cx + (r() - 0.5) * 6, h, z - d / 2, 2.5, 1.2, 2.5);
      z -= d;
    }
  }

  // Development check: no two buildings (including the landmarks' reserved plots) may share ground.
  if (import.meta.env.DEV) {
    const all = [...footprints, ...EXCLUDE.slice(0, 4), [CN.x - 9, CN.x + 9, CN.z - 9, CN.z + 9] as Rect, [DOME.x - DOME.r, DOME.x + DOME.r, DOME.z - DOME.r, DOME.z + DOME.r] as Rect];
    const bad: [Rect, Rect][] = [];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      if (a[0] < b[1] - 0.01 && a[1] > b[0] + 0.01 && a[2] < b[3] - 0.01 && a[3] > b[2] + 0.01) bad.push([a, b]);
    }
    (window as unknown as { __overlaps: unknown }).__overlaps = { buildings: all.length, overlaps: bad.length, sample: bad.slice(0, 8) };
  }

  const meshes: THREE.Mesh[] = [];
  const add = (b: MeshBuilder, m: THREE.Material) => {
    if (b.empty) return;
    const mesh = new THREE.Mesh(b.build(), m);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);
  };
  fac.forEach((b, i) => add(b, mats.facades[i]));
  add(roof, mats.roof);
  add(crown, mats.crown);
  add(metal, mats.metal);

  // Red aircraft warning lights on the tall towers.
  const warnMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.15) }), warn.length);
  warn.forEach((p, i) => warnMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  scene.add(warnMesh);

  return {
    update(night: number, t: number) {
      mats.facades.forEach((m, i) => (m.emissiveIntensity = night * (i === 2 ? 2.4 : 1.9)));
      mats.crown.emissiveIntensity = night * 1.5;
      warnMesh.visible = night > 0.2 && Math.sin(t * 2.4) > -0.2;
    },
  };
}

export type Featured = {
  id: string;
  key: number;
  group: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  accents: THREE.MeshStandardMaterial[];
  sign: THREE.MeshBasicMaterial;
  label: { pos: THREE.Vector3; title: string; sub: string };
};

function signMesh(text: string, color: string, height: number, sub?: string) {
  const s = makeSign(text, color, { sub });
  const mat = new THREE.MeshBasicMaterial({ map: s.texture, toneMapped: true });
  const w = height * s.aspect;
  const g = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, height + 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.6, metalness: 0.4 }));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, height), mat);
  face.position.z = 0.16;
  g.add(panel, face);
  return { group: g, mat, width: w };
}

/** The career landmarks: bespoke buildings with their own signs and lights that switch on as you arrive. */
export function buildFeatured(scene: THREE.Scene, mats: CityMaterials, keys: Record<string, number>): Featured[] {
  const out: Featured[] = [];
  const own = (i: number) => mats.facades[i].clone();
  const accent = (color: string) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 0, roughness: 0.4 });
  // Each landmark lives in its own group so it can be clicked as one object.
  const building = () => {
    const g = new THREE.Group();
    scene.add(g);
    const mesh = (b: MeshBuilder, m: THREE.Material) => {
      const me = new THREE.Mesh(b.build(), m);
      me.castShadow = me.receiveShadow = true;
      g.add(me);
      return me;
    };
    return { g, mesh, roof: (b: MeshBuilder) => mesh(b, mats.roof) };
  };

  // Trueline Solution: concrete office block with copper fins.
  {
    const x = FEATURED_X.trueline, z = -16, w = 18, d = 14, h = 21;
    const { g, mesh, roof } = building();
    const m = own(3), fin = accent('#ff9a4a');
    fin.color.set('#b0643a');
    const b = new MeshBuilder(), rf = new MeshBuilder(), fb = new MeshBuilder();
    b.walls(x, 0, z, w, h, d, 0.25);
    rf.top(x, h, z, w, d);
    rf.box(x - 3, h, z - 2, 4, 1.4, 3);
    rf.box(x + 4, h, z + 1, 3, 1, 3);
    for (let i = 0; i <= 8; i++) fb.box(x - w / 2 + i * (w / 8), 0.6, z + d / 2 + 0.25, 0.22, h - 0.6, 0.5);
    mesh(b, m); roof(rf); mesh(fb, fin);
    const s = signMesh('TRUELINE SOLUTION', '#ffb070', 1.7);
    s.group.position.set(x, h + 1.4, z + d / 2 - 0.3);
    g.add(s.group);
    out.push({ id: 'trueline', key: keys.trueline, group: g, mats: [m], accents: [fin], sign: s.mat, label: { pos: new THREE.Vector3(x, h + 4.5, z + d / 2), title: 'Trueline Solution', sub: 'Full Stack Developer · 2023–24' } });
  }

  // Seneca Polytechnic: brick campus wing with a glass atrium that steps forward of it.
  {
    const x = FEATURED_X.seneca, z = -16, h = 12;
    const { g, mesh, roof } = building();
    const brick = own(4), glass = own(5), red = accent('#ff3b3b');
    red.color.set('#a31f24');
    const b = new MeshBuilder(), gl = new MeshBuilder(), rf = new MeshBuilder(), rb = new MeshBuilder();
    b.walls(x + 4, 0, z, 22, h, 14, 0.5);
    rf.top(x + 4, h, z, 22, 14);
    // The atrium's front sits 0.6 ahead of the wing's, so the two never share a wall plane.
    gl.walls(x - 9, 0, z + 2, 9, 15, 11.2, 0);
    rf.top(x - 9, 15, z + 2, 9, 11.2);
    rb.box(x + 5.3, 3.2, z + 7.4, 19.4, 0.35, 1.6);
    rb.walls(x - 9, 14.7, z + 2, 9.1, 0.3, 11.3);
    mesh(b, brick); mesh(gl, glass); roof(rf); mesh(rb, red);
    const s = signMesh('SENECA', '#ff4a4a', 2.2, 'POLYTECHNIC');
    s.group.position.set(x + 6, h + 1.9, z + 6.7);
    g.add(s.group);
    out.push({ id: 'seneca', key: keys.seneca, group: g, mats: [brick, glass], accents: [red], sign: s.mat, label: { pos: new THREE.Vector3(x + 2, h + 6.5, z + 7), title: 'Seneca Polytechnic', sub: 'Business IT · GPA 3.8' } });
  }

  // Needlist.org: a blue glass tower with a lit crown.
  {
    const x = FEATURED_X.needlist, z = -18;
    const { g, mesh, roof } = building();
    const glass = own(0), podium = own(3), crownM = accent('#6ea8ff');
    const b = new MeshBuilder(), p = new MeshBuilder(), rf = new MeshBuilder(), c = new MeshBuilder();
    p.walls(x, 0, z, 24, 6.6, 18, 0);
    rf.top(x, 6.6, z, 24, 18);
    b.walls(x, 6.6, z - 1, 14, 50, 13, 0.5);
    rf.top(x, 56.6, z - 1, 14, 13);
    for (const [dx, dz, w, d] of [[-7.1, 0, 0.3, 13.4], [7.1, 0, 0.3, 13.4], [0, 6.6, 14.4, 0.3], [0, -6.6, 14.4, 0.3]] as const) c.box(x + dx, 54.6, z - 1 + dz, w, 6.5, d);
    rf.box(x, 56.6, z - 1, 5, 2, 5);
    mesh(b, glass); mesh(p, podium); roof(rf); mesh(c, crownM);
    const s = signMesh('NEEDLIST.ORG', '#8ab8ff', 2.4);
    s.group.position.set(x, 50.5, z + 5.65);
    g.add(s.group);
    out.push({ id: 'needlist', key: keys.needlist, group: g, mats: [glass, podium], accents: [crownM], sign: s.mat, label: { pos: new THREE.Vector3(x, 64, z + 6), title: 'Needlist.org', sub: 'Software Developer Co-op · 2026' } });
  }

  // SecureVault: a black monolith with a green LED band and a padlock on its face.
  {
    const x = FEATURED_X.securevault, z = -16, w = 15, d = 13, h = 40;
    const { g, mesh, roof } = building();
    const black = own(2), led = accent('#38e08f');
    const b = new MeshBuilder(), rf = new MeshBuilder(), l = new MeshBuilder();
    b.walls(x, 0, z, w, h, d, 0);
    rf.top(x, h, z, w, d);
    l.walls(x, h - 1.2, z, w + 0.1, 0.5, d + 0.1);
    l.walls(x, 4.2, z, w + 0.1, 0.25, d + 0.1);
    mesh(b, black); roof(rf); mesh(l, led);
    const lock = new THREE.Group();
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.32, 12, 32, Math.PI), led);
    shackle.position.y = 1.4;
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 0.5), led);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0x050607 }));
    hole.rotation.x = Math.PI / 2;
    hole.position.z = 0.1;
    lock.add(shackle, body, hole);
    lock.position.set(x, 29, z + d / 2 + 0.3);
    g.add(lock);
    const s = signMesh('SECUREVAULT', '#47f0a0', 1.9);
    s.group.position.set(x, 34.5, z + d / 2 + 0.2);
    g.add(s.group);
    out.push({ id: 'securevault', key: keys.securevault, group: g, mats: [black], accents: [led], sign: s.mat, label: { pos: new THREE.Vector3(x, h + 4, z + d / 2), title: 'SecureVault', sub: 'Featured project · AES-256' } });
  }

  return out;
}

export function updateFeatured(list: Featured[], u: number, night: number) {
  for (const f of list) {
    const lit = smooth(f.key - 0.7, f.key - 0.15, u);
    for (const m of f.mats) m.emissiveIntensity = lit * (0.06 + night * 2.2);
    for (const a of f.accents) a.emissiveIntensity = lit * (1.2 + night * 3.5);
    f.sign.color.setScalar(0.45 + lit * (0.55 + night * 1.3));
  }
}
