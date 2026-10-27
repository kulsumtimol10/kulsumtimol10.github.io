import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { clamp, lerp, smooth } from './util';
import { makeClouds } from './clouds';

// Light and atmosphere keyed by hour of day. Colors were tuned against the Sky shader so the fog
// horizon blends into the sky instead of leaving a visible band.
const KEYS = [
  { h: 5.0, fog: '#141a33', hs: '#2c3a66', hg: '#141418', hi: 0.25, sun: '#ff9a5a', exp: 0.85 },
  { h: 6.6, fog: '#d9ad94', hs: '#ffcfaa', hg: '#4a4048', hi: 0.55, sun: '#ffa060', exp: 0.4 },
  { h: 8.5, fog: '#c3cfdc', hs: '#cfe2ff', hg: '#5a5650', hi: 0.75, sun: '#fff0d8', exp: 0.34 },
  { h: 12.0, fog: '#b9cadb', hs: '#d6e6ff', hg: '#5e5a54', hi: 0.8, sun: '#ffffff', exp: 0.32 },
  { h: 15.5, fog: '#c2cbd4', hs: '#d2e0f4', hg: '#5e5850', hi: 0.75, sun: '#fff1da', exp: 0.34 },
  { h: 17.6, fog: '#d9bd9c', hs: '#ffe1bd', hg: '#5a4c40', hi: 0.65, sun: '#ffc583', exp: 0.38 },
  { h: 18.9, fog: '#c9876a', hs: '#ffb48a', hg: '#4a3a36', hi: 0.55, sun: '#ff8d4f', exp: 0.44 },
  { h: 19.8, fog: '#4b4466', hs: '#7a6fa4', hg: '#2a2630', hi: 0.45, sun: '#ff6a3a', exp: 0.6 },
  { h: 20.7, fog: '#1d2546', hs: '#3a4a86', hg: '#18181e', hi: 0.3, sun: '#ff6a3a', exp: 0.8 },
  { h: 23.5, fog: '#0b1022', hs: '#26335f', hg: '#101016', hi: 0.22, sun: '#ff6a3a', exp: 0.95 },
].map((k) => ({ ...k, fogC: new THREE.Color(k.fog), hsC: new THREE.Color(k.hs), hgC: new THREE.Color(k.hg), sunC: new THREE.Color(k.sun) }));

function sample(hour: number) {
  let i = 1;
  while (i < KEYS.length - 1 && hour > KEYS[i].h) i++;
  const a = KEYS[i - 1], b = KEYS[i];
  const t = clamp((hour - a.h) / (b.h - a.h));
  return {
    fog: a.fogC.clone().lerp(b.fogC, t),
    hs: a.hsC.clone().lerp(b.hsC, t),
    hg: a.hgC.clone().lerp(b.hgC, t),
    sun: a.sunC.clone().lerp(b.sunC, t),
    hi: lerp(a.hi, b.hi, t),
    exp: lerp(a.exp, b.exp, t),
  };
}

