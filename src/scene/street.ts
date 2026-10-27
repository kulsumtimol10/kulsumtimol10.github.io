import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeAsphalt, makePavers, makeRoad, makeStreetcar, makeWood } from './textures';
import { rng } from './util';
import { LANE } from './city';

const X0 = -280, X1 = 560, LEN = X1 - X0, MID = (X0 + X1) / 2;

function plane(w: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

/** Queens Quay: road, streetcar tracks, promenade, boardwalk, lamps, autumn trees and traffic. */
export function buildStreet(scene: THREE.Scene, aniso: number, glow: THREE.Texture, extraTrees: THREE.Vector3[]) {
  const r = rng(77);

  const road = makeRoad(aniso);
  road.repeat.set(LEN / 20, 1);
  scene.add(plane(LEN, 5.2, new THREE.MeshStandardMaterial({ map: road, roughness: 0.82 }), MID, 0.01, 0));

  const pav = makePavers(aniso);
  pav.repeat.set(LEN / 4, 6.4 / 4);
  scene.add(plane(LEN, 6.4, new THREE.MeshStandardMaterial({ map: pav, roughness: 0.9 }), MID, 0.03, -5.8));
  const pav2 = makePavers(aniso, '#a7a197');
  pav2.repeat.set(LEN / 4, 4.6 / 4);
  scene.add(plane(LEN, 4.6, new THREE.MeshStandardMaterial({ map: pav2, roughness: 0.9 }), MID, 0.03, 4.9));
  const wood = makeWood(aniso);
  wood.repeat.set(LEN / 6, 1);
  wood.rotation = Math.PI / 2;
  scene.add(plane(LEN, 2.2, new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 }), MID, 0.05, 8.3));

  const asph = makeAsphalt(aniso, '#26282c');
  // City ground, reaching far past the last buildings so its edges always sit deep in the fog.
  asph.repeat.set(1000, 440);
  scene.add(plane(9000, 4000, new THREE.MeshStandardMaterial({ map: asph, roughness: 0.95 }), 140, 0, -2009));

  const curb = new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 0.9 });
  for (const z of [-2.62, 2.62]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(LEN, 0.08, 0.12), curb);
    c.position.set(MID, 0.04, z);
    c.receiveShadow = true;
    scene.add(c);
  }
  const wall = new THREE.Mesh(new THREE.BoxGeometry(LEN + 400, 1.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.9 }));
  wall.position.set(MID, -0.66, 9.5);
  scene.add(wall);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(LEN, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.4 }));
  rail.position.set(MID, 0.28, 9.3);
  scene.add(rail);

  // Street lamps on both sides of the road.
  const lampSpots: { x: number; z: number; dir: number }[] = [];
  for (let x = X0 + 4; x < X1; x += 9) {
    if (x > LANE.x0 - 1 && x < LANE.x1 + 1) continue;
    lampSpots.push({ x, z: -3.05, dir: 1 }, { x: x + 4.5, z: 3.05, dir: -1 });
  }
  const pole = new THREE.CylinderGeometry(0.045, 0.06, 2.4, 8).translate(0, 1.2, 0);
  const arm = new THREE.BoxGeometry(0.05, 0.05, 0.85).translate(0, 2.38, 0.4);
  const poleGeo = mergeGeometries([pole, arm])!;
  const headGeo = new THREE.BoxGeometry(0.16, 0.06, 0.36).translate(0, 2.34, 0.78);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.7, roughness: 0.45 }), lampSpots.length);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 0 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  const poolMat = new THREE.MeshBasicMaterial({ map: glow, color: 0xffc98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.2, 4.2).rotateX(-Math.PI / 2), poolMat, lampSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  lampSpots.forEach((l, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.dir > 0 ? 0 : Math.PI);
    m4.compose(new THREE.Vector3(l.x, 0, l.z), q, s1);
    poles.setMatrixAt(i, m4);
    heads.setMatrixAt(i, m4);
    pools.setMatrixAt(i, new THREE.Matrix4().makeTranslation(l.x, 0.06, l.z + l.dir * 0.8));
  });
  poles.castShadow = true;
  scene.add(poles, heads, pools);

  // Autumn trees: it is late October in Toronto.
  const trees: THREE.Vector3[] = [];
  for (let x = X0 + 8; x < X1; x += 9) if (x < LANE.x0 - 2 || x > LANE.x1 + 2) trees.push(new THREE.Vector3(x + r() * 1.5, 0, 5.4 + r() * 0.6));
  trees.push(...extraTrees);
  const trunkGeo = new THREE.CylinderGeometry(0.07, 0.1, 1.6, 6).translate(0, 0.8, 0);
  const blobs = [[0, 2.1, 0, 0.7], [0.55, 1.85, 0.2, 0.45], [-0.5, 1.9, -0.25, 0.45], [0.1, 2.65, -0.1, 0.45], [-0.25, 2.35, 0.5, 0.4], [0.4, 2.4, -0.5, 0.4], [-0.55, 2.45, 0.1, 0.38], [0.6, 2.25, 0.55, 0.35], [0.05, 1.7, 0.6, 0.38], [-0.1, 1.75, -0.6, 0.38]]
    .map(([x, y, z, s]) => new THREE.IcosahedronGeometry(s, 2).translate(x, y, z));
  const merged = mergeGeometries(blobs)!;
  merged.deleteAttribute('normal');
  merged.deleteAttribute('uv');
  const crownGeo = mergeVertices(merged);
  const pos = crownGeo.attributes.position as THREE.BufferAttribute;
  // Jitter the leaves so the crown reads as foliage rather than spheres.
  for (let i = 0; i < pos.count; i++) {
    const h = Math.sin(pos.getX(i) * 12.9898 + pos.getY(i) * 78.233 + pos.getZ(i) * 37.719) * 43758.5453;
    const j = 0.86 + (h - Math.floor(h)) * 0.28;
    pos.setXYZ(i, pos.getX(i) * j, 2.2 + (pos.getY(i) - 2.2) * j, pos.getZ(i) * j);
  }
  crownGeo.computeVertexNormals();
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x3b2c22, roughness: 1 }), trees.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), trees.length);
  const palette = ['#a8521f', '#c07f2a', '#8e3a1e', '#7d8433', '#4f6a2a', '#c4952e', '#9a4a24', '#5d6e30'].map((c) => new THREE.Color(c));
  trees.forEach((p, i) => {
    const sc = 0.85 + r() * 0.4;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
    m4.compose(p, q, new THREE.Vector3(sc, sc, sc));
    trunks.setMatrixAt(i, m4);
    crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, palette[Math.floor(r() * palette.length)]);
  });
  trunks.castShadow = crowns.castShadow = true;
  crowns.receiveShadow = true;
  scene.add(trunks, crowns);

  // Traffic.
  // One speed per lane, so cars keep their spacing instead of driving through each other.
  const lanes = [{ z: -2.1, dir: -1, v: 2.8 }, { z: -1.28, dir: -1, v: 3.5 }, { z: 1.28, dir: 1, v: 3.3 }, { z: 2.1, dir: 1, v: 2.7 }];
  const perLane = 20;
  const N = lanes.length * perLane;
  const bodyGeo = mergeGeometries([new THREE.BoxGeometry(1.12, 0.26, 0.47).translate(0, 0.2, 0), new THREE.BoxGeometry(0.2, 0.1, 0.45).translate(0.46, 0.36, 0)])!;
  const cabinGeo = new THREE.BoxGeometry(0.58, 0.2, 0.42).translate(-0.06, 0.43, 0);
  const headLGeo = mergeGeometries([new THREE.BoxGeometry(0.02, 0.05, 0.1).translate(0.565, 0.24, 0.15), new THREE.BoxGeometry(0.02, 0.05, 0.1).translate(0.565, 0.24, -0.15)])!;
  const tailLGeo = mergeGeometries([new THREE.BoxGeometry(0.02, 0.05, 0.12).translate(-0.565, 0.26, 0.15), new THREE.BoxGeometry(0.02, 0.05, 0.12).translate(-0.565, 0.26, -0.15)])!;
  const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6 }), N);
  const cabins = new THREE.InstancedMesh(cabinGeo, new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.08, metalness: 0.9 }), N);
  const headMatC = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1) });
  const tailMatC = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.02, 0.02) });
  const headsC = new THREE.InstancedMesh(headLGeo, headMatC, N);
  const tails = new THREE.InstancedMesh(tailLGeo, tailMatC, N);
  const carColors = ['#e8e8e8', '#1b1c1f', '#7d8086', '#9aa1a8', '#2a3a5a', '#7a1d1d', '#e5e5df', '#3b3f45', '#0f2d4a'].map((c) => new THREE.Color(c));
  const cars = Array.from({ length: N }, (_, i) => {
    const ln = lanes[Math.floor(i / perLane)];
    bodies.setColorAt(i, carColors[Math.floor(r() * carColors.length)]);
    return { lane: ln, x: X0 + ((i % perLane) + r() * 0.6) * (LEN / perLane), v: ln.v * ln.dir };
  });
  bodies.castShadow = true;
  scene.add(bodies, cabins, headsC, tails);

  // Two streetcars on the central right-of-way.
  const sc = makeStreetcar();
  const scMat = new THREE.MeshStandardMaterial({ map: sc.map, emissiveMap: sc.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4, metalness: 0.2 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.5 });
  const streetcars = [-1, 1].map((dir, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.82, 0.66), [capMat, capMat, capMat, capMat, scMat, scMat]);
    body.position.y = 0.5;
    body.castShadow = true;
    const panto = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.04), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    panto.position.set(0.8, 1.05, 0);
    g.add(body, panto);
    g.position.set(X0 + (i ? 300 : 120), 0, dir * 0.44);
    scene.add(g);
    return { g, dir };
  });
  const wire = new THREE.Mesh(new THREE.BoxGeometry(LEN, 0.015, 0.015), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  wire.position.set(MID, 1.18, 0);
  scene.add(wire);

  const dummy = new THREE.Object3D();
  return {
    update(dt: number, night: number) {
      headMat.emissiveIntensity = night * 6;
      poolMat.opacity = night * 0.55;
      headMatC.color.setScalar(0.6 + night * 4);
      tailMatC.color.setRGB(0.5 + night * 3, 0.02, 0.02);
      scMat.emissiveIntensity = 0.1 + night * 1.6;
      cars.forEach((c, i) => {
        c.x += c.v * dt;
        if (c.x > X1) c.x = X0;
        if (c.x < X0) c.x = X1;
        dummy.position.set(c.x, 0.02, c.lane.z);
        dummy.rotation.y = c.lane.dir > 0 ? 0 : Math.PI;
        dummy.updateMatrix();
        bodies.setMatrixAt(i, dummy.matrix);
        cabins.setMatrixAt(i, dummy.matrix);
        headsC.setMatrixAt(i, dummy.matrix);
        tails.setMatrixAt(i, dummy.matrix);
      });
      for (const m of [bodies, cabins, headsC, tails]) m.instanceMatrix.needsUpdate = true;
      for (const s of streetcars) {
        s.g.position.x += s.dir * 2.2 * dt;
        if (s.g.position.x > X1) s.g.position.x = X0;
        if (s.g.position.x < X0) s.g.position.x = X1;
      }
    },
  };
}
