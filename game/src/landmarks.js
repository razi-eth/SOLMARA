// landmarks.js — SOLMARA 3D: the city's landmarks.
// Every landmark has its own silhouette, palette, signage and props, so no
// two blocks read the same: a bank with columns, a police HQ with a light
// bar, a gas station under a canopy, a school with a field, a fire station,
// a hospital with a helipad, a church, a mall, a casino, a hotel, a bar, a
// stadium, an airport, a rollercoaster park. Foot cops in COP_LOOK patrol on
// foot when the wanted level rises; the HQ's parked interceptors are
// stealable, and the heli returns to the airport tower between hunts.
// stadium, an airport with a runway, and a rollercoaster in the park.
// Built by hand from primitives + canvas-texture signs; all names original.
import * as THREE from 'three';
import { makeCarMesh, makeNeonSign, getMaterials, getTextures } from './meshes.js';
import { hash3 } from './random.js';

// ---------- small builders ----------
function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, x, y, z, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function prismGeometry(w, h, d) {
  // triangular prism: base w (x), apex h (y), length d (z)
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: d, steps: 1, bevelEnabled: false });
}
function signTexture(text, sub, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 52px Arial, sans-serif';
  g.fillText(text, 256, sub ? 50 : 66);
  if (sub) { g.font = '700 28px Arial, sans-serif'; g.fillText(sub, 256, 98); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// A daytime-readable board sign (slight emissive so the letters stay legible at dusk).
export function makeBoardSign(text, sub, bg, fg, w, h) {
  const tex = signTexture(text, sub, bg, fg);
  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.7,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}
function flagPole(x, z, h, color, M) {
  const g = new THREE.Group();
  g.add(cyl(0.8, 1.1, h, M.pole, 0, h / 2, 0, 8));
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 10),
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 }),
  );
  flag.position.set(8.5, h - 6, 0);
  g.add(flag);
  g.position.set(x, 0, z);
  return g;
}
function parkedCar(type, color, plate, x, z, angle) {
  const mesh = makeCarMesh({ w: type === 'truck' ? 62 : type === 'van' ? 54 : 46, h: type === 'truck' ? 26 : type === 'van' ? 24 : 22, color, plate, type });
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  return mesh;
}
// A simple motorcycle: two torus wheels + a low frame + handlebar.
function makeBike(color, x, z, angle) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 });
  for (const dx of [-7, 7]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(3.4, 1.1, 8, 16), tire);
    wheel.position.set(dx, 3.4, 0);
    wheel.rotation.y = Math.PI / 2;
    wheel.castShadow = true;
    g.add(wheel);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(13, 1.4, 1.6), mat);
  frame.position.set(0, 5.5, 0);
  g.add(frame);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 2.4), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.8 }));
  seat.position.set(-3.5, 6.8, 0);
  g.add(seat);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 7), mat);
  bar.position.set(6.5, 8, 0);
  g.add(bar);
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  return g;
}

// ---------- landmark builders ----------
// Each gets (M, T, def) with def = { x, y, w, h } in world coords.
// Three.js: world x -> x, world y -> z, up is +y. Signs go on the south face
// (z = def.y + def.h, facing +z) — the face a north-looking camera sees.
function buildBank(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const stone = new THREE.MeshStandardMaterial({ color: 0xe0d2b8, roughness: 0.8, envMapIntensity: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.35, metalness: 0.8, envMapIntensity: 1.0 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.7 });
  g.add(box(110, 42, 80, stone, cx, 21, cz)); // main hall
  // triangular pediment on the roof front
  const ped = new THREE.Mesh(prismGeometry(110, 14, 80), stone);
  ped.position.set(cx, 42, cz - 40);
  ped.castShadow = true;
  g.add(ped);
  // four tall columns + steps at the entrance (south face)
  for (let i = 0; i < 4; i++) {
    const x = cx - 42 + i * 28;
    g.add(cyl(3.6, 4.2, 34, white, x, 17, cz + 44, 10));
  }
  g.add(box(120, 2.5, 14, white, cx, 1.2, cz + 48));
  g.add(box(112, 2.5, 11, white, cx, 3.6, cz + 46));
  // gold dome on the roof
  const dome = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  dome.position.set(cx, 56, cz);
  dome.castShadow = true;
  g.add(dome);
  const sign = makeBoardSign('SOLMARA BANK', 'EST. 1987', '#1a3a2a', '#ffd97a', 88, 22);
  sign.position.set(cx, 30, cz + 41);
  g.add(sign);
  g.add(flagPole(cx - 62, cz + 40, 34, 0xd9a441, M));
  g.add(flagPole(cx + 62, cz + 40, 34, 0x1a3a2a, M));
  return { group: g, anim: null };
}

