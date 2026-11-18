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
// Returns { map, emissive }: the emissive canvas holds ONLY the lit windows, so
// at night the windows glow on their own (emissiveMap) instead of being baked
// into the diffuse map — the city lights up after dark, realistically.
function facadeTexture(base, lit) {
  const [c, g] = makeCanvas(256, 256);
  const [ec, eg] = makeCanvas(256, 256);
  eg.fillStyle = '#000000'; eg.fillRect(0, 0, 256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  // subtle vertical grime streaks + a warm gradient wash (sun-bleached top)
  for (let i = 0; i < 26; i++) {
    g.fillStyle = 'rgba(0,0,0,0.05)';
    const x = Math.random() * 256;
    g.fillRect(x, 0, 3 + Math.random() * 6, 256);
  }
  const wash = g.createLinearGradient(0, 0, 0, 256);
  wash.addColorStop(0, 'rgba(255,255,255,0.10)');
  wash.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = wash; g.fillRect(0, 0, 256, 256);
  // ground-floor shopfront band (dark glass + awning strip)
  g.fillStyle = '#1c222e'; g.fillRect(0, 228, 256, 28);
  g.fillStyle = 'rgba(255,210,120,0.25)'; g.fillRect(0, 226, 256, 2);
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
      if (isLit) {
        // same window on the emissive canvas: warm glow, brighter at its core
        eg.fillStyle = lit; eg.fillRect(x, y, 34, 20);
        eg.fillStyle = 'rgba(255,255,255,0.55)'; eg.fillRect(x + 4, y + 3, 26, 6);
      }
    }
  }
  return { map: canvasTexture(c, 1 / 26, 1 / 26), emissive: canvasTexture(ec, 1 / 26, 1 / 26) };
}

function roofTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#8a7f74'; g.fillRect(0, 0, 128, 128);
  // weathered patches: sun-bleached centre, dark damp edges
  const rg = g.createRadialGradient(64, 64, 8, 64, 64, 90);
  rg.addColorStop(0, 'rgba(255,255,255,0.08)');
  rg.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 6, 6);
  }
  // a few pale gravel specks for a lived-in roof
  for (let i = 0; i < 90; i++) {
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
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
    // worn patches + dark oil stains near the lane centre (roads look driven-on)
    for (let i = 0; i < 7; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 14 + Math.random() * 26;
      const og = g.createRadialGradient(x, y, 2, x, y, r);
      og.addColorStop(0, 'rgba(10,10,14,0.30)');
      og.addColorStop(1, 'rgba(10,10,14,0)');
      g.fillStyle = og;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // faint tyre-polish bands along the driving line
    g.fillStyle = 'rgba(0,0,0,0.07)';
    g.fillRect(70, 0, 26, 256);
    g.fillRect(160, 0, 26, 256);
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
    // Facade variants: two extra palettes per district so neighbouring blocks
    // never share the same face — the generic buildings read as different
    // buildings, not clones. Variant 0 is the original texture above.
    facadeDowntown2: facadeTexture('#8a9ab8', '#cfe8ff'),
    facadeDowntown3: facadeTexture('#b85c5c', '#ffd97a'),
    facadeOld2: facadeTexture('#c96f4a', '#ffd97a'),
    facadeOld3: facadeTexture('#d9d9a8', '#ffe9a8'),
    facadeInd2: facadeTexture('#8a6a4a', '#ffd97a'),
    facadeInd3: facadeTexture('#7a8a7a', '#cfe8ff'),
    facadeRes2: facadeTexture('#f2f2f2', '#ffe9a8'),
    facadeRes3: facadeTexture('#a8c8d9', '#ffe9a8'),
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
// Facade materials carry an emissiveMap (lit windows only) so the city glows
// after dark; render3d.js drives their emissiveIntensity from the lamp level.
let MAT = null;
export function getMaterials() {
  if (MAT) return MAT;
  const T = getTextures();
  const facadeMat = (f) => new THREE.MeshStandardMaterial({
    map: f.map, emissiveMap: f.emissive, emissive: 0xffc46a,
    emissiveIntensity: 0.15, roughness: 0.85, metalness: 0.05,
    envMapIntensity: 0.35,
  });
  MAT = {
    roof: new THREE.MeshStandardMaterial({ map: T.roof, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.2 }),
    facadeDowntown: facadeMat(T.facadeDowntown),
    facadeOld: facadeMat(T.facadeOld),
    facadeInd: facadeMat(T.facadeInd),
    facadeRes: facadeMat(T.facadeRes),
    // Per-district facade variants (3 each) for the merged city pass.
    facadeVariantMats: {
      downtown: [facadeMat(T.facadeDowntown), facadeMat(T.facadeDowntown2), facadeMat(T.facadeDowntown3)],
      oldtown: [facadeMat(T.facadeOld), facadeMat(T.facadeOld2), facadeMat(T.facadeOld3)],
      industrial: [facadeMat(T.facadeInd), facadeMat(T.facadeInd2), facadeMat(T.facadeInd3)],
      residential: [facadeMat(T.facadeRes), facadeMat(T.facadeRes2), facadeMat(T.facadeRes3)],
    },
    asphalt: new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.5 }),
    sidewalk: new THREE.MeshStandardMaterial({ map: T.sidewalk, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.25 }),
    grass: new THREE.MeshStandardMaterial({ map: T.grass, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.15 }),
    sand: new THREE.MeshStandardMaterial({ map: T.sand, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.3 }),
    water: makeWaterMaterial(),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x2a4a66, roughness: 0.06, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.6 }),
    glassDowntown: new THREE.MeshPhysicalMaterial({ color: 0x7fb8d8, roughness: 0.05, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.05, emissive: 0x1a3a55, emissiveIntensity: 0.35, envMapIntensity: 1.6 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1.0, envMapIntensity: 0.2 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3f9e4d, roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.25 }),
    leafDry: new THREE.MeshStandardMaterial({ color: 0x6fae4a, roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.25 }),
    pole: new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.6, envMapIntensity: 0.6 }),
    lampHead: new THREE.MeshStandardMaterial({ color: 0x444a55, roughness: 0.5, metalness: 0.5, emissive: 0xffe9a8, emissiveIntensity: 0.9 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95, envMapIntensity: 0.3 }),
    hub: new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.9, envMapIntensity: 1.0 }),
    pierWood: new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.95, envMapIntensity: 0.25 }),
    ferris: new THREE.MeshStandardMaterial({ color: 0xff5a7a, roughness: 0.5, metalness: 0.3, emissive: 0x881133, emissiveIntensity: 0.4 }),
    ferrisCabin: new THREE.MeshStandardMaterial({ color: 0xffe93c, roughness: 0.5, metalness: 0.2 }),
  };
  return MAT;
}

// ---------- ocean: animated shader water ----------
// Vertex waves + fresnel (sky colour at grazing angles) + a sun glint + foam
// near the shore. Replaces the flat scrolling texture: the sea now reads as
// water, and at sunset it catches the sun.
export function makeWaterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 },
      sunDir: { value: new THREE.Vector3(0.6, 0.5, 0.3) },
      sunColor: { value: new THREE.Color(0xfff2cc) },
      deep: { value: new THREE.Color(0x0d5a80) },
      shallow: { value: new THREE.Color(0x2fa8c9) },
      sky: { value: new THREE.Color(0x9fd4ff) },
      fogColor: { value: new THREE.Color(0xbfe0f0) },
      fogNear: { value: 700 },
      fogFar: { value: 2600 },
    },
    vertexShader: `
      uniform float time;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying float vWave;
      void main() {
        vec3 p = position;
        // two travelling sine waves + a chop term, in world XZ after the mesh rotation
        float w1 = sin(p.x * 0.045 + time * 1.1) * 1.6;
        float w2 = sin(p.y * 0.06 - time * 0.8) * 1.1;
        float w3 = sin((p.x + p.y) * 0.11 + time * 1.9) * 0.5;
        p.z += w1 + w2 + w3;
        vWave = w1 + w2 + w3;
        vNormal = normalize(vec3(
          cos(p.x * 0.045 + time * 1.1) * 0.072,
          cos(p.y * 0.06 - time * 0.8) * 0.066,
          1.0));
        vPos = (modelMatrix * vec4(p, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform vec3 deep;
      uniform vec3 shallow;
      uniform vec3 sky;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      uniform float time;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying float vWave;
      void main() {
        vec3 V = normalize(cameraPosition - vPos);
        vec3 N = normalize(vNormal);
        float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
        vec3 col = mix(deep, shallow, clamp(vWave * 0.22 + 0.45, 0.0, 1.0));
        col = mix(col, sky, fres * 0.65);
        // sun glint: sparkle where the wave normal faces the sun
        vec3 R = reflect(-normalize(sunDir), N);
        float glint = pow(max(dot(R, V), 0.0), 90.0);
        col += sunColor * glint * 1.4;
        // foam streaks near the shore (west edge, x < 2560) and wave crests
        float foam = smoothstep(0.85, 1.0, sin(vPos.x * 0.12 + time * 1.4) * sin(vPos.z * 0.09 - time * 1.1));
        float shore = 1.0 - smoothstep(2540.0, 2620.0, vPos.x);
        col = mix(col, vec3(0.85, 0.96, 0.96), clamp(foam * 0.35 + shore * 0.45, 0.0, 0.7));
        float fogF = smoothstep(fogNear, fogFar, length(cameraPosition - vPos));
        col = mix(col, fogColor, fogF);
        gl_FragColor = vec4(col, 0.96);
      }`,
  });
}

