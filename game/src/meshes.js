// meshes.js — SOLMARA 3D: every visible thing is built here from scratch.
// Procedural canvas textures + smooth (non-boxy) mesh builders: beveled extruded
// buildings with lit window facades, smooth extruded cars with glass cabins and
// spinning wheels, capsule people, palms, ferris wheel, neon signs, street lamps.
// No model files, no network — everything is generated in code.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

// ---------- canvas texture helpers ----------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function canvasTexture(c, repeatX, repeatY) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  if (repeatX) t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Facade: warm wall with a grid of windows, some lit. One tile = 4 x 8 windows.
function facadeTexture(base, lit) {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  // subtle vertical grime streaks
  for (let i = 0; i < 26; i++) {
    g.fillStyle = 'rgba(0,0,0,0.05)';
    const x = Math.random() * 256;
    g.fillRect(x, 0, 3 + Math.random() * 6, 256);
  }
  for (let r = 0; r < 8; r++) {
    for (let col = 0; col < 4; col++) {
      const x = 14 + col * 62, y = 12 + r * 30;
      const isLit = Math.random() < 0.34;
      g.fillStyle = isLit ? lit : '#232a38';
      g.fillRect(x, y, 34, 20);
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.fillRect(x, y, 34, 3);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x, y + 20, 34, 2);
      // window frame
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.lineWidth = 2;
      g.strokeRect(x, y, 34, 20);
    }
  }
  return canvasTexture(c, 1 / 26, 1 / 26);
}

function roofTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#8a7f74'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 6, 6);
  }
  return canvasTexture(c, 1 / 32, 1 / 32);
}

function groundTexture(kind) {
  const [c, g] = makeCanvas(256, 256);
  if (kind === 'asphalt') {
    g.fillStyle = '#3a3f4a'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    // cracks
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      let x = Math.random() * 256, y = Math.random() * 256;
      g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); }
      g.stroke();
    }
  } else if (kind === 'sidewalk') {
    g.fillStyle = '#b9b3a4'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 3;
    for (let i = 0; i <= 256; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = 'rgba(0,0,0,0.05)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  } else if (kind === 'grass') {
    g.fillStyle = '#5da24a'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = ['#4c8a3e', '#6fb45c', '#3e7a34'][i % 3];
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 4);
    }
  } else if (kind === 'sand') {
    g.fillStyle = '#e8cf9a'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(180,140,80,0.25)' : 'rgba(255,255,255,0.2)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  } else if (kind === 'water') {
    g.fillStyle = '#2fa8c9'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const y = i * 22 + 6;
      g.beginPath();
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.09 + i) * 4);
      g.stroke();
    }
  }
  return canvasTexture(c, 1 / 90, 1 / 90);
}