function buildHotel(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const podium = new THREE.MeshStandardMaterial({ color: 0x8a7f74, roughness: 0.85 });
  g.add(box(112, 14, 100, podium, cx, 7, cz)); // podium
  g.add(box(70, 130, 70, M.glassDowntown, cx, 14 + 65, cz)); // glass tower
  g.add(box(76, 4, 76, podium, cx, 14 + 130 + 2, cz)); // roof cap
  // entrance canopy + columns
  g.add(box(40, 2.5, 16, podium, cx, 12, cz + 54));
  g.add(cyl(1.4, 1.4, 11, M.pole, cx - 16, 6, cz + 60, 8));
  g.add(cyl(1.4, 1.4, 11, M.pole, cx + 16, 6, cz + 60, 8));
  const sign = makeNeonSign('HOTEL', '#22e6ff', 56);
  sign.position.set(cx, 128, cz + 36);
  g.add(sign);
  const board = makeBoardSign('SOLMARA GRAND', 'HOTEL', '#0a1a2a', '#7fb8d8', 72, 18);
  board.position.set(cx, 22, cz + 51);
  g.add(board);
  return { group: g, anim: null };
}

function buildCasino(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const purple = new THREE.MeshStandardMaterial({ color: 0x5a1a6e, roughness: 0.6, envMapIntensity: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.35, metalness: 0.8, envMapIntensity: 1.0 });
  g.add(box(120, 26, 90, purple, cx, 13, cz));
  g.add(box(124, 2.5, 94, gold, cx, 26.5, cz)); // gold roof trim
  // gold dome on the roof
  const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  dome.position.set(cx, 28, cz - 10);
  dome.castShadow = true;
  g.add(dome);
  const sign = makeNeonSign('CASINO', '#ff2e88', 84);
  sign.position.set(cx, 20, cz + 46);
  g.add(sign);
  const slots = makeNeonSign('SLOTS', '#ffe93c', 34);
  slots.position.set(cx - 38, 12, cz + 46);
  g.add(slots);
  const win = makeNeonSign('WIN', '#7cff3c', 24);
  win.position.set(cx + 40, 12, cz + 46);
  g.add(win);
  // glass entrance + canopy glow
  g.add(box(30, 12, 4, M.glass, cx, 6, cz + 46));
  g.add(box(40, 2, 12, gold, cx, 13, cz + 50));
  return { group: g, anim: null };
}

