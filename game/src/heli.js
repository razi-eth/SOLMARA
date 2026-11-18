// heli.js — SOLMARA 3D: the police helicopter.
// Spawns at wanted 3+, hunts the player from the air, sweeps a searchlight at
// night, shoots at wanted 4+, and can be shot down. All original geometry.
import * as THREE from 'three';
import { clamp, lerp, range } from './random.js';

let sceneRef = null;
let spotLight = null;
let spotTarget = null;

export function initHeli(scene) {
  sceneRef = scene;
  spotLight = new THREE.SpotLight(0xfff6c9, 0, 700, 0.28, 0.5, 1.0);
  spotTarget = new THREE.Object3D();
  scene.add(spotLight);
  scene.add(spotTarget);
  spotLight.target = spotTarget;
}

function makeHeliMesh() {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.35, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.5, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a4a66, roughness: 0.1, metalness: 0.9 });
  // cabin: smooth scaled sphere (no boxes)
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(9, 18, 12), white);
  cabin.scale.set(1.7, 0.85, 1.0);
  cabin.castShadow = true;
  group.add(cabin);
  // glass nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(7.5, 16, 10), glass);
  nose.scale.set(1.0, 0.7, 0.95);
  nose.position.set(11, -1, 0);
  group.add(nose);
  // belly stripe
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(9.2, 18, 12), dark);
  stripe.scale.set(1.68, 0.28, 1.0);
  stripe.position.set(0, -5.5, 0);
  group.add(stripe);
  // tail boom: tapered cylinder pointing back
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 3.2, 30, 8), white);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-27, 2, 0);
  tail.castShadow = true;
  group.add(tail);
  // tail fin
  const fin = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 1.2), dark);
  fin.position.set(-40, 6, 0);
  group.add(fin);
  // tail rotor (spins around X at the tail)
  const tailRotor = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.1, 9, 0.5), dark);
    blade.rotation.x = i * Math.PI / 2;
    tailRotor.add(blade);
  }
  tailRotor.position.set(-41, 3, 3.4);
  group.add(tailRotor);
  // main rotor mast + blades (spin around Y)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 5, 8), dark);
  mast.position.set(0, 9.5, 0);
  group.add(mast);
  const rotor = new THREE.Group();
  rotor.position.set(0, 12, 0);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(44, 0.7, 3.2), dark);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  group.add(rotor);
  // skids
  for (const z of [-6, 6]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 22, 6), dark);
    skid.rotation.z = Math.PI / 2;
    skid.position.set(0, -9.5, z);
    group.add(skid);
    for (const x of [-7, 7]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3.5, 6), dark);
      strut.position.set(x, -8, z);
      group.add(strut);
    }
  }
  // searchlight cone (visible at night)
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c9, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(26, 190, 16, 1, true), coneMat);
  cone.position.set(0, -100, 0);
  cone.rotation.x = Math.PI; // apex up at the heli, opening down
  group.add(cone);
  // police star on the side (small emissive disc)
  const star = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x1a3a8a, emissive: 0x1a3a8a, emissiveIntensity: 0.6 }),
  );
  star.position.set(2, 1, 9.3);
  group.add(star);
  const star2 = star.clone();
  star2.position.z = -9.3;
  star2.rotation.y = Math.PI;
  group.add(star2);
  group.userData.rotor = rotor;
  group.userData.tailRotor = tailRotor;
  group.userData.cone = cone;
  return group;
}

export function spawnHeli(game) {
  if (!game.helis) game.helis = [];
  if (game.helis.length > 0) return null;
  const p = game.player;
  const a = range(game.rng, 0, Math.PI * 2);
  const heli = {
    x: p.x + Math.cos(a) * 500,
    y: p.y + Math.sin(a) * 500,
    z: 210,
    angle: a,
    speed: 0,
    hp: 150,
    rotor: 0,
    shootCd: 1.5,
    state: 'hunt',
    fallV: 0,
    mesh: null,
  };
  heli.mesh = makeHeliMesh();
  heli.mesh.position.set(heli.x, heli.z, heli.y);
  sceneRef.add(heli.mesh);
  game.helis.push(heli);
  game.showToast('POLICE HELICOPTER', 'They sent the chopper. Lose it or shoot it down.');
  game.audio.siren(0, true);
  return heli;
}