// ---------- environment map: procedural sky in a PMREM ----------
// Gives every PBR material (car paint, glass, windows, wet asphalt) something
// real to reflect — the single biggest realism win for the whole scene.
// Built once from a gradient sky dome with a sun disc, then reused.
export function makeEnvironmentMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const skyGeo = new THREE.SphereGeometry(100, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x2a6fd9) },
      mid: { value: new THREE.Color(0x9fd4ff) },
      bot: { value: new THREE.Color(0xffe9b0) },
      sunDir: { value: new THREE.Vector3(0.55, 0.62, 0.45).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, h))
                          : mix(bot, mid, smoothstep(-0.08, 0.25, h));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += vec3(1.0, 0.85, 0.55) * pow(s, 350.0) * 3.0; // sun disc
        c += vec3(1.0, 0.75, 0.4) * pow(s, 8.0) * 0.35;   // haze around the sun
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  envScene.add(new THREE.Mesh(skyGeo, skyMat));
  // a dark ground disc so reflections from below stay grounded
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(100, 24),
    new THREE.MeshBasicMaterial({ color: 0x2a2f22 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -20;
  envScene.add(ground);
  const tex = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return tex.texture;
}

export function paintMaterial(hex) {
  // Clearcoat car paint: a hard glossy top layer over the colour, like real
  // automotive paint — reflections stay sharp instead of going dull.
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex), roughness: 0.28, metalness: 0.55,
    clearcoat: 1.0, clearcoatRoughness: 0.08,
    envMapIntensity: 1.4,
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

// Pitched roof: a triangular prism sitting on a building's top cap.
// roofY is the top of the walls; the ridge runs along the building's depth
// so the silhouette reads as a house, not a flat box.
export function pitchedRoofGeometry(b, roofY) {
  const w = b.w, d = b.h, h = 10 + Math.min(8, b.w * 0.06);
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, steps: 1, bevelEnabled: false });
  geo.translate(b.x + b.w / 2, roofY, b.y + b.h / 2 - d / 2);
  return geo;
}