function buildPolice(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const blue = new THREE.MeshStandardMaterial({ color: 0x7a8aa8, roughness: 0.75, envMapIntensity: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.5 });
  g.add(box(110, 30, 80, blue, cx, 15, cz));
  g.add(box(116, 3, 86, dark, cx, 31.5, cz)); // roof cap
  // light bar on the roof: red + blue halves (flashed by render3d)
  const barBase = box(16, 3, 6, dark, cx, 34.5, cz - 10);
  g.add(barBase);
  const redMat = new THREE.MeshStandardMaterial({ color: 0xff2e2e, emissive: 0xff2020, emissiveIntensity: 2.2 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x2e6bff, emissive: 0x2050ff, emissiveIntensity: 2.2 });
  const red = new THREE.Mesh(new THREE.BoxGeometry(7, 2.6, 5.4), redMat);
  red.position.set(cx - 4, 37, cz - 10);
  g.add(red);
  const blueL = new THREE.Mesh(new THREE.BoxGeometry(7, 2.6, 5.4), blueMat);
  blueL.position.set(cx + 4, 37, cz - 10);
  g.add(blueL);
  const sign = makeNeonSign('POLICE', '#2e6bff', 64);
  sign.position.set(cx, 22, cz + 41);
  g.add(sign);
  const board = makeBoardSign('SOLMARA PD', 'POLICE HEADQUARTERS', '#0a1a3a', '#9fc4ff', 76, 19);
  board.position.set(cx, 10, cz + 41);
  g.add(board);
  g.add(flagPole(cx - 58, cz + 38, 30, 0x2e6bff, M));
  // (two interceptors park out front — spawned as real cars by entities.js)
  return { group: g, anim: { kind: 'policeBar', redMat, blueMat } };
}

function buildBar(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const brick = new THREE.MeshStandardMaterial({ color: 0x5a2a2a, roughness: 0.85 });
  g.add(box(70, 16, 50, brick, cx, 8, cz));
  g.add(box(74, 2.5, 54, new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7 }), cx, 17, cz));
  // warm windows (emissive planes on the south face)
  const warm = new THREE.MeshStandardMaterial({ color: 0xffd97a, emissive: 0xffb347, emissiveIntensity: 1.4 });
  for (let i = 0; i < 3; i++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), warm);
    win.position.set(cx - 22 + i * 22, 8, cz + 25.2);
    g.add(win);
  }
  const sign = makeNeonSign("JAX'S BAR", '#ff7a1a', 56);
  sign.position.set(cx, 21, cz + 26);
  g.add(sign);
  // outdoor tables + stools
  for (const dx of [-24, 24]) {
    g.add(cyl(5, 5, 1, M.pole, cx + dx, 4, cz + 34, 10));
    g.add(cyl(0.7, 0.7, 4, M.pole, cx + dx, 2, cz + 34, 6));
    g.add(cyl(2.2, 2.2, 3, M.pole, cx + dx - 6, 1.5, cz + 34, 8));
    g.add(cyl(2.2, 2.2, 3, M.pole, cx + dx + 6, 1.5, cz + 34, 8));
  }
  // parked bikes
  g.add(makeBike(0xd9382b, cx - 30, cz + 56, 0.3));
  g.add(makeBike(0x2b6fd9, cx - 14, cz + 58, -0.2));
  g.add(makeBike(0xe8b62b, cx + 30, cz + 56, 0.5));
  return { group: g, anim: null };
}

function buildMall(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const beige = new THREE.MeshStandardMaterial({ color: 0xd9c9a8, roughness: 0.85 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x2b6fd9, roughness: 0.7 });
  g.add(box(130, 22, 110, beige, cx, 11, cz));
  g.add(box(132, 3, 112, stripe, cx, 16, cz)); // blue band under the roof
  g.add(box(134, 2.5, 114, new THREE.MeshStandardMaterial({ color: 0x8a7f74, roughness: 0.9 }), cx, 23, cz));
  // glass entrance
  g.add(box(34, 14, 4, M.glass, cx, 7, cz + 56));
  const sign = makeBoardSign('SOLMARA MALL', '', '#0a2a4a', '#ffffff', 96, 24);
  sign.position.set(cx, 28, cz + 56);
  g.add(sign);
  // parking lot (south of the building) with painted bays + parked cars
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(130, 42),
    new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.95 }));
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(cx, 0.55, cz + 76);
  lot.receiveShadow = true;
  g.add(lot);
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.85 });
  for (let i = -5; i <= 5; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 30), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(cx + i * 11, 0.6, cz + 76);
    g.add(line);
  }
  // (shoppers' cars park in the bays — spawned as real cars by entities.js)
  return { group: g, anim: null };
}

