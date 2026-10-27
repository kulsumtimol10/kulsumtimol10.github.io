import * as THREE from 'three';
import { makeAsphalt, makeBillboard, makeSign, makeWetRoughness } from './textures';
import { LANE } from './city';
import type { Stop } from '../content';

export const BOARDS = [
  { id: 'ecs', side: 1, z: -26, accent: '#ff9f43', icon: 'ecs', footer: 'github.com/kulsumtimol10/e-commerce-ECS-microservices' },
  { id: 'movies', side: 1, z: -42, accent: '#ff5e7e', icon: 'movie' },
  { id: 'grocery', side: 1, z: -58, accent: '#3ddc97', icon: 'grocery' },
  { id: 'shop', side: 1, z: -74, accent: '#7c9cff', icon: 'shop' },
  { id: 'image', side: 1, z: -90, accent: '#ffd166', icon: 'image' },
] as const;

// Screens hang on the east wall so the chapter card (bottom left) never covers them.
export const SCREEN = { w: 8.4, h: 4.725, y: 5.4 };

const WEST = LANE.x0 - 0.2, EAST = LANE.x1 + 0.2;
export const wallX = (side: number) => (side < 0 ? WEST : EAST);

export function laneTreeSpots() {
  const spots: THREE.Vector3[] = [];
  for (let z = -18; z > LANE.zEnd + 6; z -= 16) {
    // East-side planters sit between screens (screens are at -26, -42, ...) so they never block one.
    spots.push(new THREE.Vector3(LANE.x0 + 1.3, 0.55, z), new THREE.Vector3(LANE.x1 - 1.3, 0.55, z - 16));
  }
  return spots;
}

