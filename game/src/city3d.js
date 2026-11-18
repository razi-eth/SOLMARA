// city3d.js — SOLMARA 3D: builds the static city of Solmara once.
// Ground, roads, sidewalks, merged beveled buildings, palms, lamps, neon signs,
// the marina pier, the ferris wheel, the ocean, the sky dome and the stars.
// Static geometry is merged into a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { getMaterials, getTextures, buildingGeometry, roofPropGeometry, pitchedRoofGeometry, palmGeometries, treeGeometry, lampGeometries, makeFerrisWheel, makeNeonSign, makeTrafficLight } from './meshes.js';
import { buildLandmarks } from './landmarks.js';
import { hash2 } from './random.js';

const NEON_WORDS = ['SOLMARA', 'HOTEL', 'PIER', 'BAR', 'CASINO', '24 HOUR', 'TACOS', 'MOTEL', 'SOLMARA', 'NEON', 'CLUB', 'PIER'];

function flatPlane(w, d, x, z, y) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

// city3d.js — the merged static city: ground, roads, buildings, palms,
// street lamps, traffic lights, ferris wheel, pier. Characters are ~27 units
// tall, so sidewalks are kept clear of props at their walking height.
export function buildCity3D(world) {
  const M = getMaterials();
  const T = getTextures();
  const group = new THREE.Group();
  const W = 2800;

  // ---------- ground base (grass, oversized so the horizon never shows void) ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4200, 4200),
    new THREE.MeshStandardMaterial({ map: T.grass, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(1400, 0, 1400);
  ground.receiveShadow = true;
  group.add(ground);

  // ---------- ocean + beach ----------
  // The water is a shader now (animated waves, fresnel, sun glint) — it needs
  // real segments so the vertex waves have vertices to move.
  const waterMat = M.water.clone();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1300, 4200, 40, 80), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(2520 + 650, 0.35, 1400);
  group.add(water);
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 4200),
    new THREE.MeshStandardMaterial({ map: T.sand, roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(2380 + 70, 0.2, 1400);
  beach.receiveShadow = true;
  group.add(beach);

  // ---------- roads (asphalt planes) + centre dashes ----------
  const roadGeos = [];
  const dashGeos = [];
  for (const r of world.roads) {
    if (r.vertical) {
      roadGeos.push(flatPlane(r.w, W, r.x1, W / 2, 0.3));
      for (let y = 60; y < W - 40; y += 90) dashGeos.push(flatPlane(2.5, 26, r.x1, y, 0.45));
    } else {
      roadGeos.push(flatPlane(2380, r.w, 1190, r.y1, 0.3));
      for (let x = 60; x < 2340; x += 90) dashGeos.push(flatPlane(26, 2.5, x, r.y1, 0.45));
    }
  }
  const roads = new THREE.Mesh(mergeGeometries(roadGeos, false), M.asphalt);
  roads.receiveShadow = true;
  group.add(roads);
  const dashes = new THREE.Mesh(
    mergeGeometries(dashGeos, false),
    new THREE.MeshStandardMaterial({ color: 0xe8d44d, roughness: 0.8 }),
  );
  group.add(dashes);

  // ---------- crosswalks at every intersection + solid edge lines ----------
  // A bare asphalt grid reads as a parking lot; crossings make it a city.
  const crossGeos = [];
  const edgeGeos = [];
  for (const r of world.roads) {
    if (r.vertical) {
      edgeGeos.push(flatPlane(1.6, W, r.x1 - r.w / 2 + 2, W / 2, 0.42));
      edgeGeos.push(flatPlane(1.6, W, r.x1 + r.w / 2 - 2, W / 2, 0.42));
    } else {
      edgeGeos.push(flatPlane(2380, 1.6, 1190, r.y1 - r.w / 2 + 2, 0.42));
      edgeGeos.push(flatPlane(2380, 1.6, 1190, r.y1 + r.w / 2 - 2, 0.42));
    }
  }
  for (const p of world.intersections) {
    if (p.x > 2350) continue;
    // zebra stripes across the north side of each crossing (both axes)
    for (let i = -4; i <= 4; i++) {
      crossGeos.push(flatPlane(3.2, 26, p.x + i * 7, p.y - 20, 0.44));
      crossGeos.push(flatPlane(26, 3.2, p.x - 20, p.y + i * 7, 0.44));
    }
  }
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.85 });
  group.add(new THREE.Mesh(mergeGeometries(crossGeos, false), crossMat));
  group.add(new THREE.Mesh(mergeGeometries(edgeGeos, false), crossMat));

  // ---------- traffic lights at the big intersections ----------
  const trafficLights = [];
  for (const p of world.intersections) {
    if (p.x > 2350 || p.x % 400 !== 150 || p.y % 400 !== 150) continue;
    if (Math.abs(p.x - 1150) > 800 && Math.abs(p.y - 1350) > 800) continue;
    const tl = makeTrafficLight((p.x + p.y) % 800 === 0);
    tl.position.set(p.x + 22, 0, p.y + 22);
    tl.rotation.y = Math.PI / 2;
    group.add(tl);
    trafficLights.push(tl);
  }

  // ---------- sidewalk aprons under every building + park pond + pools ----------
  const lotGeos = [];
  for (const b of world.buildings) {
    lotGeos.push(flatPlane(b.w + 18, b.h + 18, b.x + b.w / 2, b.y + b.h / 2, 0.5));
  }
  const lots = new THREE.Mesh(mergeGeometries(lotGeos, false), M.sidewalk);
  lots.receiveShadow = true;
  group.add(lots);
  const pond = new THREE.Mesh(
    new THREE.PlaneGeometry(world.pond.w, world.pond.h),
    new THREE.MeshStandardMaterial({ color: 0x2f8fb8, roughness: 0.2, metalness: 0.3 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(world.pond.x + world.pond.w / 2, 0.4, world.pond.y + world.pond.h / 2);
  group.add(pond);
  const poolGeos = [];
  for (const p of world.pools) poolGeos.push(flatPlane(p.w, p.h, p.x + p.w / 2, p.y + p.h / 2, 0.6));
  if (poolGeos.length) {
    group.add(new THREE.Mesh(mergeGeometries(poolGeos, false),
      new THREE.MeshStandardMaterial({ color: 0x3fa8d8, roughness: 0.15, metalness: 0.3 })));
  }

  // ---------- buildings: merged per (district, facade variant) + roof shapes ----------
  // Three facade palettes per district (picked by a deterministic hash of the
  // building's position) so no two neighbouring blocks share a face, pitched
  // roofs on low houses, and glass setback crowns on the tallest downtown
  // towers — the generic city stops reading as clones. Landmark buildings
  // are skipped here; landmarks.js builds them with their own geometry.
  const byDistrict = { downtown: [[], [], []], oldtown: [[], [], []], industrial: [[], [], []], residential: [[], [], []] };
  const slabGeos = [];
  const propGeos = [];
  const pitchedGeos = [];
  const setbackGeos = [];
  const parapetGeos = [];
  for (const b of world.buildings) {
    if (b.landmark) continue;
    const d = b.district in byDistrict ? b.district : 'oldtown';
    const variant = Math.floor(hash2(b.x, b.y) * 3) % 3;
    byDistrict[d][variant].push(buildingGeometry(b));
    const h = Math.max(10, b.hgt * 3.0);
    const pitched = (b.roof % 3 === 0) && (d === 'residential' || d === 'oldtown');
    if (pitched) {
      pitchedGeos.push(pitchedRoofGeometry(b, h + 1));
    } else {
      const slab = new THREE.BoxGeometry(b.w + 3, 2.2, b.h + 3);
      slab.translate(b.x + b.w / 2, h + 1.1, b.y + b.h / 2);
      slabGeos.push(slab);
      // parapet rims around the roof: a thin raised edge so the roof reads as
      // a finished slab with a lip, not a flat cap (pitched roofs skip this).
      const top = h + 2.2, t = 1.6, ph = 2.6;
      const mk = (w, dd, x, z) => {
        const g = new THREE.BoxGeometry(w, ph, dd);
        g.translate(x, top + ph / 2, z);
        parapetGeos.push(g);
      };
      mk(b.w + 3, t, b.x + b.w / 2, b.y + 1.5);
      mk(b.w + 3, t, b.x + b.w / 2, b.y + b.h - 1.5);
      mk(t, b.h + 3, b.x + 1.5, b.y + b.h / 2);
      mk(t, b.h + 3, b.x + b.w - 1.5, b.y + b.h / 2);
    }
    if (d === 'downtown' && b.hgt > 34) {
      // glass setback crown on the tallest towers: a smaller glowing box on
      // the roof, so the skyline steps instead of ending in flat slabs.
      const sw = b.w * 0.55, sd = b.h * 0.55, sh = Math.max(12, h * 0.28);
      const sb = new THREE.BoxGeometry(sw, sh, sd);
      sb.translate(b.x + b.w / 2, h + 2.2 + sh / 2, b.y + b.h / 2);
      setbackGeos.push(sb);
    }
    propGeos.push(roofPropGeometry(b));
  }
  const allFacadeMats = [];
  for (const d of Object.keys(byDistrict)) {
    for (let v = 0; v < 3; v++) {
      if (!byDistrict[d][v].length) continue;
      const merged = mergeGeometries(byDistrict[d][v], false);
      const mat = M.facadeVariantMats[d][v];
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      allFacadeMats.push(mat);
    }
  }
  const slabs = new THREE.Mesh(mergeGeometries(slabGeos, false), M.roof);
  slabs.castShadow = true;
  slabs.receiveShadow = true;
  group.add(slabs);
  if (pitchedGeos.length) {
    const pitched = new THREE.Mesh(mergeGeometries(pitchedGeos, false), M.roof);
    pitched.castShadow = true;
    pitched.receiveShadow = true;
    group.add(pitched);
  }
  if (setbackGeos.length) {
    const setbacks = new THREE.Mesh(mergeGeometries(setbackGeos, false), M.glassDowntown);
    setbacks.castShadow = true;
    group.add(setbacks);
  }
  const parapets = new THREE.Mesh(mergeGeometries(parapetGeos, false), M.roof);
  parapets.castShadow = true;
  group.add(parapets);
  const props = new THREE.Mesh(mergeGeometries(propGeos, false),
    new THREE.MeshStandardMaterial({ color: 0x6a625a, roughness: 0.9 }));
  props.castShadow = true;
  group.add(props);

  // ---------- landmarks: bank, hotel, casino, police HQ, bar, mall, fire, ----------
  // hospital, church, gas station, school + field, stadium, airport + runway,
  // and the park rollercoaster. Each has its own silhouette and signage.
  const lm = buildLandmarks(world);
  group.add(lm.group);

  // ---------- palms + round trees (merged) ----------
  const palm = palmGeometries();
  const palmTrunks = [], palmLeaves = [], palmNuts = [];
  const treeTrunks = [], treeCrowns = [];
  for (const t of world.trees) {
    if (t.palm) {
      const tr = palm.trunk.clone();
      tr.translate(t.x, 0, t.y);
      palmTrunks.push(tr);
      const lf = palm.leafGeo.clone();
      lf.translate(t.x, 0, t.y);
      palmLeaves.push(lf);
      const nt = palm.nuts.clone();
      nt.translate(t.x, 0, t.y);
      palmNuts.push(nt);
    } else {
      const tg = treeGeometry(false);
      tg.trunk.translate(t.x, 0, t.y);
      treeTrunks.push(tg.trunk);
      tg.crown.translate(t.x, 0, t.y);
      treeCrowns.push(tg.crown);
    }
  }
  const pt = new THREE.Mesh(mergeGeometries(palmTrunks, false), M.trunk);
  pt.castShadow = true;
  group.add(pt);
  const pl = new THREE.Mesh(mergeGeometries(palmLeaves, false), M.leaf);
  pl.castShadow = true;
  group.add(pl);
  group.add(new THREE.Mesh(mergeGeometries(palmNuts, false),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 })));
  const tt = new THREE.Mesh(mergeGeometries(treeTrunks, false), M.trunk);
  tt.castShadow = true;
  group.add(tt);
  const tc = new THREE.Mesh(mergeGeometries(treeCrowns, false), M.leafDry);
  tc.castShadow = true;
  group.add(tc);

  // ---------- street lamps (merged poles + merged emissive heads) ----------
  const lamp = lampGeometries();
  const poleGeos = [], headGeos = [];
  for (const l of world.lamps) {
    const p = lamp.pole.clone();
    p.translate(l.x, 0, l.y);
    poleGeos.push(p);
    const h = lamp.head.clone();
    h.translate(l.x + 8.5, 0, l.y);
    headGeos.push(h);
  }
  const poles = new THREE.Mesh(mergeGeometries(poleGeos, false), M.pole);
  poles.castShadow = true;
  group.add(poles);
  const heads = new THREE.Mesh(mergeGeometries(headGeos, false), M.lampHead);
  group.add(heads);
  // lamp glow sprites (cheap night lights) — one sprite per 4th lamp
  const lampGlows = [];
  for (let i = 0; i < world.lamps.length; i += 4) {
    const l = world.lamps[i];
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T.glowWarm, color: 0xffe9a8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.position.set(l.x + 8.5, 25, l.y);
    sp.scale.set(46, 46, 1);
    sp.userData.isLampGlow = true;
    group.add(sp);
    lampGlows.push(sp);
  }

  // ---------- neon signs on downtown fronts (landmarks have their own signage) ----------
  const neons = [];
  const dt = world.buildings.filter((b) => b.district === 'downtown' && !b.landmark);
  const neonColors = ['#ff2e88', '#22e6ff', '#ffe93c', '#7cff3c', '#ff7a1a'];
  for (let i = 0; i < Math.min(26, dt.length); i++) {
    const b = dt[i];
    const sign = makeNeonSign(NEON_WORDS[i % NEON_WORDS.length], neonColors[i % neonColors.length], Math.min(64, b.w * 0.7));
    const hgt = Math.max(10, b.hgt * 3.0);
    sign.position.set(b.x + b.w / 2, hgt * 0.55, b.y + b.h + 2.5);
    group.add(sign);
    neons.push(sign);
  }

  // ---------- marina pier + ferris wheel platform ----------
  const pier = new THREE.Group();
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(300, 3, 44), M.pierWood);
  pierDeck.position.set(world.pier.x + 150, 1.5, world.pier.y + 22);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  pier.add(pierDeck);
  for (let x = world.pier.x + 10; x < world.pier.x + 300; x += 40) {
    for (const z of [world.pier.y + 4, world.pier.y + 40]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 8, 6), M.pierWood);
      post.position.set(x, 0, z);
      pier.add(post);
    }
  }
  // pier lamps
  for (let x = world.pier.x + 30; x < world.pier.x + 290; x += 60) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 14, 6), M.pole);
    post.position.set(x, 8, world.pier.y + 6);
    pier.add(post);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe9a8, emissiveIntensity: 1.6 }));
    bulb.position.set(x, 15.5, world.pier.y + 6);
    pier.add(bulb);
  }
  group.add(pier);
  // ferris platform in the water + the wheel
  const platform = new THREE.Mesh(new THREE.BoxGeometry(110, 4, 110),
    new THREE.MeshStandardMaterial({ color: 0x9a9484, roughness: 0.9 }));
  platform.position.set(world.ferris.x, 1, world.ferris.y);
  platform.receiveShadow = true;
  group.add(platform);
  const ferris = makeFerrisWheel();
  ferris.position.set(world.ferris.x, 4, world.ferris.y);
  ferris.rotation.y = Math.PI / 2; // face the beach
  group.add(ferris);

  // ---------- sky dome (gradient shader + sun disc + clouds + moon) ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2a6fd9) },
      mid: { value: new THREE.Color(0x9fd4ff) },
      bot: { value: new THREE.Color(0xffe9b0) },
      sunDir: { value: new THREE.Vector3(0.5, 0.5, 0.3).normalize() },
      sunColor: { value: new THREE.Color(0xfff2cc) },
      night: { value: 0 },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      uniform vec3 sunDir; uniform vec3 sunColor;
      uniform float night; uniform float time;
      varying vec3 vPos;
      // cheap value-noise clouds, drifting with time
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.13; a *= 0.5; }
        return v;
      }
      void main() {
        vec3 dir = normalize(vPos);
        float h = dir.y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, h))
                          : mix(bot, mid, smoothstep(-0.08, 0.25, h));
        // sun disc + warm halo (fades out at night)
        float s = max(dot(dir, normalize(sunDir)), 0.0);
        float dayF = 1.0 - night;
        c += sunColor * pow(s, 600.0) * 4.0 * dayF;
        c += sunColor * pow(s, 24.0) * 0.30 * dayF;
        // moon disc opposite the sun, visible at night
        float m = max(dot(dir, normalize(-sunDir)), 0.0);
        c += vec3(0.9, 0.95, 1.0) * smoothstep(0.9993, 0.9997, m) * 1.6 * night;
        c += vec3(0.5, 0.6, 0.9) * pow(m, 60.0) * 0.25 * night;
        // clouds: only above the horizon, drifting slowly, lit warm at dusk
        if (h > 0.03) {
          vec2 uv = dir.xz / max(h, 0.12);
          float cl = fbm(uv * 0.9 + vec2(time * 0.006, time * 0.002));
          float cover = smoothstep(0.52, 0.78, cl) * smoothstep(0.03, 0.22, h);
          vec3 cloudCol = mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.72, 0.5), clamp(1.0 - h, 0.0, 1.0) * 0.55);
          cloudCol *= mix(1.0, 0.35, night); // dark clouds at night
          c = mix(c, cloudCol, cover * 0.75 * (1.0 - night * 0.4));
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3400, 24, 16), skyMat);
  group.add(sky);
  // distant skyline silhouettes: a ring of far towers in the haze so the
  // horizon never reads as empty sky meeting flat ground.
  const skylineGeos = [];
  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x5a6a8a, roughness: 1, fog: true });
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    const r = 3050 + ((i * 7919) % 220);
    const w = 90 + ((i * 104729) % 130), h = 160 + ((i * 15485863) % 420);
    const g = new THREE.BoxGeometry(w, h, w);
    g.translate(1400 + Math.cos(a) * r, h / 2 - 4, 1400 + Math.sin(a) * r);
    skylineGeos.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(skylineGeos, false), skylineMat));
  // stars
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.random() * Math.PI * 0.42 + 0.08;
    const r = 3200;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 3.2, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false,
  }));
  group.add(stars);

  // facade materials (shared) so render3d can drive their night glow
  const facadeMats = allFacadeMats;
  return { group, water, waterMat, ferris, skyMat, stars, lampGlows, neons, facadeMats, trafficLights, landmarkAnims: lm.anims };
}