function buildFire(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const red = new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.7 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x7a1010, roughness: 0.6, metalness: 0.3 });
  g.add(box(110, 24, 80, red, cx, 12, cz));
  // three wide garage doors on the south face
  for (let i = 0; i < 3; i++) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(24, 17), doorMat);
    door.position.set(cx - 34 + i * 34, 9, cz + 40.2);
    g.add(door);
  }
  // watch tower at the corner
  g.add(box(16, 55, 16, red, cx + 52, 27.5, cz - 32));
  g.add(box(20, 10, 20, M.glass, cx + 52, 60, cz - 32));
  g.add(box(22, 2, 22, new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7 }), cx + 52, 66, cz - 32));
  const sign = makeBoardSign('FIRE STATION 7', '', '#7a1010', '#ffffff', 84, 21);
  sign.position.set(cx, 30, cz + 41);
  g.add(sign);
  // red beacon on the tower
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2.4 }));
  beacon.position.set(cx + 52, 68.5, cz - 32);
  g.add(beacon);
  // (the red fire truck parks out front — spawned as a real car by entities.js)
  return { group: g, anim: null };
}

function buildHospital(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.75 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd02020, roughness: 0.6, emissive: 0xd02020, emissiveIntensity: 0.4 });
  g.add(box(110, 36, 80, white, cx, 18, cz));
  // red cross on the south face + on the roof
  g.add(box(18, 6, 1.5, red, cx, 26, cz + 40.5));
  g.add(box(6, 18, 1.5, red, cx, 26, cz + 40.5));
  const crossRoof = new THREE.Group();
  crossRoof.add(box(16, 1.5, 5, red, 0, 0, 0));
  crossRoof.add(box(5, 1.5, 16, red, 0, 0, 0));
  crossRoof.position.set(cx - 30, 36.8, cz - 15);
  g.add(crossRoof);
  const sign = makeBoardSign('SOLMARA GENERAL', 'HOSPITAL', '#ffffff', '#d02020', 92, 23);
  sign.position.set(cx, 12, cz + 41);
  g.add(sign);
  // helipad on the roof: dark circle + white H + corner lights
  const pad = new THREE.Mesh(new THREE.CircleGeometry(16, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(cx + 28, 37, cz - 10);
  g.add(pad);
  const hTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.font = '900 96px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H', 64, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const hMark = new THREE.Mesh(new THREE.PlaneGeometry(18, 18),
    new THREE.MeshBasicMaterial({ map: hTex, transparent: true }));
  hMark.rotation.x = -Math.PI / 2;
  hMark.position.set(cx + 28, 37.2, cz - 10);
  g.add(hMark);
  // (the ambulance parks out front — spawned as a real car by entities.js)
  return { group: g, anim: null };
}

function buildChurch(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const cream = new THREE.MeshStandardMaterial({ color: 0xe8ddc8, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a3a2a, roughness: 0.9 });
  g.add(box(80, 22, 60, cream, cx, 11, cz));
  // steep pitched roof
  const roof = new THREE.Mesh(prismGeometry(84, 16, 64), roofMat);
  roof.position.set(cx, 22, cz - 32);
  roof.castShadow = true;
  g.add(roof);
  // steeple + gold cross at the front
  g.add(box(14, 42, 14, cream, cx, 21 + 21, cz + 28));
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.35, metalness: 0.8 });
  g.add(box(2, 12, 2, crossMat, cx, 70, cz + 28));
  g.add(box(7, 2, 2, crossMat, cx, 68, cz + 28));
  // arched windows (dark blue planes)
  const winMat = new THREE.MeshStandardMaterial({ color: 0x2a4a66, roughness: 0.2, metalness: 0.3, emissive: 0x1a3a55, emissiveIntensity: 0.5 });
  for (let i = 0; i < 3; i++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(7, 12), winMat);
    win.position.set(cx - 24 + i * 24, 11, cz + 30.2);
    g.add(win);
  }
  const sign = makeBoardSign('ST. MARIA', 'CHURCH', '#e8ddc8', '#7a3a2a', 64, 16);
  sign.position.set(cx, 26, cz + 31);
  g.add(sign);
  return { group: g, anim: null };
}

