import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { stops } from '../content';
import { Environment } from './environment';
import { buildCity, buildFeatured, makeMaterials, updateFeatured, FEATURED_X, type Featured } from './city';
import { buildStreet } from './street';
import { buildLandmarks } from './landmarks';
import { buildLane, laneTreeSpots, BOARDS, SCREEN, wallX } from './lane';
import { makeGlow, makeWaterNormals } from './textures';
import { Rig, type Key } from './rig';
import { clamp, lerp, nextFrame, smooth } from './util';

type Label = { el: HTMLDivElement; pos: THREE.Vector3; key?: number };
type Pickable = { obj: THREE.Object3D; stop: string; name: string; label?: Label };

export type SceneEvents = {
  onLoad: (p: number) => void;
  onStop: (id: string | null) => void;
  onHour: (hour: number) => void;
  onInteract: () => void;
  onPick: (id: string) => void;
};

const UP = new THREE.Vector3(0, 1, 0);
const deg = THREE.MathUtils.degToRad;

function buildKeys(): Key[] {
  const X = FEATURED_X;
  const keys: Key[] = [
    { stop: 'hello', pos: [-78, 22, 118], look: [60, 30, -40], hour: 6.9 },
    // Each landmark is framed right of centre, clear of the chapter card on the left.
    { stop: 'trueline', pos: [X.trueline - 8, 9, 44], look: [X.trueline - 20, 12, -16], hour: 9, offset: 19 },
    { stop: 'seneca', pos: [X.seneca - 6, 7, 38], look: [X.seneca - 18, 9, -16], hour: 11.5, offset: 19 },
    { stop: 'needlist', pos: [X.needlist - 10, 16, 74], look: [X.needlist - 26, 30, -17], hour: 14, offset: 17 },
    { stop: 'securevault', pos: [X.securevault - 8, 12, 56], look: [X.securevault - 22, 20, -16], hour: 16.6, offset: 19 },
    { stop: 'lane', pos: [X.lane, 3.6, 14], look: [X.lane, 6.4, -30], hour: 18.2 },
  ];
  const hours = [18.7, 19.15, 19.6, 20.05, 20.5];
  BOARDS.forEach((b, i) => {
    const cam = new THREE.Vector3(b.side > 0 ? 177.4 : 182.6, 3.1, b.z + 8.2);
    const screen = new THREE.Vector3(wallX(b.side) - b.side * 0.3, SCREEN.y, b.z + 0.4);
    // Turn the view a little away from the screen so it sits right of centre.
    const dir = screen.sub(cam).applyAxisAngle(UP, deg(b.side > 0 ? 12 : -12));
    keys.push({ stop: b.id, pos: cam.toArray(), look: cam.clone().add(dir).toArray(), hour: hours[i], offset: 12 });
  });
  keys.push(
    { pos: [180, 62, -98], look: [180, 40, 0], hour: 21.2 },
    { pos: [205, 52, 60], look: [262, 32, 140], hour: 21.8 },
    { pos: [236, 30, 150], look: [330, 32, 140], hour: 22.4 },
    { stop: 'contact', pos: [165, 22, 210], look: [165, 40, -40], hour: 23 },
  );
  return keys;
}

/** Orbit limits for the opening shot, as absolute angles around the pivot (kept over the lake). */
const ORBIT = { azMin: deg(-66), azMax: deg(66), elMin: deg(-3), elMax: deg(52) };