/** Projects Lane: a brick lane with string lights, where every wall screen is one of her projects. */
export function buildLane(scene: THREE.Scene, stops: Stop[], aniso: number, glow: THREE.Texture) {
  // Starts behind the sidewalk (z = -9) and sits clearly above the city ground, so the surfaces never flicker.
  const len = -LANE.zEnd - 9, cz = -9 - len / 2, w = LANE.x1 - LANE.x0, cx = (LANE.x0 + LANE.x1) / 2;
  const map = makeAsphalt(aniso, '#2a2624');
  map.repeat.set(3, 26);
  const wet = makeWetRoughness(aniso);
  wet.repeat.set(2, 16);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshStandardMaterial({ map, roughnessMap: wet, roughness: 1, metalness: 0.15, envMapIntensity: 1.6 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0.06, cz);
  ground.receiveShadow = true;
  scene.add(ground);

  // Entrance arch.
  const iron = new THREE.MeshStandardMaterial({ color: 0x1c1d21, metalness: 0.7, roughness: 0.45 });
  const arch = new THREE.Group();
  for (const x of [LANE.x0 + 0.4, LANE.x1 - 0.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 12, 0.45), iron);
    post.position.set(x, 6, -9.6);
    post.castShadow = true;
    arch.add(post);
  }
  const s = makeSign('PROJECTS LANE', '#ff6fae', { sub: 'BUILT BY KULSUM TIMOL' });
  const signMat = new THREE.MeshBasicMaterial({ map: s.texture });
  const sh = 2.1, sw = Math.min(w - 1.2, sh * s.aspect);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(w, sw / s.aspect + 0.5, 0.4), iron);
  beam.position.set(cx, 11.3, -9.6);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw / s.aspect), signMat);
  face.position.set(cx, 11.3, -9.38);
  arch.add(beam, face);
  scene.add(arch);

  // String lights.
  const bulbs: THREE.Vector3[] = [];
  const wire: number[] = [];
  for (let z = -14; z > LANE.zEnd + 2; z -= 6) {
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const p = new THREE.Vector3(LANE.x0 + t * w, 9 - 4 * 1.1 * t * (1 - t), z - t * 2);
      if (i > 0 && i < 18) bulbs.push(p);
      if (prev) wire.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      prev = p;
    }
  }
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.5) });
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), bulbMat, bulbs.length);
  bulbs.forEach((p, i) => bulbMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y - 0.12, p.z)));
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  scene.add(bulbMesh, new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x15161a })));

  // Wall lanterns and awnings over shop doors.
  const lanterns: THREE.Matrix4[] = [];
  const awningMats = ['#2f5d50', '#7a2f2f', '#2e3f6b', '#5a4a2a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  let k = 0;
  for (let z = -13; z > LANE.zEnd + 3; z -= 8) {
    for (const side of [-1, 1]) {
      const x = wallX(side) - side * 0.15;
      lanterns.push(new THREE.Matrix4().makeTranslation(x - side * 0.1, 3.2, z));
      if (k % 3 !== 1) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 2.6), awningMats[k % awningMats.length]);
        a.position.set(x - side * 0.62, 2.2, z - 3.5);
        a.rotation.z = side * -0.32;
        a.castShadow = true;
        scene.add(a);
      }
      k++;
    }
  }
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xffc77a, emissiveIntensity: 0 });
  const lanternMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.38, 0.22), lanternMat, lanterns.length);
  lanterns.forEach((m, i) => lanternMesh.setMatrixAt(i, m));
  scene.add(lanternMesh);

  // Planters.
  const planters = laneTreeSpots();
  const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.55, 1.3).translate(0, -0.27, 0), new THREE.MeshStandardMaterial({ color: 0x4d4a45, roughness: 0.9 }), planters.length);
  planters.forEach((p, i) => pm.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  pm.castShadow = true;
  scene.add(pm);

  // Project screens. Their light on the lane is faked with additive glow (a pool on the ground and a
  // wash on the wall) rather than real point lights, which cost every pixel in the city a lighting loop.
  const screens: { id: string; mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; pool: THREE.MeshBasicMaterial; wash: THREE.MeshBasicMaterial }[] = [];
  for (const b of BOARDS) {
    const stop = stops.find((st) => st.id === b.id)!;
    const t = makeBillboard({ kicker: stop.kicker, title: stop.title, body: stop.body, chips: stop.chips ?? [], accent: b.accent, icon: b.icon, footer: 'footer' in b ? b.footer : undefined });
    const x = wallX(b.side);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, SCREEN.h + 0.5, SCREEN.w + 0.5), iron);
    frame.position.set(x - b.side * 0.1, SCREEN.y, b.z);
    const mat = new THREE.MeshBasicMaterial({ map: t });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), mat);
    screen.position.set(x - b.side * 0.27, SCREEN.y, b.z);
    screen.rotation.y = b.side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const poolMat = new THREE.MeshBasicMaterial({ map: glow, color: b.accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 11).rotateX(-Math.PI / 2), poolMat);
    pool.position.set(x - b.side * 3, 0.1, b.z);
    const washMat = new THREE.MeshBasicMaterial({ map: glow, color: b.accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w * 1.9, SCREEN.h * 2.3), washMat);
    wash.position.set(x - b.side * 0.05, SCREEN.y, b.z);
    wash.rotation.y = screen.rotation.y;
    scene.add(frame, wash, screen, pool);
    screens.push({ id: b.id, mesh: screen, mat, pool: poolMat, wash: washMat });
  }

  return {
    arch,
    screens: screens.map((s) => ({ id: s.id, mesh: s.mesh })),
    update(night: number, t: number) {
      const glowAmt = 0.25 + night * 0.75;
      bulbMat.color.setRGB(1, 0.78, 0.5).multiplyScalar(0.7 + night * 4 + Math.sin(t * 7) * 0.05);
      lanternMat.emissiveIntensity = 0.3 + night * 4;
      signMat.color.setScalar(0.9 + night * 1.4);
      for (const s of screens) {
        s.mat.color.setScalar(0.95 + night * 0.55);
        s.pool.opacity = glowAmt * 0.42;
        s.wash.opacity = glowAmt * 0.3;
      }
    },
  };
}