function buildGas(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const red = new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.6 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe8b62b, roughness: 0.6 });
  // canopy on 4 poles (player drives / walks under it)
  g.add(box(100, 3, 60, red, cx, 22, cz));
  g.add(box(102, 1.2, 62, yellow, cx, 20.4, cz)); // yellow canopy edge
  for (const [px, pz] of [[-46, -26], [46, -26], [-46, 26], [46, 26]]) {
    g.add(cyl(1.2, 1.4, 20, M.pole, cx + px, 10, cz + pz, 8));
  }
  // 4 pumps on 2 islands
  const pumpMat = new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.5, metalness: 0.3 });
  const pumpTop = new THREE.MeshStandardMaterial({ color: 0xe8b62b, roughness: 0.5 });
  const pumps = [];
  for (let i = 0; i < 4; i++) {
    const px = cx - 30 + (i % 2) * 60, pz = cz - 12 + Math.floor(i / 2) * 24;
    const island = box(16, 1.2, 10, new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 0.9 }), px, 0.6, pz);
    g.add(island);
    const pump = box(6, 12, 4, pumpMat, px, 7, pz);
    g.add(pump);
    g.add(box(6.4, 2, 4.4, pumpTop, px, 13.5, pz));
    pumps.push({ x: px, y: pz });
  }
  // price board by the road (east side, facing the avenue)
  g.add(cyl(1.5, 1.8, 30, M.pole, cx + 66, 15, cz + 20, 8));
  const price = makeBoardSign('GAS 3.49', 'DIESEL 3.89', '#0a0a14', '#ffe93c', 34, 18);
  price.position.set(cx + 66, 36, cz + 20);
  price.rotation.y = Math.PI / 2; // face east, toward Ocean Drive
  g.add(price);
  // shop at the back + canopy sign
  g.add(box(50, 14, 36, new THREE.MeshStandardMaterial({ color: 0xd9c9a8, roughness: 0.85 }), cx, 7, cz - 44));
  const sign = makeBoardSign('SOLMARA GAS', '', '#c02020', '#ffffff', 72, 18);
  sign.position.set(cx, 26, cz + 31);
  g.add(sign);
  return { group: g, anim: null, pumps };
}

function buildSchool(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd9c25a, roughness: 0.85 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 });
  g.add(box(130, 16, 50, yellow, cx, 8, cz));
  g.add(box(134, 2.5, 54, white, cx, 17, cz));
  // entrance block in the middle
  g.add(box(30, 20, 12, white, cx, 10, cz + 28));
  const sign = makeBoardSign('SOLMARA HIGH SCHOOL', '', '#1a3a8a', '#ffe93c', 104, 26);
  sign.position.set(cx, 24, cz + 26);
  g.add(sign);
  g.add(flagPole(cx - 58, cz + 34, 28, 0xffe93c, M));
  // (the yellow school bus parks out front — spawned as a real car by entities.js)
  // --- the field, one block south (fixed coords from world.js) ---
  const fx = 1050, fz = 2250;
  const field = new THREE.Mesh(new THREE.PlaneGeometry(148, 148),
    new THREE.MeshStandardMaterial({ color: 0x4c8a3e, roughness: 1 }));
  field.rotation.x = -Math.PI / 2;
  field.position.set(fx, 0.5, fz);
  field.receiveShadow = true;
  g.add(field);
  // running track: flat red ring around the field
  const track = new THREE.Mesh(new THREE.RingGeometry(42, 58, 32),
    new THREE.MeshStandardMaterial({ color: 0xa84a3a, roughness: 0.95 }));
  track.rotation.x = -Math.PI / 2;
  track.position.set(fx, 0.6, fz);
  g.add(track);
  // goal posts at both ends
  for (const dx of [-52, 52]) {
    g.add(cyl(0.7, 0.7, 10, white, fx + dx, 5, fz - 8, 6));
    g.add(cyl(0.7, 0.7, 10, white, fx + dx, 5, fz + 8, 6));
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 16, 6), white);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(fx + dx, 10, fz);
    g.add(bar);
  }
  return { group: g, anim: null };
}