function neonTexture(text, color) {
  const [c, g] = makeCanvas(256, 64);
  g.fillStyle = '#0a0a14'; g.fillRect(0, 0, 256, 64);
  g.font = '900 34px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.fillText(text, 128, 34);
  const t = canvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function glowTexture(inner, outer) {
  const [c, g] = makeCanvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.4, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Shared textures (built once).
let TEX = null;
export function getTextures() {
  if (TEX) return TEX;
  TEX = {
    facadeDowntown: facadeTexture('#c8b49a', '#ffd97a'),
    facadeOld: facadeTexture('#d9c9a8', '#ffe9a8'),
    facadeInd: facadeTexture('#9aa0a8', '#cfe8ff'),
    facadeRes: facadeTexture('#e0d2b8', '#ffe9a8'),
    roof: roofTexture(),
    asphalt: groundTexture('asphalt'),
    sidewalk: groundTexture('sidewalk'),
    grass: groundTexture('grass'),
    sand: groundTexture('sand'),
    water: groundTexture('water'),
    glowWhite: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.45)'),
    glowWarm: glowTexture('rgba(255,220,150,1)', 'rgba(255,160,60,0.4)'),
    glowRed: glowTexture('rgba(255,60,60,1)', 'rgba(255,0,0,0.4)'),
    glowBlue: glowTexture('rgba(60,120,255,1)', 'rgba(0,60,255,0.4)'),
  };
  return TEX;
}

// ---------- materials ----------
let MAT = null;
export function getMaterials() {
  if (MAT) return MAT;
  const T = getTextures();
  MAT = {
    roof: new THREE.MeshStandardMaterial({ map: T.roof, roughness: 0.95, metalness: 0.0 }),
    facadeDowntown: new THREE.MeshStandardMaterial({ map: T.facadeDowntown, roughness: 0.85, metalness: 0.05 }),
    facadeOld: new THREE.MeshStandardMaterial({ map: T.facadeOld, roughness: 0.9, metalness: 0.0 }),
    facadeInd: new THREE.MeshStandardMaterial({ map: T.facadeInd, roughness: 0.9, metalness: 0.15 }),
    facadeRes: new THREE.MeshStandardMaterial({ map: T.facadeRes, roughness: 0.9, metalness: 0.0 }),
    asphalt: new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: 0.95, metalness: 0.0 }),
    sidewalk: new THREE.MeshStandardMaterial({ map: T.sidewalk, roughness: 0.95, metalness: 0.0 }),
    grass: new THREE.MeshStandardMaterial({ map: T.grass, roughness: 1.0, metalness: 0.0 }),
    sand: new THREE.MeshStandardMaterial({ map: T.sand, roughness: 1.0, metalness: 0.0 }),
    water: new THREE.MeshStandardMaterial({ map: T.water, roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.94 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x2a4a66, roughness: 0.12, metalness: 0.9 }),
    glassDowntown: new THREE.MeshStandardMaterial({ color: 0x7fb8d8, roughness: 0.08, metalness: 0.95, emissive: 0x1a3a55, emissiveIntensity: 0.35 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1.0 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3f9e4d, roughness: 0.9, side: THREE.DoubleSide }),
    leafDry: new THREE.MeshStandardMaterial({ color: 0x6fae4a, roughness: 0.9, side: THREE.DoubleSide }),
    pole: new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.6 }),
    lampHead: new THREE.MeshStandardMaterial({ color: 0x444a55, roughness: 0.5, metalness: 0.5, emissive: 0xffe9a8, emissiveIntensity: 0.9 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 }),
    hub: new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.9 }),
    pierWood: new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.95 }),
    ferris: new THREE.MeshStandardMaterial({ color: 0xff5a7a, roughness: 0.5, metalness: 0.3, emissive: 0x881133, emissiveIntensity: 0.4 }),
    ferrisCabin: new THREE.MeshStandardMaterial({ color: 0xffe93c, roughness: 0.5, metalness: 0.2 }),
  };
  return MAT;
}

export function paintMaterial(hex) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex), roughness: 0.32, metalness: 0.55,
    envMapIntensity: 1.0,
  });
}

// ---------- buildings: beveled extrude, facade sides + roof caps ----------
const BUILD_H = 3.0; // world height scale for the 2D hgt value
export function buildingGeometry(b) {
  const w = b.w, d = b.h, h = Math.max(10, b.hgt * BUILD_H);
  const s = new THREE.Shape();
  const r = Math.min(6, w * 0.12, d * 0.12);
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: h, steps: 1, bevelEnabled: true,
    bevelThickness: 1.6, bevelSize: 1.6, bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2); // stand up: extrusion becomes +Y
  geo.translate(b.x + b.w / 2, 0, b.y + b.h / 2);
  return geo;
}

export function roofPropGeometry(b) {
  // a couple of rooftop boxes (AC units / water tank) for silhouette variety
  const geos = [];
  const h = Math.max(10, b.hgt * BUILD_H);
  const n = (b.w > 70 && b.h > 70) ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const rw = Math.min(14, b.w * 0.22), rd = Math.min(14, b.h * 0.22);
    const g = new THREE.BoxGeometry(rw, 5, rd);
    const ox = (i === 0 ? -1 : 1) * b.w * 0.2;
    const oz = (i === 0 ? -1 : 1) * b.h * 0.18;
    g.translate(b.x + b.w / 2 + ox, h + 2.5, b.y + b.h / 2 + oz);
    geos.push(g);
  }
  if (b.district === 'downtown' && b.hgt > 34) {
    // antenna spire on the tallest towers
    const sp = new THREE.CylinderGeometry(0.7, 1.4, 26, 6);
    sp.translate(b.x + b.w / 2, h + 13, b.y + b.h / 2);
    geos.push(sp);
  }
  return mergeGeometries(geos);
}