export class CityScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(48, 1, 0.5, 6000);
  rig = new Rig(buildKeys());
  high: boolean;
  poster = '';
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private env!: Environment;
  private updaters: ((dt: number, night: number, t: number) => void)[] = [];
  private featured: Featured[] = [];
  private labels: Label[] = [];
  private picks: Pickable[] = [];
  private target = 0;
  private cur = 0;
  private vel = 0;
  private lastStop: string | null | undefined;
  private lastHour = -1;
  private clock = new THREE.Clock();
  private pos = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private focus = new THREE.Vector3();
  private size = { w: 1, h: 1 };
  private paused = false;
  private disposed = false;

  // Interaction: orbit around the skyline at the start, free look elsewhere, click a building to visit it.
  private pivot = new THREE.Vector3(...this.rig.keys[0].look);
  private orbitBase = { az: 0, el: 0, r: 1 };
  private orbit = { az: 0, el: 0, vAz: 0, vEl: 0 };
  private free = { yaw: 0, pitch: 0, vYaw: 0, vPitch: 0 };
  private drag = { on: false, id: -1, x: 0, y: 0, sx: 0, sy: 0, t: 0, mode: 'orbit' as 'orbit' | 'look', lastT: 0 };
  private interacted = false;
  private u = 0;
  private pointer = new THREE.Vector2();
  private parallax = new THREE.Vector2();
  private hoverDirty = false;
  private hovered: Pickable | null = null;
  private ray = new THREE.Raycaster();
  private tip: HTMLDivElement;
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Adaptive resolution keeps the frame rate up on slower GPUs.
  private perf = { acc: 0, n: 0, since: 0, scale: 1, max: 1 };

  constructor(private host: HTMLElement, private labelLayer: HTMLElement, private events: SceneEvents) {
    const q = new URLSearchParams(location.search).get('quality');
    this.high = q ? q !== 'low' : !(innerWidth < 820 || (navigator.hardwareConcurrency ?? 8) <= 4);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.perf.max = Math.min(devicePixelRatio, this.high ? 1.5 : 1.15);
    this.perf.scale = this.perf.max;
    this.renderer.setPixelRatio(this.perf.scale);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.tip = document.createElement('div');
    this.tip.className = 'ptip';
    labelLayer.appendChild(this.tip);

    const off = new THREE.Vector3(...this.rig.keys[0].pos).sub(this.pivot);
    this.orbitBase = { r: off.length(), az: Math.atan2(off.x, off.z), el: Math.asin(off.y / off.length()) };

    const c = this.renderer.domElement;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('pointerleave', () => { this.hovered = null; this.hoverDirty = true; });
    addEventListener('resize', this.resize);
  }

  async init() {
    const step = (() => { let n = 0; const total = 15; return () => this.events.onLoad(Math.min(0.99, ++n / total)); })();
    await Promise.race([
      Promise.all(['700 92px "Space Grotesk"', '500 36px "JetBrains Mono"', '400 40px Inter'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
    step();
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const mats = await makeMaterials(this.high ? 1024 : 512, aniso, step);
    const glow = makeGlow();
    this.env = new Environment(this.scene, this.renderer, this.high, glow, makeWaterNormals());
    await this.env.bake([...this.rig.keys.map((k) => k.hour), ...Array.from({ length: 23 }, (_, i) => 6.5 + i * 0.75)]);
    step();
    await nextFrame();

    const city = buildCity(this.scene, mats, this.high ? 1 : 0.8);
    const keyIndex = (id: string) => this.rig.keys.findIndex((k) => k.stop === id);
    this.featured = buildFeatured(this.scene, mats, { trueline: keyIndex('trueline'), seneca: keyIndex('seneca'), needlist: keyIndex('needlist'), securevault: keyIndex('securevault') });
    step();
    await nextFrame();
    const street = buildStreet(this.scene, aniso, glow, laneTreeSpots());
    const marks = buildLandmarks(this.scene, mats);
    const lane = buildLane(this.scene, stops, aniso, glow);
    step();
    this.updaters.push(
      (_dt, n, t) => city.update(n, t),
      (dt, n) => street.update(dt, n),
      (_dt, n, t) => marks.update(n, t),
      (_dt, n, t) => lane.update(n, t),
    );

    for (const f of this.featured) {
      const label = this.addLabel(f.label.pos, f.label.title, f.label.sub, f.key);
      this.picks.push({ obj: f.group, stop: f.id, name: f.label.title, label });
    }
    for (const l of marks.labels) {
      const label = this.addLabel(l.pos, l.title, l.sub);
      this.picks.push({ obj: marks.tower, stop: 'contact', name: l.title, label });
    }
    this.picks.push({ obj: lane.arch, stop: 'lane', name: 'Projects Lane' });
    for (const s of lane.screens) this.picks.push({ obj: s.mesh, stop: s.id, name: stops.find((st) => st.id === s.id)!.title });

    this.setupPost();
    this.resize();
    this.capturePoster();
    this.frame(0);
    await this.renderer.compileAsync(this.scene, this.camera);
    if (this.disposed) return;
    step();
    this.events.onLoad(1);
    if (import.meta.env.DEV) (window as unknown as { __city: CityScene }).__city = this;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.loop());
  }

  private setupPost() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.high ? 4 : 2 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.3, 0.55, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  /** Renders the night skyline once, hidden behind the loader, for the recruiter view's header. */
  private capturePoster() {
    const saved = this.target;
    this.target = this.cur = this.rig.progressOf(this.rig.keys.length - 1);
    this.frame(0);
    this.frame(0);
    try {
      this.poster = this.renderer.domElement.toDataURL('image/jpeg', 0.82);
    } catch {
      this.poster = '';
    }
    this.target = this.cur = saved;
    this.vel = 0;
  }

  private addLabel(pos: THREE.Vector3, title: string, sub: string, key?: number) {
    const el = document.createElement('div');
    el.className = 'blabel';
    el.innerHTML = `<b></b><span></span>`;
    el.querySelector('b')!.textContent = title;
    el.querySelector('span')!.textContent = sub;
    this.labelLayer.appendChild(el);
    const label = { el, pos, key };
    this.labels.push(label);
    return label;
  }

  setScroll(p: number) {
    this.target = p;
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!p) this.clock.getDelta();
  }

  progressOfStop(id: string) {
    const i = this.rig.keys.findIndex((k) => k.stop === id);
    return i < 0 ? 0 : this.rig.progressOf(i);
  }

  // ---------- pointer interaction ----------

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const d = this.drag;
    d.on = true;
    d.id = e.pointerId;
    d.x = d.sx = e.clientX;
    d.y = d.sy = e.clientY;
    d.t = d.lastT = performance.now();
    d.mode = this.u < 0.45 ? 'orbit' : 'look';
    if (!this.interacted) {
      // Fold the idle sway into the orbit first, so grabbing the view never makes it jump.
      this.orbit.az += this.sway(this.clock.elapsedTime);
      this.interacted = true;
      this.events.onInteract();
    }
    this.orbit.vAz = this.orbit.vEl = this.free.vYaw = this.free.vPitch = 0;
    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointers cannot be captured; dragging still works without it.
    }
    this.host.classList.add('dragging');
  };

  private onMove = (e: PointerEvent) => {
    this.pointer.set((e.clientX / this.size.w) * 2 - 1, -(e.clientY / this.size.h) * 2 + 1);
    this.hoverDirty = true;
    const d = this.drag;
    if (!d.on || e.pointerId !== d.id) return;
    const now = performance.now();
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    const dt = Math.max(0.008, (now - d.lastT) / 1000);
    d.x = e.clientX;
    d.y = e.clientY;
    d.lastT = now;
    const k = Math.PI / this.size.h;
    if (d.mode === 'orbit') {
      this.orbit.az -= dx * k * 1.1;
      this.orbit.el += dy * k * 0.8;
      this.orbit.vAz = (-dx * k * 1.1) / dt;
      this.orbit.vEl = (dy * k * 0.8) / dt;
    } else {
      this.free.yaw += dx * k * 0.6;
      this.free.pitch += dy * k * 0.45;
      this.free.vYaw = (dx * k * 0.6) / dt;
      this.free.vPitch = (dy * k * 0.45) / dt;
    }
    this.clampOffsets();
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d.on || e.pointerId !== d.id) return;
    d.on = false;
    this.host.classList.remove('dragging');
    // Drop inertia if the pointer paused before release.
    if (performance.now() - d.lastT > 80) this.orbit.vAz = this.orbit.vEl = this.free.vYaw = this.free.vPitch = 0;
    const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    if (e.type === 'pointerup' && moved < 6 && performance.now() - d.t < 450) {
      this.pointer.set((e.clientX / this.size.w) * 2 - 1, -(e.clientY / this.size.h) * 2 + 1);
      const hit = this.pick();
      if (hit) this.events.onPick(hit.stop);
    }
  };

  private sway(t: number) {
    return this.interacted || this.reduceMotion ? 0 : Math.sin(t * 0.18) * deg(9);
  }

  private clampOffsets() {
    const b = this.orbitBase, o = this.orbit, f = this.free;
    o.az = clamp(o.az, ORBIT.azMin - b.az, ORBIT.azMax - b.az);
    o.el = clamp(o.el, ORBIT.elMin - b.el, ORBIT.elMax - b.el);
    f.yaw = clamp(f.yaw, deg(-40), deg(40));
    f.pitch = clamp(f.pitch, deg(-18), deg(22));
  }

  private pick() {
    this.ray.setFromCamera(this.pointer, this.camera);
    let best: Pickable | null = null, bestD = Infinity;
    for (const p of this.picks) {
      const hit = this.ray.intersectObject(p.obj, true)[0];
      if (hit && hit.distance < bestD) { bestD = hit.distance; best = p; }
    }
    return best;
  }

  private qa = new THREE.Quaternion();
  private qe = new THREE.Quaternion();
  private axis = new THREE.Vector3();
  private off = new THREE.Vector3();
  /** Swings the opening shot around the skyline. Fades out as the tour starts. */
  private applyOrbit(u: number, dt: number, t: number) {
    const o = this.orbit;
    if (!this.drag.on || this.drag.mode !== 'orbit') {
      o.az += o.vAz * dt;
      o.el += o.vEl * dt;
      const damp = Math.exp(-dt * 4.5);
      o.vAz *= damp;
      o.vEl *= damp;
      this.clampOffsets();
    }
    // Once the visitor has moved on, quietly reset so returning to the start shows the hero shot.
    if (u > 0.95 && !this.drag.on) {
      const k = Math.exp(-dt * 1.5);
      o.az *= k;
      o.el *= k;
    }
    const w = 1 - smooth(0.05, 0.7, u);
    const az = (o.az + this.sway(t)) * w, el = o.el * w;
    if (Math.abs(az) < 1e-5 && Math.abs(el) < 1e-5) return;
    this.off.copy(this.camera.position).sub(this.pivot);
    this.axis.crossVectors(this.off, UP).normalize();
    this.qe.setFromAxisAngle(this.axis, el);
    this.qa.setFromAxisAngle(UP, az);
    this.qa.multiply(this.qe);
    this.off.applyQuaternion(this.qa);
    this.camera.position.copy(this.pivot).add(this.off);
    this.camera.quaternion.premultiply(this.qa);
  }

  /** Drag to look around at any other stop; springs back as soon as the visitor scrolls on. */
  private applyFreeLook(dt: number) {
    const f = this.free;
    if (!this.drag.on || this.drag.mode !== 'look') {
      f.yaw += f.vYaw * dt;
      f.pitch += f.vPitch * dt;
      const damp = Math.exp(-dt * 5);
      f.vYaw *= damp;
      f.vPitch *= damp;
      this.clampOffsets();
      if (Math.abs(this.vel) > 0.0004) {
        const k = Math.exp(-dt * 3);
        f.yaw *= k;
        f.pitch *= k;
      }
    }
    if (f.yaw || f.pitch) {
      this.camera.rotateOnWorldAxis(UP, f.yaw);
      this.camera.rotateX(f.pitch);
    }
  }

  // ---------- frame loop ----------

  private resize = () => {
    const w = this.host.clientWidth || innerWidth, h = this.host.clientHeight || innerHeight;
    this.size = { w, h };
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 62 : 48;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
  };

  private loop() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.paused) return;
    this.adapt(dt);
    this.frame(dt);
  }

  private adapt(dt: number) {
    const p = this.perf;
    if (dt > 0.25) return;
    p.acc += dt;
    p.n++;
    p.since += dt;
    if (p.n < 60) return;
    const avg = p.acc / p.n;
    p.acc = 0;
    p.n = 0;
    let next = p.scale;
    if (avg > 1 / 40) next = Math.max(0.6, p.scale - 0.15);
    else if (avg < 1 / 57 && p.since > 6) next = Math.min(p.max, p.scale + 0.1);
    if (next !== p.scale) {
      p.scale = next;
      p.since = 0;
      this.renderer.setPixelRatio(next);
      this.resize();
    }
  }

  private frame(dt: number) {
    const t = this.clock.elapsedTime;
    // Critically damped spring: wheel notches blend into one continuous glide.
    if (dt === 0) {
      this.cur = this.target;
      this.vel = 0;
    } else {
      const w = 4.2;
      let rem = dt;
      while (rem > 1e-6) {
        const h = Math.min(rem, 1 / 120);
        this.vel += (w * w * (this.target - this.cur) - 2 * w * this.vel) * h;
        this.cur += this.vel * h;
        rem -= h;
      }
    }
    const { u, hour, offset } = this.rig.sample(this.cur, this.pos, this.quat);
    this.u = u;
    this.camera.position.copy(this.pos);
    this.camera.quaternion.copy(this.quat);
    this.applyOrbit(u, dt, t);
    // On portrait screens the card sits below the scene, so swing the subject back to centre.
    if (this.camera.aspect < 1) this.camera.rotateOnWorldAxis(UP, -deg(offset));
    this.applyFreeLook(dt);
    if (!this.drag.on) this.parallax.lerp(this.pointer, 1 - Math.exp(-dt * 2));
    this.camera.rotateOnWorldAxis(UP, -this.parallax.x * 0.012);
    this.camera.rotateX(this.parallax.y * 0.008);

    this.focus.set(0, 0, -1).applyQuaternion(this.camera.quaternion).multiplyScalar(70).add(this.camera.position).setY(0);
    this.env.update(hour, this.camera, this.focus, dt);
    if (this.env.water) this.env.water.visible = this.camera.position.z > -14;
    const night = this.env.night;
    for (const fn of this.updaters) fn(dt, night, t);
    updateFeatured(this.featured, u, night);

    this.bloom.strength = lerp(0.18, 0.75, night) + this.env.dusk * 0.1;
    this.bloom.threshold = lerp(1.1, 0.6, night);
    this.bloom.radius = lerp(0.4, 0.65, night);

    const si = this.rig.stopAt(u);
    const stop = si >= 0 ? this.rig.keys[si].stop! : null;
    if (stop !== this.lastStop) {
      this.lastStop = stop;
      this.events.onStop(stop);
    }
    const hr = Math.round(hour * 12) / 12;
    if (hr !== this.lastHour) {
      this.lastHour = hr;
      this.events.onHour(hr);
    }
    if (this.hoverDirty && !this.drag.on) {
      this.hoverDirty = false;
      this.hovered = this.pick();
      this.host.classList.toggle('can-pick', !!this.hovered);
    }
    this.updateLabels(si);
    this.composer.render(dt);
  }

  private v = new THREE.Vector3();
  private updateLabels(activeKey: number) {
    const { w, h } = this.size;
    for (const l of this.labels) {
      const d = this.camera.position.distanceTo(l.pos);
      this.v.copy(l.pos).project(this.camera);
      const sx = ((this.v.x + 1) / 2) * w, sy = ((1 - this.v.y) / 2) * h;
      const hovered = this.hovered?.label === l;
      // Hide labels that are far away, off screen, or would collide with the header.
      const inView = this.v.z < 1 && sx > 40 && sx < w - 60 && sy > 120 && sy < h;
      const fade = inView ? (hovered ? 1 : clamp((150 - d) / 30)) : 0;
      l.el.style.opacity = String(fade);
      l.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
      l.el.classList.toggle('on', hovered || (l.key !== undefined && l.key === activeKey));
    }
    const p = this.hovered;
    if (p && !p.label) {
      this.tip.textContent = `${p.name} →`;
      this.tip.style.opacity = '1';
      this.tip.style.transform = `translate(${((this.pointer.x + 1) / 2) * w + 14}px, ${((1 - this.pointer.y) / 2) * h + 14}px)`;
    } else this.tip.style.opacity = '0';
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.labels.forEach((l) => l.el.remove());
    this.tip.remove();
    this.renderer.domElement.remove();
  }
}