function buildStadium(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9a9484, roughness: 0.9 });
  // oval bowl: open cylinder wall, squashed to an oval
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(70, 72, 18, 28, 1, true), concrete);
  wall.scale.set(1, 1, 0.78);
  wall.position.set(cx, 9, cz);
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);
  // rim + field
  const rim = new THREE.Mesh(new THREE.TorusGeometry(70, 2.2, 8, 28), new THREE.MeshStandardMaterial({ color: 0x2b6fd9, roughness: 0.6 }));
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 0.78, 1);
  rim.position.set(cx, 18.5, cz);
  g.add(rim);
  const field = new THREE.Mesh(new THREE.CircleGeometry(58, 28),
    new THREE.MeshStandardMaterial({ color: 0x3f9e4d, roughness: 1 }));
  field.rotation.x = -Math.PI / 2;
  field.scale.set(1, 0.78, 1);
  field.position.set(cx, 0.6, cz);
  field.receiveShadow = true;
  g.add(field);
  // white field lines
  const line = new THREE.Mesh(new THREE.RingGeometry(20, 21.5, 28),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
  line.rotation.x = -Math.PI / 2;
  line.scale.set(1, 0.78, 1);
  line.position.set(cx, 0.7, cz);
  g.add(line);
  // four floodlight poles
  for (const [dx, dz] of [[-78, -52], [78, -52], [-78, 52], [78, 52]]) {
    g.add(cyl(1.2, 1.6, 42, M.pole, cx + dx, 21, cz + dz, 8));
    const panel = box(14, 6, 2, new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xfff6c9, emissiveIntensity: 1.6,
    }), cx + dx, 42, cz + dz);
    panel.lookAt(cx, 42, cz);
    g.add(panel);
  }
  const sign = makeBoardSign('SOLMARA STADIUM', '', '#0a2a4a', '#ffffff', 96, 24);
  sign.position.set(cx, 24, cz + 55.5);
  g.add(sign);
  return { group: g, anim: null };
}