export function roofPropGeometry(b) {
  // rooftop clutter for silhouette variety: AC units, water tank, vent pipes.
  // A bare flat roof reads as a box; clutter reads as a building.
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
    // AC fan: a flat dark cylinder on top of the unit
    const fan = new THREE.CylinderGeometry(rw * 0.32, rw * 0.32, 1.2, 10);
    fan.translate(b.x + b.w / 2 + ox, h + 5.6, b.y + b.h / 2 + oz);
    geos.push(fan);
  }
  // cylindrical water tank on wider roofs
  if (b.w > 60 && b.h > 60) {
    const tank = new THREE.CylinderGeometry(5, 5, 9, 10);
    tank.translate(b.x + b.w / 2 - b.w * 0.28, h + 4.5, b.y + b.h / 2 - b.h * 0.26);
    geos.push(tank);
    const cap = new THREE.ConeGeometry(5.4, 3, 10);
    cap.translate(b.x + b.w / 2 - b.w * 0.28, h + 10.5, b.y + b.h / 2 - b.h * 0.26);
    geos.push(cap);
  }
  // vent pipes
  for (let i = 0; i < 2; i++) {
    const vent = new THREE.CylinderGeometry(1.1, 1.1, 6, 6);
    vent.translate(
      b.x + b.w / 2 + (i === 0 ? -1 : 1) * b.w * 0.32,
      h + 3, b.y + b.h / 2 + (i === 0 ? 1 : -1) * b.h * 0.3);
    geos.push(vent);
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
  // 5-spoke alloy rim: a hub disc + 5 spokes, so wheels read as alloy, not discs
  const spokes = [];
  const rim = new THREE.CylinderGeometry(3.1, 3.1, 3.5, 12);
  rim.rotateX(Math.PI / 2);
  spokes.push(rim);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = new THREE.BoxGeometry(5.4, 1.3, 3.6);
    sp.rotateZ(a);
    sp.translate(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0);
    spokes.push(sp);
  }
  const hub = mergeGeometries(spokes, false);
  // merge with groups: tire material 0, hub material 1
  const merged = mergeGeometries([tire, hub], false);
  merged.groups.length = 0;
  merged.addGroup(0, tire.index.count, 0);
  merged.addGroup(tire.index.count, hub.index.count, 1);
  WHEEL_GEO = merged;
  return merged;
}

// License plate: small white plate with a dark "SOL-482" style code.
function plateTexture(code) {
  const [c, g] = makeCanvas(64, 16);
  g.fillStyle = '#f2f2e8'; g.fillRect(0, 0, 64, 16);
  g.strokeStyle = '#1a2a66'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 14);
  g.fillStyle = '#1a2a66';
  g.font = '900 11px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(code, 32, 9);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  group.userData.tailLeft = tl;
  group.userData.tailRight = tl2;
  // license plates (front + rear) with the car's own plate code
  const plateMat = new THREE.MeshStandardMaterial({
    map: plateTexture(car.plate || 'SOL-482'), roughness: 0.4, metalness: 0.2,
  });
  const plateF = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.4), plateMat);
  plateF.position.set(car.w / 2 + 0.9, 4.6, 0);
  plateF.rotation.y = Math.PI / 2;
  group.add(plateF);
  const plateR = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.4), plateMat);
  plateR.position.set(-car.w / 2 - 0.9, 4.6, 0);
  plateR.rotation.y = -Math.PI / 2;
  group.add(plateR);
  // side mirrors
  const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.3, metalness: 0.7 });
  for (const z of [car.h / 2 + 0.6, -car.h / 2 - 0.6]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 1.2), mirrorMat);
    m.position.set(car.w * 0.18, 13.5, z);
    group.add(m);
  }
  // chrome window trim: a thin bright strip along the cabin base
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(car.w * 0.52, 0.7, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.15, metalness: 1.0, envMapIntensity: 1.6 }),
  );
  trim.position.set(-1, 11.8, car.h / 2 - 0.4);
  group.add(trim);
  const trim2 = trim.clone();
  trim2.position.z = -(car.h / 2 - 0.4);
  group.add(trim2);
  // headlight beams: two additive cones + a light pool on the road ahead.
  // Visible at night; render3d.js toggles them from the time of day.
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beams = [];
  for (const z of [car.h / 2 - 4.5, -(car.h / 2 - 4.5)]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(7, 55, 10, 1, true), beamMat);
    beam.rotation.z = Math.PI / 2 + 0.10; // apex at the headlight, opening forward-down
    beam.position.set(car.w / 2 + 28, 5.5, z);
    group.add(beam);
    beams.push(beam);
  }
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 34),
    new THREE.MeshBasicMaterial({
      map: getTextures().glowWarm, color: 0xffe9a8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(car.w / 2 + 42, 0.6, 0);
  group.add(pool);
  group.userData.beams = beams;
  group.userData.beamMat = beamMat;
  group.userData.lightPool = pool;
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

// ---------- people: articulated characters with real proportions ----------
// Total height ~27 units, head 1/7.3 of height, shoulders wider than waist,
// long legs, shaped shoes — a real human silhouette, not a capsule. Built as
// a Group of pivoted parts (head / arms / legs) so limbs can swing in a walk
// cycle and the gun sits in the right hand instead of floating beside the
// body. Static parts are merged per limb (torso / head / arm / leg) with
// material groups, so a character costs ~7 meshes instead of ~30 draw calls.
// Forward is local +X (same as cars): the group is rotated -angle in render3d.
const CHAR_MATS = new Map();
function charMat(hex, rough = 0.85, metal = 0) {
  const key = hex + '|' + rough + '|' + metal;
  let m = CHAR_MATS.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, metalness: metal, envMapIntensity: 0.3 });
    CHAR_MATS.set(key, m);
  }
  return m;
}
// Geometry placement helpers (geometries are translated into place, then merged).
function gBox(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }
function gCyl(rt, rb, h, x, y, z, seg = 10, open = false) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); g.translate(x, y, z); return g; }
function gSph(r, x, y, z, sx = 1, sy = 1, sz = 1) { const g = new THREE.SphereGeometry(r, 12, 10); g.scale(sx, sy, sz); g.translate(x, y, z); return g; }
function gCap(r, x, y, z, frac = 0.55) { const g = new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, frac * Math.PI); g.translate(x, y, z); return g; }
// Merge placed parts into one geometry with one material group per part.
// parts: [{ g, m }] where m is the index into the material array.
function mergeParts(parts) {
  const geo = mergeGeometries(parts.map((p) => p.g), false);
  geo.clearGroups();
  let off = 0;
  for (const p of parts) {
    const n = p.g.index.count;
    geo.addGroup(off, n, p.m);
    off += n;
  }
  return geo;
}

