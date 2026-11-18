// city3d.js — SOLMARA 3D: builds the static city of Solmara once.
// Ground, roads, sidewalks, merged beveled buildings, palms, lamps, neon signs,
// the marina pier, the ferris wheel, the ocean, the sky dome and the stars.
// Static geometry is merged into a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { getMaterials, getTextures, buildingGeometry, roofPropGeometry, palmGeometries, treeGeometry, lampGeometries, makeFerrisWheel, makeNeonSign } from './meshes.js';

const NEON_WORDS = ['SOLMARA', 'HOTEL', 'PIER', 'BAR', 'CASINO', '24 HOUR', 'TACOS', 'MOTEL', 'SOLMARA', 'NEON', 'CLUB', 'PIER'];

function flatPlane(w, d, x, z, y) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

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
  const waterMat = M.water.clone();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1300, 4200), waterMat);
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

  // ---------- buildings: one merged geometry per district + roof slabs + props ----------
  // (mergeGeometries(useGroups=true) assigns materialIndex = array index, so the
  // extrude's own cap/wall groups cannot survive a merge — walls get the facade,
  // and a separate merged roof slab covers the top cap.)
  const byDistrict = { downtown: [], oldtown: [], industrial: [], residential: [] };
  const slabGeos = [];
  const propGeos = [];
  for (const b of world.buildings) {
    (byDistrict[b.district] || byDistrict.oldtown).push(buildingGeometry(b));
    const h = Math.max(10, b.hgt * 3.0);
    const slab = new THREE.BoxGeometry(b.w + 3, 2.2, b.h + 3);
    slab.translate(b.x + b.w / 2, h + 1.1, b.y + b.h / 2);
    slabGeos.push(slab);
    propGeos.push(roofPropGeometry(b));
  }
  const facadeMat = {
    downtown: M.facadeDowntown, oldtown: M.facadeOld,
    industrial: M.facadeInd, residential: M.facadeRes,
  };
  for (const d of Object.keys(byDistrict)) {
    if (!byDistrict[d].length) continue;
    const merged = mergeGeometries(byDistrict[d], false);
    const mesh = new THREE.Mesh(merged, facadeMat[d]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const slabs = new THREE.Mesh(mergeGeometries(slabGeos, false), M.roof);
  slabs.castShadow = true;
  slabs.receiveShadow = true;
  group.add(slabs);
  const props = new THREE.Mesh(mergeGeometries(propGeos, false),
    new THREE.MeshStandardMaterial({ color: 0x6a625a, roughness: 0.9 }));
  props.castShadow = true;
  group.add(props);

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

  // ---------- neon signs on downtown fronts ----------
  const neons = [];
  const dt = world.buildings.filter((b) => b.district === 'downtown');
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

  // ---------- sky dome (gradient shader) + stars ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2a6fd9) },
      mid: { value: new THREE.Color(0x9fd4ff) },
      bot: { value: new THREE.Color(0xffe9b0) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, h))
                          : mix(bot, mid, smoothstep(-0.08, 0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3400, 24, 16), skyMat);
  group.add(sky);
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

  return { group, water, waterMat, ferris, skyMat, stars, lampGlows, neons };
}