function buildAirport(M, T, def) {
  const g = new THREE.Group();
  const cx = def.x + def.w / 2, cz = def.y + def.h / 2;
  // terminal: glass box + roof
  g.add(box(120, 20, 70, M.glassDowntown, cx, 10, cz));
  g.add(box(124, 2.5, 74, new THREE.MeshStandardMaterial({ color: 0x8a7f74, roughness: 0.9 }), cx, 21, cz));
  const sign = makeBoardSign('SOLMARA AIRPORT', '', '#0a2a4a', '#ffffff', 96, 24);
  sign.position.set(cx, 28, cz + 36);
  g.add(sign);
  // control tower: cylinder + glass cabin + rotating beacon
  g.add(cyl(7, 9, 70, new THREE.MeshStandardMaterial({ color: 0xd9c9a8, roughness: 0.85 }), cx + 52, 35, cz - 20, 12));
  const cabin = cyl(13, 11, 10, M.glassDowntown, cx + 52, 75, cz - 20, 12);
  g.add(cabin);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 3),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.set(cx + 52, 82, cz - 20);
  g.add(beam);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2.4 }));
  beacon.position.set(cx + 52, 81, cz - 20);
  g.add(beacon);
  // runway (fixed strip south of the terminal, y 2600..2670)
  const rx = 2050, rz = 2635;
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(600, 70),
    new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.95 }));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(rx, 0.55, rz);
  runway.receiveShadow = true;
  g.add(runway);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  for (let x = rx - 280; x <= rx + 280; x += 40) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(18, 2.5), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.6, rz);
    g.add(dash);
  }
  // threshold bars at both ends
  for (const ex of [rx - 292, rx + 292]) {
    for (let i = -3; i <= 3; i++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(4, 14), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(ex, 0.6, rz + i * 8);
      g.add(bar);
    }
  }
  // runway edge lights (blue-white, emissive)
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x9fd4ff, emissive: 0x4aa8ff, emissiveIntensity: 2.0 });
  for (let x = rx - 290; x <= rx + 290; x += 58) {
    for (const dz of [-32, 32]) {
      const light = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), edgeMat);
      light.position.set(x, 1.2, rz + dz);
      g.add(light);
    }
  }
  // parked plane on the apron (fuselage + wings + tail, white/blue)
  const plane = new THREE.Group();
  const pWhite = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.3, metalness: 0.3, clearcoat: 0.8, envMapIntensity: 1.2 });
  const pBlue = new THREE.MeshStandardMaterial({ color: 0x2b6fd9, roughness: 0.5 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 46, 12), pWhite);
  fus.rotation.z = Math.PI / 2;
  fus.castShadow = true;
  plane.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 10), pWhite);
  nose.position.set(23, 0, 0);
  plane.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 52), pWhite);
  wing.position.set(2, -1, 0);
  wing.castShadow = true;
  plane.add(wing);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 1.4), pBlue);
  tailFin.position.set(-21, 6, 0);
  plane.add(tailFin);
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 20), pWhite);
  tailWing.position.set(-21, 2, 0);
  plane.add(tailWing);
  plane.position.set(1900, 8, 2560);
  plane.rotation.y = Math.PI / 2; // nose points east along the runway
  g.add(plane);
  // windsock near the runway
  g.add(cyl(0.8, 1.1, 18, M.pole, 1780, 9, 2580, 8));
  const sock = new THREE.Mesh(new THREE.ConeGeometry(3, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7 }));
  sock.rotation.z = -Math.PI / 2;
  sock.position.set(1786, 17, 2580);
  g.add(sock);
  return { group: g, anim: { kind: 'airportBeacon', beam } };
}

function buildCoaster(M, T, def) {
  // The rollercoaster lives in the park (world.park), not on a building block.
  const g = new THREE.Group();
  const cx = 1950, cz = 660;
  // closed loop: an ellipse with hills and a dip
  const pts = [];
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  const heights = [40, 62, 48, 34, 58, 40, 66, 36];
  for (let i = 0; i < angles.length; i++) {
    const a = (angles[i] * Math.PI) / 180;
    pts.push(new THREE.Vector3(cx + Math.cos(a) * 130, heights[i], cz + Math.sin(a) * 55));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.6);
  const trackMat = new THREE.MeshStandardMaterial({ color: 0xd9382b, roughness: 0.45, metalness: 0.5, envMapIntensity: 0.8 });
  const track = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 2.0, 8, true), trackMat);
  track.castShadow = true;
  g.add(track);
  // cross ties + support columns
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7 });
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const p = curve.getPointAt(t);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 3), tieMat);
    tie.position.copy(p);
    tie.position.y -= 2.5;
    const tan = curve.getTangentAt(t);
    tie.rotation.y = Math.atan2(tan.x, tan.z);
    g.add(tie);
  }
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const p = curve.getPointAt(t);
    g.add(cyl(1.4, 1.8, p.y, M.pole, p.x, p.y / 2, p.z, 8));
  }
  // station: platform + roof + sign at the south point of the loop
  const sx = cx, sz = cz + 62;
  g.add(box(44, 3, 20, new THREE.MeshStandardMaterial({ color: 0x9a9484, roughness: 0.9 }), sx, 1.5, sz));
  g.add(box(48, 2, 24, new THREE.MeshStandardMaterial({ color: 0x2b6fd9, roughness: 0.6 }), sx, 34, sz));
  for (const dx of [-20, 20]) g.add(cyl(1.2, 1.2, 32, M.pole, sx + dx, 16, sz, 8));
  const sign = makeBoardSign('SOLMARA PARK', 'ROLLERCOASTER', '#0a2a4a', '#ffe93c', 60, 15);
  sign.position.set(sx, 26, sz + 13);
  g.add(sign);
  // two coaster cars riding the loop — colours vary by a stable hash so the
  // pair is not always the same yellow/blue
  const cars = [];
  const carColors = [0xffe93c, 0x22e6ff, 0xff2e88, 0x7cff3c];
  for (let i = 0; i < 2; i++) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 6),
      new THREE.MeshStandardMaterial({ color: carColors[Math.floor(hash3(cx, cz, i + 1) * carColors.length)], roughness: 0.4, metalness: 0.4 }));
    body.castShadow = true;
    car.add(body);
    for (const dx of [-2.5, 2.5]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 5),
        new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.7 }));
      seat.position.set(dx, 3.5, 0);
      car.add(seat);
    }
    g.add(car);
    cars.push(car);
  }
  return { group: g, anim: { kind: 'coaster', curve, cars, t: [0, 0.5] } };
}