// Character dimensions (world units). Head ~1/7.3 of height, shoulders at
// ~22, hips at 11.5, feet on the ground at y=0. Gun height ~19.
export const CHAR_HEIGHT = 27;
export const CHAR_GUN_Y = 19;

// Look presets. kind drives the silhouette (woman: narrower shoulders, wider
// hips, bust; cop/gang/jax: uniform + jacket details). hair: short | long |
// ponytail | cap | bandana | copcap | bald.
export const JAX_LOOK = { kind: 'jax', skin: '#e8b88a', shirt: '#3a2a1a', jacket: '#3a2a1a', tee: '#f2f2f2', pants: '#2a4a8a', shoes: '#3a2a1a', hair: 'short', hairColor: '#1a1a1a', scale: 1.04 };
export const COP_LOOK = { kind: 'cop', skin: '#e8b88a', shirt: '#1a3a8a', jacket: '#1a3a8a', tee: '#1a3a8a', pants: '#16283a', shoes: '#111111', hair: 'copcap', hairColor: '#1a3a8a', scale: 1.0 };
export const GANG_LOOK = { kind: 'gang', skin: '#c98a5a', shirt: '#3a3f4a', jacket: '#3a3f4a', tee: '#c02020', pants: '#2a2f3a', shoes: '#1a1a1e', hair: 'bandana', hairColor: '#c02020', scale: 1.0 };
export const TAXI_LOOK = { kind: 'taxi', skin: '#8a5a34', shirt: '#f2c200', jacket: '#f2c200', tee: '#f2f2f2', pants: '#2a2f3a', shoes: '#1a1a1e', hair: 'cap', hairColor: '#1a1a1a', scale: 1.0 };
const PED_ARCH = [
  { kind: 'man', hair: 'short', shirt: '#2b6fd9', pants: '#2a4a8a' },
  { kind: 'woman', hair: 'long', shirt: '#f2a0c0', pants: '#2a2f3a' },
  { kind: 'man', hair: 'cap', shirt: '#3aa655', pants: '#3a3f4a' },
  { kind: 'woman', hair: 'ponytail', shirt: '#f2f2f2', pants: '#1a1a1a' },
  { kind: 'man', hair: 'bald', shirt: '#222831', pants: '#222831', jacket: '#222831', tee: '#f2f2f2' },
  { kind: 'woman', hair: 'short', shirt: '#e8b62b', pants: '#8a2fd9', dress: true },
  { kind: 'man', hair: 'bandana', shirt: '#d9382b', pants: '#2a2f3a' },
  { kind: 'woman', hair: 'long', shirt: '#c02020', pants: '#2a2f3a' },
];
const PED_SKINS = ['#e8b88a', '#c98a5a', '#8a5a34', '#f2c9a0'];
const PED_HAIR_COLORS = ['#1a1a1a', '#3a2a1a', '#6a4a2a', '#c9a227', '#8a8a8a'];
const PED_SHOES = ['#1a1a1e', '#3a2a1a', '#f2f2f2', '#8a2fd9'];
export function makePedLook(rng) {
  const r = rng || Math.random;
  const pick1 = (a) => a[Math.floor(r() * a.length)];
  const a = pick1(PED_ARCH);
  return {
    ...a,
    skin: pick1(PED_SKINS),
    hairColor: a.hair === 'bandana' ? '#c02020' : pick1(PED_HAIR_COLORS),
    shoes: pick1(PED_SHOES),
    scale: 0.94 + r() * 0.12,
  };
}

