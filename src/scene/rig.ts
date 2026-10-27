import * as THREE from 'three';
import { clamp, lerp } from './util';

export type Key = {
  pos: [number, number, number];
  look: [number, number, number];
  hour: number;
  stop?: string;
  /** Scroll length of the leg that starts here; by default it follows distance travelled and turn angle. */
  weight?: number;
  /** Degrees the shot is turned to keep the subject clear of the desktop card; undone on portrait screens. */
  offset?: number;
};

// Fraction of a leg spent parked at a content stop, so the card can be read before the camera moves on.
const HOLD = 0.12;
const SAMPLES = 48;

/**
 * Scroll-driven camera. Position follows a Catmull-Rom spline through the keys at constant speed
 * within each leg (arc-length parameterised), orientation is slerped, and every leg's share of the
 * page is proportional to how far the camera travels, so speed feels the same everywhere.
 */
export class Rig {
  private curve: THREE.CatmullRomCurve3;
  private quats: THREE.Quaternion[];
  private cum: number[] = [0];
  private arc: number[][] = [];
  readonly total: number;

  constructor(readonly keys: Key[]) {
    this.curve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal');
    const m = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    this.quats = keys.map((k) => new THREE.Quaternion().setFromRotationMatrix(m.lookAt(new THREE.Vector3(...k.pos), new THREE.Vector3(...k.look), up)));
    const n = keys.length;
    const p = new THREE.Vector3(), prev = new THREE.Vector3();
    for (let s = 0; s < n - 1; s++) {
      // Cumulative arc length table for this leg.
      const table = [0];
      this.curve.getPoint(s / (n - 1), prev);
      for (let i = 1; i <= SAMPLES; i++) {
        this.curve.getPoint((s + i / SAMPLES) / (n - 1), p);
        table.push(table[i - 1] + p.distanceTo(prev));
        prev.copy(p);
      }
      this.arc.push(table);
      const turn = THREE.MathUtils.radToDeg(this.quats[s].angleTo(this.quats[s + 1]));
      const w = keys[s].weight ?? clamp(0.5 + table[SAMPLES] / 70 + turn / 220, 0.8, 1.8);
      this.cum.push(this.cum[s] + w);
    }
    this.total = this.cum[n - 1];
  }

  /** Scroll fraction at which a given key is centred. */
  progressOf(index: number) {
    return this.cum[index] / this.total;
  }

  sample(p: number, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
    const n = this.keys.length;
    const x = clamp(p) * this.total;
    let s = 0;
    while (s < n - 2 && x >= this.cum[s + 1]) s++;
    const t = clamp((x - this.cum[s]) / (this.cum[s + 1] - this.cum[s]));
    const ha = this.keys[s].stop ? HOLD : 0, hb = this.keys[s + 1].stop ? HOLD : 0;
    const tt = clamp((t - ha) / (1 - ha - hb));
    // Ease out of and into stops; glide straight through waypoints that have no content.
    let f: number;
    if (ha && hb) f = 0.5 - 0.5 * Math.cos(Math.PI * tt);
    else if (ha) f = 1 - Math.cos((Math.PI / 2) * tt);
    else if (hb) f = Math.sin((Math.PI / 2) * tt);
    else f = tt;

    // Map the eased fraction to distance along the leg so speed stays even.
    const table = this.arc[s];
    const target = f * table[SAMPLES];
    let i = 1;
    while (i < SAMPLES && table[i] < target) i++;
    const seg = table[i] - table[i - 1];
    const local = (i - 1 + (seg > 0 ? (target - table[i - 1]) / seg : 0)) / SAMPLES;
    const u = s + local;
    this.curve.getPoint(u / (n - 1), outPos);
    outQuat.slerpQuaternions(this.quats[s], this.quats[s + 1], f);
    return {
      u,
      hour: lerp(this.keys[s].hour, this.keys[s + 1].hour, f),
      offset: lerp(this.keys[s].offset ?? 0, this.keys[s + 1].offset ?? 0, f),
    };
  }

  /** Index of the content stop the camera is at, or -1 while travelling between stops. */
  stopAt(u: number) {
    const k = Math.round(u);
    return this.keys[k]?.stop && Math.abs(u - k) < 0.4 ? k : -1;
  }
}