const BUILDERS = {
  bank: buildBank, hotel: buildHotel, casino: buildCasino, police: buildPolice,
  bar: buildBar, mall: buildMall, fire: buildFire, hospital: buildHospital,
  church: buildChurch, gas: buildGas, school: buildSchool, stadium: buildStadium,
  airport: buildAirport,
};

// Build every landmark in world.landmarks + the park rollercoaster.
// Returns { group, anims } — anims is keyed by kind for render3d.js.
export function buildLandmarks(world) {
  const M = getMaterials();
  const T = getTextures();
  const group = new THREE.Group();
  const anims = {};
  for (const lm of world.landmarks) {
    const b = BUILDERS[lm.id];
    if (!b) continue;
    const built = b(M, T, lm);
    group.add(built.group);
    if (built.anim) anims[built.anim.kind] = built.anim;
    if (built.pumps) {
      // gas pump positions (world coords) for the explosion hazard in combat.js
      const gas = world.landmarks.find((l) => l.id === 'gas');
      if (gas) gas.pumps = built.pumps;
    }
  }
  // the rollercoaster is not a building — it lives in the park
  const coaster = buildCoaster(M, T, null);
  group.add(coaster.group);
  anims.coaster = coaster.anim;
  return { group, anims };
}

// Per-frame landmark animation: coaster cars ride the loop, the airport
// beacon sweeps, the police roof bar alternates red/blue.
export function updateLandmarks(anims, time, dt) {
  if (anims.coaster) {
    const c = anims.coaster;
    for (let i = 0; i < c.cars.length; i++) {
      c.t[i] = (c.t[i] + dt * 0.018) % 1;
      const p = c.curve.getPointAt(c.t[i]);
      const tan = c.curve.getTangentAt(c.t[i]);
      c.cars[i].position.set(p.x, p.y + 4.5, p.z);
      c.cars[i].lookAt(p.x + tan.x, p.y + tan.y + 4.5, p.z + tan.z);
    }
  }
  if (anims.airportBeacon) {
    anims.airportBeacon.beam.rotation.y = time * 1.2;
  }
  if (anims.policeBar) {
    const ph = Math.floor(time * 7) % 2 === 0;
    anims.policeBar.redMat.emissiveIntensity = ph ? 2.6 : 0.25;
    anims.policeBar.blueMat.emissiveIntensity = ph ? 0.25 : 2.6;
  }
}

// Nearest landmark to a point (within 220 units), for HUD toasts + minimap.
export function nearestLandmark(world, x, y) {
  let best = null, bd = Infinity;
  for (const lm of world.landmarks || []) {
    const d = Math.hypot(x - lm.cx, y - lm.cy);
    if (d < bd) { bd = d; best = lm; }
  }
  return best && bd < 220 ? { ...best, dist: bd } : null;
}
