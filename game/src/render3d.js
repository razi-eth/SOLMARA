// render3d.js — SOLMARA 3D: the Three.js renderer.
// Chase camera (GTA-style, behind the player/car), day/night cycle with a real
// sun + shadows, merged static city, per-frame sync of every moving thing
// (cars, people, bullets, particles, cash, beacon, skids), headlights, and a
// 2D post pass (colour grade, vignette, film grain) on the HUD canvas.
import * as THREE from 'three';
import { buildCity3D } from './city3d.js';
import { makeCarMesh, makePersonMesh, getTextures } from './meshes.js';
import { initHeli, updateHeli } from './heli.js';
import { clamp, lerp } from './random.js';

// My own day/night stops: hour -> sun height, darkness, lamp level, sky colours.
const DAY_STOPS = [
  { h: 0,  elev: -28, dark: 0.66, lamp: 1.0, top: 0x0a1230, mid: 0x1a2440, bot: 0x0a0f22, fog: 0x0d1428 },
  { h: 5,  elev: -10, dark: 0.55, lamp: 1.0, top: 0x141a44, mid: 0x2a2a55, bot: 0x1a1430, fog: 0x181830 },
  { h: 7,  elev: 14,  dark: 0.16, lamp: 0.30, top: 0x4a7fd9, mid: 0xffb37a, bot: 0xffd9a0, fog: 0xd9a080 },
  { h: 10, elev: 55,  dark: 0.0,  lamp: 0.0, top: 0x2a6fd9, mid: 0x9fd4ff, bot: 0xffe9b0, fog: 0xbfe0f0 },
  { h: 15, elev: 48,  dark: 0.0,  lamp: 0.0, top: 0x2a6fd9, mid: 0x9fd4ff, bot: 0xffe9b0, fog: 0xbfe0f0 },
  { h: 18, elev: 9,   dark: 0.22, lamp: 0.45, top: 0x3a5fb8, mid: 0xff9a5c, bot: 0xffd9a0, fog: 0xd98a60 },
  { h: 20, elev: -8,  dark: 0.50, lamp: 1.0, top: 0x141a44, mid: 0x3a2a66, bot: 0x241a3a, fog: 0x1a1630 },
  { h: 22, elev: -28, dark: 0.66, lamp: 1.0, top: 0x0a1230, mid: 0x1a2440, bot: 0x0a0f22, fog: 0x0d1428 },
];

function dayState(hour) {
  let a = DAY_STOPS[DAY_STOPS.length - 1], b = DAY_STOPS[0];
  for (let i = 0; i < DAY_STOPS.length - 1; i++) {
    if (hour >= DAY_STOPS[i].h && hour < DAY_STOPS[i + 1].h) { a = DAY_STOPS[i]; b = DAY_STOPS[i + 1]; break; }
  }
  const span = (b.h - a.h + 24) % 24 || 24;
  const t = clamp(((hour - a.h + 24) % 24) / span, 0, 1);
  const mix = (ca, cb) => new THREE.Color(ca).lerp(new THREE.Color(cb), t);
  const azim = ((hour - 6) / 12) * Math.PI; // east at 06:00, west at 18:00
  const elev = lerp(a.elev, b.elev, t) * Math.PI / 180;
  return {
    dark: lerp(a.dark, b.dark, t),
    lamp: lerp(a.lamp, b.lamp, t),
    elev, azim,
    sunDir: new THREE.Vector3(
      Math.cos(elev) * Math.cos(azim),
      Math.sin(elev),
      Math.cos(elev) * Math.sin(azim) * 0.6 + 0.25,
    ).normalize(),
    skyTop: mix(a.top, b.top), skyMid: mix(a.mid, b.mid), skyBot: mix(a.bot, b.bot),
    fog: mix(a.fog, b.fog),
  };
}

function isSoftwareGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    return /swiftshader|llvmpipe|software|softpipe|basic render/i.test(String(name));
  } catch (e) { return true; }
}

// Soft round particle shader (per-point size + colour, circular falloff).
function pointsMaterial(additive) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { map: { value: getTextures().glowWhite } },
    vertexShader: `
      attribute float psize;
      attribute vec3 pcolor;
      varying vec3 vColor;
      void main() {
        vColor = pcolor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * (420.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      varying vec3 vColor;
      void main() {
        vec4 tex = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(vColor, tex.a);
        if (gl_FragColor.a < 0.03) discard;
      }`,
  });
}