// ---------- cars: smooth extruded body profile + glass cabin + wheels ----------
const BODY_SHAPES = {};
function carBodyGeometry(len, wid) {
  const key = len + 'x' + wid;
  if (BODY_SHAPES[key]) return BODY_SHAPES[key];
  const s = new THREE.Shape();
  const L = len / 2, H = 11;
  s.moveTo(-L + 2, 1.5);
  s.lineTo(-L + 1, 6.5);
  s.quadraticCurveTo(-L + 2, 8.5, -L + 7, 8.8);   // rear deck
  s.lineTo(-L + 13, 9.2);
  s.quadraticCurveTo(-L + 17, 9.6, -L + 19, 9.4);  // up to roof line
  s.lineTo(L - 19, 9.4);
  s.quadraticCurveTo(L - 16, 9.2, L - 12, 8.4);    // windshield slope
  s.lineTo(L - 4, 7.2);                              // hood
  s.quadraticCurveTo(L, 6.6, L, 4.2);               // nose
  s.lineTo(L, 1.5);
  s.quadraticCurveTo(L - 2, 0.6, L - 6, 0.6);
  s.lineTo(-L + 6, 0.6);
  s.quadraticCurveTo(-L + 1, 0.6, -L + 2, 1.5);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: wid - 3, steps: 1, bevelEnabled: true,
    bevelThickness: 1.6, bevelSize: 1.6, bevelSegments: 3,
  });
  geo.translate(0, 0, -(wid - 3) / 2);
  BODY_SHAPES[key] = geo;
  return geo;
}

function cabinGeometry(len) {
  const s = new THREE.Shape();
  const L = len * 0.30;
  s.moveTo(-L, 0);
  s.lineTo(-L + 3, 7.5);
  s.quadraticCurveTo(-L + 5, 9, -L + 9, 9);
  s.lineTo(L - 9, 9);
  s.quadraticCurveTo(L - 5, 9, L - 3, 7.5);
  s.lineTo(L, 0);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 15, steps: 1, bevelEnabled: true,
    bevelThickness: 1.0, bevelSize: 1.0, bevelSegments: 2,
  });
  geo.translate(0, 0, -7.5);
  return geo;
}

let WHEEL_GEO = null;
function wheelGeometry() {
  if (WHEEL_GEO) return WHEEL_GEO;
  const tire = new THREE.CylinderGeometry(4.4, 4.4, 3.2, 16);
  tire.rotateX(Math.PI / 2); // axle along Z
  const hub = new THREE.CylinderGeometry(2.1, 2.1, 3.4, 10);
  hub.rotateX(Math.PI / 2);
  // merge with groups: tire material 0, hub material 1
  const merged = mergeGeometries([tire, hub], false);
  merged.groups.length = 0;
  merged.addGroup(0, tire.index.count, 0);
  merged.addGroup(tire.index.count, hub.index.count, 1);
  WHEEL_GEO = merged;
  return merged;
}