// Material slots: 0 skin, 1 shirt, 2 pants, 3 shoes, 4 hair, 5 dark,
// 6 jacket, 7 gold, 8 tee.
export function makeCharacter(look) {
  const L = { kind: 'man', skin: '#e8b88a', shirt: '#888888', pants: '#2a2f3a', shoes: '#1a1a1e', hair: 'short', hairColor: '#1a1a1a', scale: 1, ...look };
  const female = L.kind === 'woman';
  const longSleeve = L.kind === 'jax' || L.kind === 'cop' || L.kind === 'gang' || L.kind === 'taxi';
  const mats = [
    charMat(L.skin, 0.7),
    charMat(L.shirt, 0.85),
    charMat(L.pants, 0.9),
    charMat(L.shoes, 0.55, 0.3),
    charMat(L.hairColor, 0.9),
    charMat('#161616', 0.6),
    charMat(L.jacket || L.shirt, 0.8),
    charMat('#c9a227', 0.3, 0.9),
    charMat(L.tee || '#f2f2f2', 0.85),
  ];
  const group = new THREE.Group();
  const hipW = female ? 7.4 : 6.8;
  const shW = female ? 7.4 : 8.6;
  const chestTop = female ? 3.8 : 4.3;

  // ----- torso (merged): pelvis + waist + chest + shoulders + neck -----
  const torsoParts = [
    { g: gBox(4.4, 3, hipW, 0, 12.75, 0), m: 2 }, // pelvis
    { g: gCyl(3.4, 3.1, 3.5, 0, 15.75, 0), m: 1 }, // waist
    { g: gCyl(chestTop, 3.4, 4.2, 0, 19.2, 0), m: 1 }, // chest
    { g: gBox(4.4, 2.2, shW, 0, 21.4, 0), m: 1 }, // shoulders
    { g: gBox(0.7, 0.9, 3.2, 2.1, 22.4, 0), m: 1 }, // collar
    { g: gCyl(1.15, 1.3, 1.8, 0, 22.9, 0), m: 0 }, // neck
  ];
  if (female) {
    torsoParts.push({ g: gSph(1.15, 2.1, 19.8, -1.5, 0.9, 0.9, 1), m: 1 });
    torsoParts.push({ g: gSph(1.15, 2.1, 19.8, 1.5, 0.9, 0.9, 1), m: 1 });
  }
  if (L.dress) torsoParts.push({ g: gCyl(3.4, 5.4, 7, 0, 8.5, 0, 12, true), m: 1 });
  if (L.kind === 'jax' || L.kind === 'gang') {
    // open jacket: tee panel showing through the front, jacket collar
    torsoParts.push({ g: gBox(0.5, 6.5, 3.4, 2.3, 18.5, 0), m: 8 });
    torsoParts.push({ g: gBox(0.8, 1.1, 3.6, 2.2, 22.5, 0), m: 6 });
  }
  if (L.kind === 'cop') {
    torsoParts.push({ g: gBox(4.5, 1.1, 7, 0, 14.2, 0), m: 5 }); // duty belt
    torsoParts.push({ g: gBox(0.25, 1.2, 0.9, 2.35, 19.5, -1.7), m: 7 }); // badge
  }
  const torsoMesh = new THREE.Mesh(mergeParts(torsoParts), mats);
  torsoMesh.castShadow = true;
  group.add(torsoMesh);

  // ----- head (merged, pivots at the neck for idle look-around) -----
  const headParts = [
    { g: gSph(1.65, 0, 1.5, 0, 0.95, 1.12, 1.0), m: 0 }, // skull
    { g: gSph(1.15, 0, 0.7, 0.3, 0.85, 0.75, 0.9), m: 0 }, // jaw
    { g: gSph(0.26, 1.38, 1.75, -0.62), m: 5 }, // eyes
    { g: gSph(0.26, 1.38, 1.75, 0.62), m: 5 },
    { g: gBox(0.2, 0.18, 0.75, 1.45, 2.15, -0.62), m: 4 }, // brows
    { g: gBox(0.2, 0.18, 0.75, 1.45, 2.15, 0.62), m: 4 },
    { g: gBox(0.5, 0.9, 0.45, 1.5, 1.25, 0), m: 0 }, // nose
    { g: gBox(0.2, 0.16, 0.95, 1.42, 0.55, 0), m: 5 }, // mouth
    { g: gSph(0.4, 0, 1.5, -1.55, 1, 1, 0.5), m: 0 }, // ears
    { g: gSph(0.4, 0, 1.5, 1.55, 1, 1, 0.5), m: 0 },
  ];
  if (L.hair === 'short' || L.hair === 'long' || L.hair === 'ponytail') {
    headParts.push({ g: gCap(1.75, 0, 1.7, -0.15, 0.55), m: 4 });
  }
  if (L.hair === 'long') headParts.push({ g: gBox(1.1, 4.5, 3.3, -1.6, -0.5, 0), m: 4 });
  if (L.hair === 'ponytail') headParts.push({ g: gCyl(0.65, 0.45, 4.5, -1.9, -1.5, 0, 8), m: 4 });
  if (L.hair === 'cap') {
    headParts.push({ g: gCap(1.75, 0, 1.8, -0.1, 0.45), m: 4 });
    headParts.push({ g: gBox(1.9, 0.22, 2.8, 1.7, 2.5, 0), m: 4 });
  }
  if (L.hair === 'bandana') {
    headParts.push({ g: gCyl(1.72, 1.72, 0.9, 0, 2.5, 0, 12), m: 4 });
    headParts.push({ g: gBox(0.6, 0.8, 0.8, -1.7, 2.4, 0), m: 4 });
  }
  if (L.hair === 'copcap') {
    headParts.push({ g: gCyl(1.8, 1.85, 1.1, 0, 2.9, 0, 12), m: 6 });
    headParts.push({ g: gBox(1.6, 0.2, 2.6, 1.7, 2.5, 0), m: 5 });
    headParts.push({ g: gSph(0.28, 1.5, 3.0, 0), m: 7 });
  }
  const headMesh = new THREE.Mesh(mergeParts(headParts), mats);
  headMesh.castShadow = true;
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 23.8, 0);
  headGroup.add(headMesh);
  group.add(headGroup);

  // ----- arms (merged per arm, pivot at the shoulder) -----
  const armGeo = () => mergeParts([
    { g: gCyl(1.05, 0.92, 4.5, 0, -2.25, 0), m: longSleeve ? 6 : 1 },
    { g: gCyl(0.92, 0.78, 4, 0, -6.4, 0), m: longSleeve ? 6 : 0 },
    { g: gBox(0.95, 2.1, 1.5, 0, -9.3, 0), m: 0 }, // hand
  ]);
  const armL = new THREE.Group();
  armL.position.set(0, 21.8, -4.4);
  const armLMesh = new THREE.Mesh(armGeo(), mats);
  armLMesh.castShadow = true;
  armL.add(armLMesh);
  group.add(armL);
  const armR = new THREE.Group();
  armR.position.set(0, 21.8, 4.4);
  const armRMesh = new THREE.Mesh(armGeo(), mats);
  armRMesh.castShadow = true;
  armR.add(armRMesh);
  group.add(armR);

  // ----- gun: held in the right hand, barrel points forward (+X) -----
  const gun = new THREE.Mesh(mergeParts([
    { g: gBox(4.6, 1.1, 1.1, 1.6, 0, 0), m: 5 },
    { g: gBox(1.0, 2.3, 1.0, -0.6, -1.2, 0), m: 5 },
  ]), mats);
  gun.position.set(0, -9.3, 0.3);
  gun.visible = false;
  armR.add(gun);

  // ----- legs (merged per leg, pivot at the hip) -----
  const legGeo = () => mergeParts([
    { g: gCyl(female ? 1.45 : 1.55, 1.28, 6, 0, -2.9, 0), m: 2 },
    { g: gCyl(1.25, 1.0, 5.5, 0, -8.6, 0), m: 2 },
    { g: gBox(4.8, 1.5, 2.4, 0.7, -10.75, 0), m: 3 }, // shaped shoe, toe forward
  ]);
  const legL = new THREE.Group();
  legL.position.set(0, 11.5, -1.9);
  const legLMesh = new THREE.Mesh(legGeo(), mats);
  legLMesh.castShadow = true;
  legL.add(legLMesh);
  group.add(legL);
  const legR = new THREE.Group();
  legR.position.set(0, 11.5, 1.9);
  const legRMesh = new THREE.Mesh(legGeo(), mats);
  legRMesh.castShadow = true;
  legR.add(legRMesh);
  group.add(legR);

  group.scale.setScalar(L.scale || 1);
  group.userData.body = torsoMesh;
  group.userData.torso = torsoMesh;
  group.userData.head = headGroup;
  group.userData.armL = armL;
  group.userData.armR = armR;
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.gun = gun;
  group.userData.lastPhase = 0;
  return group;
}