function makePointsSystem(max, additive) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geo.setAttribute('pcolor', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geo.setAttribute('psize', new THREE.BufferAttribute(new Float32Array(max), 1));
  geo.setDrawRange(0, 0);
  const points = new THREE.Points(geo, pointsMaterial(additive));
  points.frustumCulled = false;
  return points;
}

const MAXP = 320;

export function initRender3D(game) {
  const glCanvas = document.getElementById('gl');
  const software = isSoftwareGL();
  const renderer = new THREE.WebGLRenderer({
    canvas: glCanvas, antialias: !software, powerPreference: 'high-performance',
  });
  renderer.setSize(1280, 800, false);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbfe0f0, 700, 2600);
  const camera = new THREE.PerspectiveCamera(62, 1280 / 800, 1, 7000);

  // lights
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.4);
  sun.castShadow = !software;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -380; sun.shadow.camera.right = 380;
  sun.shadow.camera.top = 380; sun.shadow.camera.bottom = -380;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 2600;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x9fd4ff, 0x3a4a2a, 0.75);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8aa8ff, 0.0);
  moon.position.set(-400, 800, -300);
  scene.add(moon);
  scene.add(moon.target);
  const headSpot = new THREE.SpotLight(0xffe9a8, 0, 420, 0.62, 0.45, 1.2);
  scene.add(headSpot);
  scene.add(headSpot.target);
  const playerGlow = new THREE.PointLight(0xffe9a8, 0, 150, 1.6);
  scene.add(playerGlow);

  // city
  const city = buildCity3D(game.world);
  scene.add(city.group);

  // dynamic pools
  const carMeshes = new Map();
  const peopleMeshes = new Map();
  const bulletGeo = new THREE.BoxGeometry(11, 1.1, 1.1);
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa });
  const bullets = [];
  for (let i = 0; i < 32; i++) {
    const m = new THREE.Mesh(bulletGeo, bulletMat);
    m.visible = false;
    scene.add(m);
    bullets.push(m);
  }
  const cashGeo = new THREE.BoxGeometry(9, 4, 6);
  const cashMat = new THREE.MeshStandardMaterial({ color: 0x2a7a3a, emissive: 0x1a5a2a, emissiveIntensity: 0.7, roughness: 0.6 });
  const cashMeshes = [];
  for (let i = 0; i < 20; i++) {
    const m = new THREE.Mesh(cashGeo, cashMat);
    m.visible = false;
    scene.add(m);
    cashMeshes.push(m);
  }
  const skidGeo = new THREE.PlaneGeometry(1, 1);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x0a0a10, transparent: true, opacity: 0.5, depthWrite: false });
  const skids = [];
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(skidGeo, skidMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    skids.push(m);
  }
  // mission beacon: light pillar + pulsing ring
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffe93c, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 300, 12, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffe93c, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
  });
  const beaconRing = new THREE.Mesh(new THREE.RingGeometry(20, 27, 32), ringMat);
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.visible = false;
  scene.add(beaconRing);
  // shop marker: green pillar + ring (the gun shop)
  const shopBeacon = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7, 220, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x3aff7a, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  shopBeacon.visible = false;
  scene.add(shopBeacon);
  // particles: two point systems (additive fire/sparks, normal smoke/blood)
  const firePts = makePointsSystem(MAXP, true);
  const smokePts = makePointsSystem(MAXP, false);
  scene.add(firePts);
  scene.add(smokePts);

  // 2D post overlay (drawn on the HUD canvas before the HUD itself)
  const vig = document.createElement('canvas');
  vig.width = 1280; vig.height = 800;
  const vx = vig.getContext('2d');
  const vg = vx.createRadialGradient(640, 400, 300, 640, 400, 820);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  vx.fillStyle = vg;
  vx.fillRect(0, 0, 1280, 800);
  const grain = document.createElement('canvas');
  grain.width = 128; grain.height = 128;
  const gg = grain.getContext('2d');
  const img = gg.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 22;
  }
  gg.putImageData(img, 0, 0);

  // helicopter
  initHeli(scene);

  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();

  game.render3d = {
    renderer, scene, camera, sun, hemi, moon, headSpot, playerGlow, city,
    carMeshes, peopleMeshes, bullets, cashMeshes, skids, beacon, beaconRing,
    shopBeacon, firePts, smokePts, vig, grain, raycaster, groundPlane, ndc,
    software, camYaw: -Math.PI / 2, camDist: 60, camHeight: 26,
  };
  game.tod = dayState(game.clock);
  return game.render3d;
}

