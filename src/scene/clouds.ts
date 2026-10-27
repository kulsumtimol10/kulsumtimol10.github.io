import * as THREE from 'three';

// A drifting stratocumulus layer, ray-cast onto a virtual plane 1.5 km up and lit by the current sun.
const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */ `
uniform float time;
uniform float cover;
uniform vec3 sunDir;
uniform vec3 lit;
uniform vec3 shade;
uniform float opacity;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v / 0.875 * 0.96;
}
void main() {
  vec3 d = normalize(vDir);
  if (d.y < 0.01) discard;
  vec2 uv = d.xz / (d.y + 0.08) * 1.3 + vec2(time * 0.006, time * 0.002);
  float n = fbm(uv);
  float dens = smoothstep(1.0 - cover, 1.0 - cover + 0.32, n);
  // Cheap self-shadowing: sample again a little toward the sun.
  float n2 = fbm3(uv + sunDir.xz * 0.06);
  float light = clamp(0.55 + (n - n2) * 4.0, 0.0, 1.0);
  float silver = pow(max(dot(d, sunDir), 0.0), 8.0) * (1.0 - dens) * 1.5;
  vec3 col = mix(shade, lit, light) + lit * silver;
  float horizon = smoothstep(0.01, 0.16, d.y);
  gl_FragColor = vec4(col, dens * horizon * opacity);
}`;

export function makeClouds() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    uniforms: {
      time: { value: 0 }, cover: { value: 0.42 }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
      lit: { value: new THREE.Color(1, 1, 1) }, shade: { value: new THREE.Color(0.6, 0.65, 0.72) }, opacity: { value: 0.9 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3200, 48, 24), mat);
  mesh.renderOrder = -1;
  return mesh;
}