export function makeCarMesh(car) {
  const M = getMaterials();
  const group = new THREE.Group();
  const bodyGeo = carBodyGeometry(car.w, car.h);
  const paint = paintMaterial(car.color);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.castShadow = true;
  body.position.y = 3.4;
  group.add(body);
  const cabin = new THREE.Mesh(cabinGeometry(car.w), M.glass);
  cabin.position.set(-1, 11.5, 0);
  cabin.castShadow = true;
  group.add(cabin);
  const wg = wheelGeometry();
  const wheels = [];
  const wx = car.w * 0.31, wz = car.h / 2 - 0.4;
  for (const [x, z] of [[wx, wz], [wx, -wz], [-wx, wz], [-wx, -wz]]) {
    const wheel = new THREE.Mesh(wg, [M.tire, M.hub]);
    wheel.position.set(x, 4.4, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  // headlights + tail lights (small emissive boxes)
  const hl = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.2, 3.4),
    new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xfff2b0, emissiveIntensity: 1.4 }),
  );
  hl.position.set(car.w / 2 + 0.4, 6.4, car.h / 2 - 4.5);
  group.add(hl);
  const hl2 = hl.clone();
  hl2.position.z = -(car.h / 2 - 4.5);
  group.add(hl2);
  const tl = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.2, 3.4),
    new THREE.MeshStandardMaterial({ color: 0xa01818, emissive: 0xff2e2e, emissiveIntensity: 0.9 }),
  );
  tl.position.set(-car.w / 2 - 0.4, 6.4, car.h / 2 - 4.5);
  group.add(tl);
  const tl2 = tl.clone();
  tl2.position.z = -(car.h / 2 - 4.5);
  group.add(tl2);
  if (car.type === 'police') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(8, 2.6, 10),
      new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.4, metalness: 0.4 }),
    );
    bar.position.set(-2, 21.5, 0);
    group.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 2.2, 9.4),
      new THREE.MeshStandardMaterial({ color: 0xff2e2e, emissive: 0xff2020, emissiveIntensity: 2.2 }),
    );
    red.position.set(-4.4, 23.4, 0);
    group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 2.2, 9.4),
      new THREE.MeshStandardMaterial({ color: 0x2e6bff, emissive: 0x2050ff, emissiveIntensity: 2.2 }),
    );
    blue.position.set(0.4, 23.4, 0);
    group.add(blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
  }
  if (car.type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(10, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe93c, emissiveIntensity: 0.7 }),
    );
    sign.position.set(-1, 22.5, 0);
    group.add(sign);
  }
  group.userData.wheels = wheels;
  group.userData.paint = paint;
  return group;
}

// ---------- people: one merged mesh, capsule torso + head + limbs ----------
export function makePersonMesh(shirt, skin) {
  const parts = [];
  // torso: capsule-ish — cylinder with a sphere cap top
  const torso = new THREE.CylinderGeometry(4.6, 5.2, 8.5, 10);
  torso.translate(0, 9.5, 0);
  parts.push(torso);
  const chest = new THREE.SphereGeometry(4.6, 10, 8);
  chest.scale(1, 0.75, 0.9);
  chest.translate(0, 13.6, 0);
  parts.push(chest);
  // head
  const head = new THREE.SphereGeometry(3.4, 12, 10);
  head.translate(0, 18.6, 0);
  parts.push(head);
  // arms: angled down-forward cylinders
  for (const side of [-1, 1]) {
    const arm = new THREE.CylinderGeometry(1.5, 1.3, 7.5, 8);
    arm.rotateZ(side * 0.5);
    arm.translate(side * 5.6, 10.5, 1.2);
    parts.push(arm);
  }
  // legs
  for (const side of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(1.9, 1.6, 6.5, 8);
    leg.translate(side * 2.4, 3.2, 0);
    parts.push(leg);
  }
  const bodyGeo = mergeGeometries(parts, false);
  const shirtMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shirt), roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(skin), roughness: 0.7 });
  // groups: torso+chest+legs = shirt(0), head+arms = skin(1) — rebuild groups by part order
  bodyGeo.clearGroups();
  let offset = 0;
  const counts = parts.map((p) => p.index.count);
  // parts order: torso, chest, head, armL, armR, legL, legR
  const mats = [0, 0, 1, 1, 1, 0, 0];
  for (let i = 0; i < parts.length; i++) {
    bodyGeo.addGroup(offset, counts[i], mats[i]);
    offset += counts[i];
  }
  const mesh = new THREE.Mesh(bodyGeo, [shirtMat, skinMat]);
  mesh.castShadow = true;
  // gun (shown when armed)
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(7, 1.4, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.7 }),
  );
  gun.position.set(7.5, 12.5, 1.5);
  gun.visible = false;
  const group = new THREE.Group();
  group.add(mesh);
  group.add(gun);
  group.userData.body = mesh;
  group.userData.gun = gun;
  return group;
}