/** Sun rises in the east (+x), crosses the south (+z, behind the camera) and sets in the west. */
export function sunDirection(hour: number, out: THREE.Vector3) {
  const rise = 6.3, set = 19.7;
  const t = (hour - rise) / (set - rise);
  const el = t >= 0 && t <= 1 ? Math.sin(Math.PI * t) * 46 : -Math.min(28, (t < 0 ? -t : t - 1) * 140);
  const az = 90 + 180 * clamp(t, -0.12, 1.12);
  const e = THREE.MathUtils.degToRad(el), a = THREE.MathUtils.degToRad(az);
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
// Haze band: fades the sky into the fog colour at the horizon, so distant lake and ground (which the
// fog turns that same colour) meet the sky without a visible edge.
const HAZE_FRAG = /* glsl */ `
uniform vec3 color; uniform float strength;
varying vec3 vDir;
void main() {
  float a = 1.0 - smoothstep(-0.02, 0.2, vDir.y);
  gl_FragColor = vec4(color, a * strength);
}`;

const DOME_FRAG = /* glsl */ `
uniform vec3 zenith; uniform vec3 horizon; uniform vec3 glow; uniform float opacity;
varying vec3 vDir;
void main() {
  float y = max(vDir.y, 0.0);
  vec3 c = mix(horizon, zenith, pow(y, 0.5));
  c += glow * exp(-y * 16.0);
  gl_FragColor = vec4(c, opacity);
}`;

export class Environment {
  sky = new Sky();
  envSky = new Sky();
  dome: THREE.Mesh;
  envDome: THREE.Mesh;
  haze: THREE.Mesh;
  stars: THREE.Points;
  clouds = makeClouds();
  moon: THREE.Mesh;
  moonGlow: THREE.Sprite;
  sun = new THREE.DirectionalLight(0xffffff, 3);
  moonLight = new THREE.DirectionalLight(0x9fb4ff, 0);
  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  water?: Water;
  lake?: THREE.Mesh;
  sunDir = new THREE.Vector3();
  night = 0;
  dusk = 0;
  private envScene = new THREE.Scene();
  private pmrem: THREE.PMREMGenerator;
  private baked: { h: number; tex: THREE.Texture }[] = [];
  private moonDir = new THREE.Vector3(-0.42, 0.3, -0.86).normalize();

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, high: boolean, glow: THREE.Texture, waterNormals: THREE.Texture) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    for (const s of [this.sky, this.envSky]) s.scale.setScalar(1000);
    this.envSky.material = this.sky.material;
    const u = this.sky.material.uniforms;
    u.turbidity.value = 6;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.82;
    scene.add(this.sky);
    this.envScene.add(this.envSky);

    const domeMat = new THREE.ShaderMaterial({
      vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
      uniforms: { zenith: { value: new THREE.Color('#03050d') }, horizon: { value: new THREE.Color('#1a2348') }, glow: { value: new THREE.Color('#3a2a3a') }, opacity: { value: 0 } },
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(3500, 32, 16), domeMat);
    this.dome.renderOrder = -2;
    this.envDome = new THREE.Mesh(this.dome.geometry, domeMat);
    scene.add(this.dome);
    this.envScene.add(this.envDome);
    const hazeMat = new THREE.ShaderMaterial({
      vertexShader: DOME_VERT, fragmentShader: HAZE_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
      uniforms: { color: { value: new THREE.Color() }, strength: { value: 0.9 } },
    });
    this.haze = new THREE.Mesh(this.dome.geometry, hazeMat);
    this.haze.renderOrder = -1.5;
    scene.add(this.haze);

    const sp: number[] = [];
    for (let i = 0; i < 1800; i++) {
      const th = Math.random() * Math.PI * 2, y = Math.pow(Math.random(), 0.7);
      const r = Math.sqrt(1 - y * y);
      sp.push(Math.cos(th) * r * 3000, y * 3000 + 40, Math.sin(th) * r * 3000);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.renderOrder = -1;
    scene.add(this.stars);
    this.clouds.renderOrder = -0.5;
    scene.add(this.clouds);
    this.envScene.add(new THREE.Mesh(this.clouds.geometry, this.clouds.material));

    this.moon = new THREE.Mesh(new THREE.SphereGeometry(26, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 1.12, 1.02), fog: false, transparent: true }));
    this.moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xb9c8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.moonGlow.scale.setScalar(520);
    scene.add(this.moon, this.moonGlow);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(high ? 2048 : 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -120;
    sc.right = sc.top = 120;
    sc.near = 1;
    sc.far = 1000;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.06;
    scene.add(this.sun, this.sun.target, this.moonLight, this.moonLight.target, this.hemi);

    // Lake Ontario. The high-quality path renders true planar reflections of the skyline.
    // Big enough that its far edges sit deep inside the fog in every direction the camera can face.
    const lakeGeo = new THREE.PlaneGeometry(9000, 4000);
    if (high) {
      this.water = new Water(lakeGeo, {
        textureWidth: 768, textureHeight: 768, waterNormals, sunDirection: new THREE.Vector3(), sunColor: 0xffffff,
        waterColor: 0x0a3346, distortionScale: 0.55, fog: true,
      });
      this.water.material.uniforms.size.value = 10;
      this.water.rotation.x = -Math.PI / 2;
      this.water.position.set(100, -0.2, 9.4 + 2000);
      scene.add(this.water);
    } else {
      this.lake = new THREE.Mesh(lakeGeo, new THREE.MeshStandardMaterial({ color: 0x0b2d3d, roughness: 0.06, metalness: 0.7, normalMap: waterNormals, normalScale: new THREE.Vector2(0.25, 0.25) }));
      (this.lake.material as THREE.MeshStandardMaterial).normalMap!.repeat.set(60, 30);
      this.lake.rotation.x = -Math.PI / 2;
      this.lake.position.set(100, -0.2, 9.4 + 2000);
      scene.add(this.lake);
    }

    scene.fog = new THREE.FogExp2(0xc8d4e0, 0.0016);
  }

  /** Sets every hour-dependent uniform and light colour (but nothing that follows the camera). */
  private applyHour(hour: number) {
    sunDirection(hour, this.sunDir);
    const s = sample(hour);
    this.night = smooth(19.4, 20.9, hour) + (1 - smooth(5.2, 6.4, hour));
    this.dusk = smooth(17.4, 19.2, hour) * (1 - smooth(20.2, 21.2, hour));
    const n = this.night;

    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir);
    const dawn = 1 - smooth(6.7, 8.6, hour);
    u.rayleigh.value = lerp(1.6, 3.2, Math.max(this.dusk, dawn));
    u.turbidity.value = lerp(6, 9.5, Math.max(this.dusk, dawn));
    (this.dome.material as THREE.ShaderMaterial).uniforms.opacity.value = smooth(19.0, 20.6, hour) + (1 - smooth(5.6, 6.5, hour));

    const up = clamp(this.sunDir.y * 6);
    const cu = (this.clouds.material as THREE.ShaderMaterial).uniforms;
    cu.sunDir.value.copy(this.sunDir);
    cu.lit.value.copy(s.sun).multiplyScalar((0.5 + 2.4 * up) * (1 - n)).add(new THREE.Color(0.09, 0.06, 0.07).multiplyScalar(n));
    cu.shade.value.copy(s.hs).multiplyScalar(lerp(1.1, 0.06, n)).lerp(new THREE.Color(0.35, 0.3, 0.38), this.dusk * 0.4);
    cu.cover.value = lerp(0.4, 0.5, this.dusk) - n * 0.06;
    cu.opacity.value = lerp(0.92, 0.7, n);
    return { s, up, n };
  }

  /**
   * Pre-renders glass reflections for each hour the tour passes through, during loading, so no
   * environment map is ever computed mid-scroll (that used to cause a hitch every few frames).
   */
  async bake(hours: number[]) {
    const list = [...new Set(hours.map((h) => Math.round(h * 4) / 4))].sort((a, b) => a - b);
    for (const h of list) {
      this.applyHour(h);
      this.baked.push({ h, tex: this.pmrem.fromScene(this.envScene, 0, 0.1, 5000).texture });
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  update(hour: number, camera: THREE.Camera, focus: THREE.Vector3, dt: number) {
    const { s, up, n } = this.applyHour(hour);
    this.dome.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    (this.stars.material as THREE.PointsMaterial).opacity = Math.pow(n, 1.5);

    this.moon.position.copy(camera.position).addScaledVector(this.moonDir, 2900);
    this.moonGlow.position.copy(this.moon.position);
    (this.moon.material as THREE.MeshBasicMaterial).opacity = smooth(0.2, 0.8, n);
    this.moonGlow.material.opacity = 0.16 * n;

    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(s.fog);
    fog.density = lerp(0.0014, 0.0019, n);
    this.haze.position.copy(camera.position);
    const hu = (this.haze.material as THREE.ShaderMaterial).uniforms;
    hu.color.value.copy(s.fog);
    hu.strength.value = 1;
    this.hemi.color.copy(s.hs);
    this.hemi.groundColor.copy(s.hg);
    this.hemi.intensity = s.hi;
    this.renderer.toneMappingExposure = s.exp;

    (this.clouds.material as THREE.ShaderMaterial).uniforms.time.value += dt;
    this.clouds.position.copy(camera.position);

    this.sun.color.copy(s.sun);
    this.sun.intensity = 4.4 * up;
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 500);
    this.sun.target.position.copy(focus);
    this.moonLight.intensity = 0.5 * n;
    this.moonLight.position.copy(focus).addScaledVector(this.moonDir, 500);
    this.moonLight.target.position.copy(focus);
    this.scene.environmentIntensity = lerp(0.8, 0.25, n);

    if (this.water) {
      const wu = this.water.material.uniforms;
      wu.time.value += dt * 0.6;
      wu.sunDirection.value.copy(n > 0.5 ? this.moonDir : this.sunDir);
      wu.sunColor.value.set(n > 0.5 ? 0x8899cc : 0xffffff).multiplyScalar(n > 0.5 ? 0.5 : up);
      wu.waterColor.value.set(0x0a3346).lerp(new THREE.Color(0x030a12), n);
    }

    // Swap to the nearest pre-baked reflection map; swapping is free, baking is not.
    let best = this.baked[0];
    for (const b of this.baked) if (Math.abs(b.h - hour) < Math.abs(best.h - hour)) best = b;
    if (best && this.scene.environment !== best.tex) this.scene.environment = best.tex;
  }
}