export function clearHelis(game) {
  if (!game.helis) return;
  for (const h of game.helis) {
    if (h.mesh) sceneRef.remove(h.mesh);
  }
  game.helis.length = 0;
  if (spotLight) spotLight.intensity = 0;
}

export function updateHeli(game, dt, R) {
  if (!game.helis) game.helis = [];
  const p = game.player;
  for (let i = game.helis.length - 1; i >= 0; i--) {
    const h = game.helis[i];
    const dx = p.x - h.x, dy = p.y - h.y;
    const d = Math.hypot(dx, dy);
    h.rotor += dt * 26;
    if (h.state === 'falling') {
      // shot down: spin and drop
      h.fallV += 320 * dt;
      h.z -= h.fallV * dt;
      h.angle += dt * 5;
      h.mesh.rotation.z += dt * 6;
      if (h.z <= 4) {
        game.spawnExplosion(h.x, h.y);
        game.addWanted(-1);
        sceneRef.remove(h.mesh);
        game.helis.splice(i, 1);
        game.showToast('HELICOPTER DOWN', 'The chopper is scrap. Nice shooting.');
      }
    } else {
      // hunt: close in and hover above the player (shotHold freezes position for screenshots)
      if (!h.shotHold) {
        const wantAngle = Math.atan2(dy, dx);
        let diff = wantAngle - h.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        h.angle += clamp(diff, -1.6 * dt, 1.6 * dt);
        const cruise = d > 120 ? 265 : 120;
        h.speed = lerp(h.speed, cruise, Math.min(1, dt * 1.5));
        h.x += Math.cos(h.angle) * h.speed * dt;
        h.y += Math.sin(h.angle) * h.speed * dt;
      }
      // hover height breathes a little
      const targetZ = h.shotHold ? h.z : 185 + Math.sin(game.time * 1.3 + i) * 12;
      h.z = lerp(h.z, targetZ, Math.min(1, dt * 1.2));
      // shoot at wanted 4+
      h.shootCd -= dt;
      if (game.wanted >= 4 && d < 520 && h.shootCd <= 0) {
        h.shootCd = range(game.rng, 0.9, 1.5);
        game.fireBullet(h.x, h.y, Math.atan2(dy, dx) + range(game.rng, -0.1, 0.1), 'enemy');
        game.audio.shotFar();
      }
      // leave when the heat is off
      if (game.wanted < 2.5) {
        h.state = 'leaving';
        h.x += Math.cos(h.angle) * 200 * dt;
        h.y += Math.sin(h.angle) * 200 * dt;
        if (d > 1100) {
          sceneRef.remove(h.mesh);
          game.helis.splice(i, 1);
          continue;
        }
      }
    }
    // mesh sync
    if (h.mesh) {
      h.mesh.position.set(h.x, h.z, h.y);
      h.mesh.rotation.y = -h.angle;
      h.mesh.userData.rotor.rotation.y = h.rotor;
      h.mesh.userData.tailRotor.rotation.x = h.rotor * 2.4;
      // searchlight: bright at night, aimed at the player
      const night = game.tod ? game.tod.dark : 0;
      const on = night > 0.3 && h.state !== 'falling';
      h.mesh.userData.cone.material.opacity = on ? 0.13 : 0;
      if (on && spotLight) {
        spotLight.position.set(h.x, h.z - 4, h.y);
        spotTarget.position.set(p.x, 0, p.y);
        spotLight.intensity = 900;
      } else if (spotLight && game.helis.length === 1) {
        spotLight.intensity = 0;
      }
    }
  }
}
