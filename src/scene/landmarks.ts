import * as THREE from 'three';
import { CN, DOME, type CityMaterials } from './city';

/** CN Tower (1 unit = 4 m, so 553 m = 138 units) and the Rogers Centre dome beside it. */
export function buildLandmarks(scene: THREE.Scene, mats: CityMaterials) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0xcfccc4, roughness: 0.82, emissive: 0x8a5cff, emissiveIntensity: 0 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1b222b, roughness: 0.1, metalness: 0.9, emissive: 0xffd7a0, emissiveIntensity: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.4, metalness: 0.8 });
  const tower = new THREE.Group();
  tower.position.set(CN.x, 0, CN.z);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.5, 82, 6), concrete);
  core.position.y = 41;
  tower.add(core);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.BoxGeometry(1, 80, 1.5, 1, 20, 1).translate(0.5, 40, 0);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) / 80;
      p.setX(k, p.getX(k) * THREE.MathUtils.lerp(8.8, 1.6, Math.pow(y, 0.62)));
    }
    g.computeVertexNormals();
    g.rotateY((i * Math.PI * 2) / 3 + Math.PI / 6);
    tower.add(new THREE.Mesh(g, concrete));
  }
  const prof = [[1.9, 79], [4.6, 80.4], [6.5, 81.9], [7.0, 83.2], [7.0, 83.4], [6.6, 85.4], [6.7, 86.1], [7.4, 86.8], [7.4, 88], [6.1, 89.2], [3.3, 90.5], [1.7, 91]].map(([x, y]) => new THREE.Vector2(x, y));
  tower.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 64), concrete));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(6.82, 6.95, 2.0, 64, 1, true), glass);
  band.position.y = 84.4;
  tower.add(band);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.55, 21, 6), concrete);
  upper.position.y = 101.5;
  tower.add(upper);
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 2.4, 32), concrete);
  sky.position.y = 112.6;
  const skyBand = new THREE.Mesh(new THREE.CylinderGeometry(2.24, 2.24, 0.9, 32, 1, true), glass);
  skyBand.position.y = 112.7;
  const abase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 4, 8), steel);
  abase.position.y = 115.8;
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.8, 20, 8), steel);
  antenna.position.y = 127.8;
  tower.add(sky, skyBand, abase, antenna);
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.2) });
  const beacons = [138.2, 126, 112, 92].map((y) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(y > 130 ? 0.35 : 0.25, 8, 6), beaconMat);
    b.position.set(y > 130 ? 0 : 2.3, y, 0);
    tower.add(b);
    return b;
  });
  tower.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(tower);

  // Rogers Centre.
  const wallMat = mats.facades[3].clone();
  for (const k of ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap'] as const) {
    const t = (wallMat[k] as THREE.Texture).clone();
    t.repeat.set(26, 1.3);
    wallMat[k] = t;
  }
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(DOME.r, DOME.r, 10, 72, 1, true), wallMat);
  wall.position.set(DOME.x, 5, DOME.z);
  const seams = document.createElement('canvas');
  seams.width = seams.height = 512;
  const sx = seams.getContext('2d')!;
  sx.fillStyle = '#b8bdc4';
  sx.fillRect(0, 0, 512, 512);
  sx.strokeStyle = '#6d727a';
  sx.lineWidth = 3;
  for (let i = 0; i < 512; i += 32) { sx.beginPath(); sx.moveTo(i, 0); sx.lineTo(i, 512); sx.stroke(); }
  for (let i = 0; i < 512; i += 128) { sx.beginPath(); sx.moveTo(0, i); sx.lineTo(512, i); sx.stroke(); }
  const st = new THREE.CanvasTexture(seams);
  st.colorSpace = THREE.SRGBColorSpace;
  st.wrapS = st.wrapT = THREE.RepeatWrapping;
  st.repeat.set(4, 1);
  const R = 36.5, th = 0.718;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 24, 0, Math.PI * 2, 0, th), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, metalness: 0.55 }));
  dome.position.set(DOME.x, 10 - R * Math.cos(th), DOME.z);
  const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1) });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(DOME.r + 0.05, 0.12, 6, 96), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(DOME.x, 10, DOME.z);
  for (const m of [wall, dome]) { m.castShadow = m.receiveShadow = true; }
  scene.add(wall, dome, rim);

  return {
    tower,
    labels: [{ pos: new THREE.Vector3(CN.x, 96, CN.z), title: 'CN Tower', sub: '553 m · since 1976' }],
    update(night: number, t: number) {
      concrete.emissive.setHSL((0.72 + Math.sin(t * 0.15) * 0.08) % 1, 0.65, 0.5);
      concrete.emissiveIntensity = night * 0.13;
      glass.emissiveIntensity = night * 2.2;
      wallMat.emissiveIntensity = night * 1.6;
      rimMat.color.setScalar(0.3 + night * 3);
      const on = night > 0.2 && Math.sin(t * 3) > 0;
      beacons.forEach((b) => (b.visible = on));
    },
  };
}