function syncCar(R, car, dt, time) {
  let mesh = R.carMeshes.get(car);
  if (!mesh) {
    mesh = makeCarMesh(car);
    R.scene.add(mesh);
    R.carMeshes.set(car, mesh);
  }
  mesh.position.set(car.x, 0, car.y);
  mesh.rotation.y = -car.angle;
  // wheels spin
  const spin = (car.speed || 0) * dt / 4.4;
  for (const w of mesh.userData.wheels) w.rotation.z -= spin;
  // police light bar flash
  if (car.type === 'police' && mesh.userData.lightRed) {
    const ph = Math.floor(time * 7 + (car.sirenPhase || 0)) % 2 === 0;
    mesh.userData.lightRed.material.emissiveIntensity = ph ? 2.6 : 0.25;
    mesh.userData.lightBlue.material.emissiveIntensity = ph ? 0.25 : 2.6;
  }
  return mesh;
}

function syncPerson(R, e, shirt, skin, armed, isPlayer) {
  let mesh = R.peopleMeshes.get(e);
  if (!mesh) {
    mesh = makePersonMesh(shirt, skin);
    R.scene.add(mesh);
    R.peopleMeshes.set(e, mesh);
  }
  mesh.position.set(e.x, Math.abs(Math.sin(e.walkPhase || 0)) * (e.moving ? 1.6 : 0.9), e.y);
  mesh.rotation.y = -e.angle;
  mesh.rotation.z = e.moving ? Math.sin(e.walkPhase || 0) * 0.05 : 0;
  mesh.userData.gun.visible = !!armed;
  return mesh;
}

function writePoints(points, list, wantAdditive) {
  const pos = points.geometry.attributes.position.array;
  const col = points.geometry.attributes.pcolor.array;
  const siz = points.geometry.attributes.psize.array;
  let n = 0;
  const c = new THREE.Color();
  for (const p of list) {
    if (n >= MAXP) break;
    const isAdd = p.kind === 'fire' || p.kind === 'spark' || p.kind === 'flash' || p.kind === 'ring';
    if (isAdd !== wantAdditive) continue;
    const a = clamp(p.life / p.maxLife, 0, 1);
    c.set(p.color);
    pos[n * 3] = p.x; pos[n * 3 + 1] = 12 + (p.kind === 'smoke' ? (1 - a) * 30 : 0); pos[n * 3 + 2] = p.y;
    col[n * 3] = c.r; col[n * 3 + 1] = c.g; col[n * 3 + 2] = c.b;
    siz[n] = p.kind === 'smoke' ? p.size * 2.2 : p.size * (0.5 + a);
    n++;
  }
  points.geometry.setDrawRange(0, n);
  points.geometry.attributes.position.needsUpdate = true;
  points.geometry.attributes.pcolor.needsUpdate = true;
  points.geometry.attributes.psize.needsUpdate = true;
}