// Back-compat wrapper: the old capsule call signature still works.
export function makePersonMesh(shirt, skin) {
  return makeCharacter({ kind: 'man', shirt, skin });
}

// ---------- palms ----------
export function palmGeometries() {
  // trunk: two stacked, slightly angled segments so it leans like a real palm
  const trunkLow = new THREE.CylinderGeometry(2.2, 2.8, 14, 7);
  trunkLow.translate(0, 7, 0);
  const trunkHigh = new THREE.CylinderGeometry(1.5, 2.1, 13, 7);
  trunkHigh.rotateZ(0.09);
  trunkHigh.translate(1.2, 19.5, 0);
  const trunk = mergeGeometries([trunkLow, trunkHigh], false);
  // leaves: 9 flattened cones fanning out and drooping, two rings for fullness
  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const leaf = new THREE.ConeGeometry(3.2, 16, 4);
    leaf.scale(1, 1, 0.26);
    leaf.rotateX(Math.PI / 2.35); // droop outward-down
    leaf.rotateY(a);
    leaf.translate(Math.cos(a) * 7, 26.8, Math.sin(a) * 7);
    leaves.push(leaf);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.5;
    const leaf = new THREE.ConeGeometry(2.6, 12, 4);
    leaf.scale(1, 1, 0.26);
    leaf.rotateX(Math.PI / 2.9); // upper ring droops less, stands taller
    leaf.rotateY(a);
    leaf.translate(Math.cos(a) * 5, 29.5, Math.sin(a) * 5);
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

// ---------- traffic light: pole + mast arm + 3-lamp head ----------
// One direction shows green, the cross direction red — static, but at night
// the glowing lenses read as a living intersection.
export function makeTrafficLight(greenFirst) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 30, 7), poleMat);
  pole.position.y = 15;
  pole.castShadow = true;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 12, 6), poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(6, 29, 0);
  group.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(4, 11, 3),
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.5, metalness: 0.4 }));
  head.position.set(11, 26, 0);
  group.add(head);
  const lensCols = greenFirst ? [0x2a2a2a, 0x2a2a2a, 0x2aff5a] : [0xff2a2a, 0x2a2a2a, 0x2a2a2a];
  const lensGlow = greenFirst ? [0x000000, 0x000000, 0x2aff5a] : [0xff2a2a, 0x000000, 0x000000];
  for (let i = 0; i < 3; i++) {
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 12),
      new THREE.MeshStandardMaterial({
        color: lensCols[i], emissive: lensGlow[i],
        emissiveIntensity: lensGlow[i] ? 2.2 : 0,
      }),
    );
    lens.position.set(11, 29.5 - i * 3.4, 1.6);
    group.add(lens);
  }
  return group;
}