// ---------- palms ----------
export function palmGeometries() {
  // trunk: slightly curved tapered cylinder
  const trunk = new THREE.CylinderGeometry(1.6, 2.6, 26, 7);
  trunk.translate(0, 13, 0);
  // leaves: 7 flattened cones fanning out and drooping
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = new THREE.ConeGeometry(3.4, 15, 4);
    leaf.scale(1, 1, 0.28);
    leaf.rotateX(Math.PI / 2.4); // droop outward-down
    leaf.rotateY(a);
    leaf.translate(Math.cos(a) * 6.5, 26.5, Math.sin(a) * 6.5);
    leaves.push(leaf);
  }
  const leafGeo = mergeGeometries(leaves, false);
  // coconuts
  const nut = new THREE.SphereGeometry(1.6, 8, 6);
  nut.translate(1.5, 24.5, 1);
  const nut2 = nut.clone();
  nut2.translate(-3, 0.5, -1.5);
  const nuts = mergeGeometries([nut, nut2], false);
  return { trunk, leafGeo, nuts };
}

export function treeGeometry(palm) {
  if (palm) return null; // palms handled by city3d with shared geos
  // round leafy tree: trunk + 2 stacked blobs
  const trunk = new THREE.CylinderGeometry(1.8, 2.6, 10, 7);
  trunk.translate(0, 5, 0);
  const blob1 = new THREE.SphereGeometry(8.5, 10, 8);
  blob1.scale(1, 0.85, 1);
  blob1.translate(0, 14, 0);
  const blob2 = new THREE.SphereGeometry(6, 9, 7);
  blob2.translate(2, 20, 1);
  return { trunk, crown: mergeGeometries([blob1, blob2], false) };
}

// ---------- ferris wheel ----------
export function makeFerrisWheel() {
  const M = getMaterials();
  const group = new THREE.Group();
  const wheel = new THREE.Group();
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(34, 1.6, 8, 40), M.ferris);
  wheel.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(24, 1.2, 8, 32), M.ferris);
  wheel.add(ring2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 34, 6), M.ferris);
    spoke.rotation.z = a + Math.PI / 2;
    spoke.position.set(Math.cos(a) * 17, Math.sin(a) * 17, 0);
    wheel.add(spoke);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 6), M.ferrisCabin);
    cabin.position.set(Math.cos(a) * 34, Math.sin(a) * 34, 0);
    wheel.add(cabin);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe93c, emissiveIntensity: 2.0 }),
    );
    bulb.position.set(Math.cos(a) * 34, Math.sin(a) * 34, 3.4);
    wheel.add(bulb);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 6, 10), M.pole);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  group.add(wheel);
  // A-frame legs
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 42, 8), M.pole);
    leg.position.set(0, 18, side * 13);
    leg.rotation.x = side * 0.32;
    group.add(leg);
  }
  group.userData.wheel = wheel;
  return group;
}

// ---------- neon sign ----------
export function makeNeonSign(text, color, w) {
  const tex = neonTexture(text, color);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.25), mat);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getTextures().glowWhite, color: new THREE.Color(color),
    transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.scale.set(w * 1.4, w * 0.5, 1);
  const group = new THREE.Group();
  group.add(mesh);
  group.add(glow);
  return group;
}

// ---------- street lamp (merged later in city3d) ----------
export function lampGeometries() {
  const pole = new THREE.CylinderGeometry(0.9, 1.2, 26, 7);
  pole.translate(0, 13, 0);
  const arm = new THREE.CylinderGeometry(0.6, 0.6, 9, 6);
  arm.rotateZ(Math.PI / 2);
  arm.translate(4.5, 25.5, 0);
  const head = new THREE.BoxGeometry(5, 1.6, 2.4);
  head.translate(8.5, 25.2, 0);
  return { pole: mergeGeometries([pole, arm], false), head };
}