export function render3D(game, dt) {
  const R = game.render3d;
  const p = game.player;
  const tod = dayState(game.clock);
  game.tod = tod;
  const time = game.time;

  // ---------- sun / sky / fog ----------
  const sunUp = tod.sunDir.y > 0.02;
  R.sun.intensity = sunUp ? 1.6 + (1 - tod.dark) * 1.1 : 0.12;
  R.sun.color.set(tod.dark > 0.4 ? 0x9fb8ff : 0xfff2cc);
  const focusX = p.x, focusZ = p.y;
  R.sun.position.set(focusX + tod.sunDir.x * 900, Math.max(120, tod.sunDir.y * 900 + 200), focusZ + tod.sunDir.z * 900);
  R.sun.target.position.set(focusX, 0, focusZ);
  R.hemi.intensity = 0.85 - tod.dark * 0.45;
  R.hemi.color.set(tod.dark > 0.4 ? 0x2a3a66 : 0x9fd4ff);
  R.hemi.groundColor.set(tod.dark > 0.4 ? 0x1a1a22 : 0x3a4a2a);
  R.moon.intensity = tod.dark > 0.4 ? 0.5 : 0.0;
  R.scene.fog.color.copy(tod.fog);
  R.scene.fog.near = 650 - tod.dark * 150;
  R.scene.fog.far = 2500 - tod.dark * 500;
  R.city.skyMat.uniforms.top.value.copy(tod.skyTop);
  R.city.skyMat.uniforms.mid.value.copy(tod.skyMid);
  R.city.skyMat.uniforms.bot.value.copy(tod.skyBot);
  R.city.stars.material.opacity = clamp((tod.dark - 0.35) * 1.6, 0, 0.9);
  for (const sp of R.city.lampGlows) sp.material.opacity = tod.lamp * 0.5;
  // water shimmer
  R.city.waterMat.map.offset.x = time * 0.008;
  R.city.waterMat.map.offset.y = time * 0.004;
  // ferris wheel turns
  R.city.ferris.userData.wheel.rotation.z = time * 0.12;

  // ---------- camera ----------
  const cam = game.camera;
  let targetYaw, dist, height, lookAhead;
  if (game.state === 'menu') {
    const orbit = time * 0.045;
    const cx = cam.x, cz = cam.y;
    R.camera.position.set(cx + Math.cos(orbit) * 620, 250, cz + Math.sin(orbit) * 620);
    R.camera.lookAt(cx, 20, cz);
  } else {
    const heading = p.onFoot ? p.aimAngle : p.angle;
    // smooth yaw with wrap-around
    let diff = heading - R.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    R.camYaw += diff * Math.min(1, dt * 3.2);
    dist = p.onFoot ? 52 : 66;
    height = p.onFoot ? 24 : 28;
    lookAhead = p.onFoot ? 26 : 46;
    R.camDist = lerp(R.camDist, dist, Math.min(1, dt * 2));
    R.camHeight = lerp(R.camHeight, height, Math.min(1, dt * 2));
    const fx = Math.cos(R.camYaw), fz = Math.sin(R.camYaw);
    const shx = (Math.random() - 0.5) * game.shake;
    const shy = (Math.random() - 0.5) * game.shake;
    R.camera.position.set(
      focusX - fx * R.camDist + shx,
      R.camHeight + shy * 0.4,
      focusZ - fz * R.camDist,
    );
    R.camera.lookAt(focusX + fx * lookAhead, 12, focusZ + fz * lookAhead);
  }
  game.shake = Math.max(0, game.shake - 0.6);

  // ---------- sync cars ----------
  const seenCars = new Set();
  for (const car of game.cars) {
    syncCar(R, car, dt, time);
    seenCars.add(car);
  }
  for (const [car, mesh] of [...R.carMeshes]) {
    if (!seenCars.has(car)) {
      R.scene.remove(mesh);
      if (mesh.userData.paint) mesh.userData.paint.dispose();
      R.carMeshes.delete(car);
    }
  }

  // ---------- sync people ----------
  const seenPeople = new Set();
  for (const pd of game.peds) {
    syncPerson(R, pd, pd.shirt, pd.skin, false, false);
    seenPeople.add(pd);
  }
  for (const cp of game.cops) {
    syncPerson(R, cp, '#1a3a8a', '#e8b88a', true, false);
    seenPeople.add(cp);
  }
  for (const e of game.enemies) {
    syncPerson(R, e, e.shirt, e.skin, true, false);
    seenPeople.add(e);
  }
  if (p.onFoot && !p.dead) {
    syncPerson(R, p, '#e8e8e8', '#e8b88a', true, true);
    seenPeople.add(p);
  }
  for (const [e, mesh] of [...R.peopleMeshes]) {
    if (!seenPeople.has(e)) {
      R.scene.remove(mesh);
      R.peopleMeshes.delete(e);
    }
  }

  // ---------- bullets / cash / skids ----------
  for (let i = 0; i < R.bullets.length; i++) {
    const m = R.bullets[i];
    const b = game.bullets[i];
    if (!b) { m.visible = false; continue; }
    m.visible = true;
    m.position.set(b.x, 13, b.y);
    m.rotation.y = -b.angle;
  }
  for (let i = 0; i < R.cashMeshes.length; i++) {
    const m = R.cashMeshes[i];
    const c = game.cash[i];
    if (!c) { m.visible = false; continue; }
    m.visible = true;
    m.position.set(c.x, 3 + Math.sin(time * 3 + c.bob) * 1.5, c.y);
    m.rotation.y = time * 1.5;
  }
  for (let i = 0; i < R.skids.length; i++) {
    const m = R.skids[i];
    const s = game.skids[i];
    if (!s) { m.visible = false; continue; }
    m.visible = true;
    m.position.set(s.x, 0.55, s.y);
    m.rotation.z = -s.angle;
    m.scale.set(s.w, 5, 1);
    m.material.opacity = clamp(s.life / 9, 0, 1) * 0.5;
  }

  // ---------- mission beacon + shop marker ----------
  const target = game.missionTarget ? game.missionTarget() : null;
  if (target) {
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    R.beacon.visible = true;
    R.beacon.position.set(target.x, 150, target.y);
    R.beaconRing.visible = true;
    R.beaconRing.position.set(target.x, 0.7, target.y);
    R.beaconRing.scale.set(pulse, pulse, 1);
  } else {
    R.beacon.visible = false;
    R.beaconRing.visible = false;
  }
  if (game.shopPos) {
    R.shopBeacon.visible = true;
    R.shopBeacon.position.set(game.shopPos.x, 110, game.shopPos.y);
  }

  // ---------- particles ----------
  writePoints(R.firePts, game.particles, true);
  writePoints(R.smokePts, game.particles, false);

  // ---------- helicopter ----------
  updateHeli(game, dt, R);

  // ---------- headlight + player glow ----------
  if (tod.dark > 0.25) {
    if (!p.onFoot && p.car) {
      const fx = Math.cos(p.car.angle), fz = Math.sin(p.car.angle);
      R.headSpot.position.set(p.car.x + fx * 20, 12, p.car.y + fz * 20);
      R.headSpot.target.position.set(p.car.x + fx * 320, 2, p.car.y + fz * 320);
      R.headSpot.intensity = 260;
    } else {
      R.headSpot.intensity = 0;
    }
    R.playerGlow.position.set(p.x, 16, p.y);
    R.playerGlow.intensity = 26;
  } else {
    R.headSpot.intensity = 0;
    R.playerGlow.intensity = 0;
  }

  // ---------- draw ----------
  R.renderer.render(R.scene, R.camera);

  // ---------- 2D post pass on the HUD canvas (before the HUD itself) ----------
  const ctx = game.ctx;
  ctx.clearRect(0, 0, 1280, 800);
  ctx.save();
  ctx.globalAlpha = tod.dark > 0.3 ? 0.16 : 0.10;
  ctx.fillStyle = '#' + tod.skyBot.getHexString();
  ctx.fillRect(0, 0, 1280, 800);
  ctx.globalAlpha = 1;
  // sun glare
  if (tod.dark < 0.25 && tod.sunDir.y > 0.05) {
    const gx = tod.sunDir.x > 0 ? 1060 : 220;
    const grad = ctx.createRadialGradient(gx, 90, 10, gx, 90, 300);
    grad.addColorStop(0, 'rgba(255,230,160,0.30)');
    grad.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(gx - 300, -210, 600, 600);
  }
  ctx.drawImage(R.vig, 0, 0);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(R.grain, 'repeat');
  ctx.fillRect(0, 0, 1280, 800);
  ctx.restore();

  // ---------- screen -> world (mouse aim): raycast to the ground plane ----------
  game.screenToWorld = (sx, sy) => {
    R.ndc.set((sx / 1280) * 2 - 1, -(sy / 800) * 2 + 1);
    R.raycaster.setFromCamera(R.ndc, R.camera);
    const hit = new THREE.Vector3();
    if (R.raycaster.ray.intersectPlane(R.groundPlane, hit)) {
      return { x: hit.x, y: hit.z };
    }
    return { x: p.x + Math.cos(R.camYaw) * 100, y: p.y + Math.sin(R.camYaw) * 100 };
  };
}
