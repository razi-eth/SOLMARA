// traffic.js — city life: traffic cars drive the road graph on the right-hand lane,
// pedestrians wander the sidewalks, cars nudge each other instead of overlapping.
import { createCar, createPed, updateCarPhysics, updatePed } from './entities.js';
import { clamp, range, pick, dist2 } from './random.js';

const TRAFFIC_TARGET = 22;
const PED_TARGET = 34;

function laneOffset(angle) {
  // right-hand traffic: offset to the right of the direction of travel
  const rx = Math.cos(angle + Math.PI / 2), ry = Math.sin(angle + Math.PI / 2);
  return { x: rx * 8, y: ry * 8 };
}

export function spawnTrafficCar(game) {
  const w = game.world;
  // spawn on a road 500-1100 px from the player
  for (let tries = 0; tries < 12; tries++) {
    const p = w.randomRoadPoint(game.rng);
    const d = Math.hypot(p.x - game.player.x, p.y - game.player.y);
    if (d < 500 || d > 1200) continue;
    if (w.inBuilding(p.x, p.y)) continue;
    const type = pick(game.rng, ['sedan', 'sedan', 'taxi', 'coupe', 'van', 'sport', 'truck']);
    const car = createCar(w, game.rng, type, p.x, p.y, range(game.rng, 0, Math.PI * 2), 'traffic');
    car.target = w.nearestIntersection(p.x, p.y);
    car.cruise = range(game.rng, 130, 200);
    game.cars.push(car);
    return;
  }
}

export function updateTrafficCar(game, car, dt) {
  const w = game.world;
  if (!car.target) car.target = w.nearestIntersection(car.x, car.y);
  const dx = car.target.x - car.x, dy = car.target.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 26) {
    // pick next intersection (not back where we came from, if possible)
    const key = car.target.x + ',' + car.target.y;
    const nbrs = (w.graph.get(key) || []).filter((n) => !(Math.abs(n.x - car.lastX) < 2 && Math.abs(n.y - car.lastY) < 2));
    const next = nbrs.length ? pick(game.rng, nbrs) : pick(game.rng, w.graph.get(key) || [car.target]);
    car.lastX = car.target.x; car.lastY = car.target.y;
    car.target = next;
    return;
  }
  const wantAngle = Math.atan2(dy, dx);
  const off = laneOffset(wantAngle);
  const tx = car.target.x + off.x, ty = car.target.y + off.y;
  const aim = Math.atan2(ty - car.y, tx - car.x);
  const diff = ((aim - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const steer = clamp(diff * 2.2, -1, 1);
  // traffic headlights come on after dark (the 3D builder lights the beams)
  car.lightsOn = game.tod ? game.tod.dark > 0.25 : false;
  // slow for a car ahead
  let throttle = 0.55;
  const ahead = carAhead(game, car, 70);
  if (ahead) throttle = 0;
  // cruise speed cap: ease throttle as we approach cruise
  if (Math.abs(car.speed) > car.cruise) throttle = Math.min(throttle, 0.1);
  updateCarPhysics(game, car, dt, throttle, steer);
}

function carAhead(game, car, rangeAhead) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  for (const o of game.cars) {
    if (o === car) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (along > 0 && along < rangeAhead && side < 26) return o;
  }
  return null;
}

export function collideCars(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const rr = (a.w + b.w) * 0.36;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (rr - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const imp = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
        if (imp > 120) {
          game.damageCar(a, imp * 0.01);
          game.damageCar(b, imp * 0.01);
          game.spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, 4);
          if (a.driver === 'player' || b.driver === 'player') game.audio.crash(imp);
        }
      }
    }
  }
}

export function maintainPopulation(game, dt) {
  game.popTimer -= dt;
  if (game.popTimer > 0) return;
  game.popTimer = 0.5;
  // traffic cars
  const traffic = game.cars.filter((c) => c.driver === 'traffic').length;
  if (traffic < TRAFFIC_TARGET) spawnTrafficCar(game);
  // despawn traffic far from player
  for (let i = game.cars.length - 1; i >= 0; i--) {
    const c = game.cars[i];
    if (c.driver === 'traffic' && Math.hypot(c.x - game.player.x, c.y - game.player.y) > 1500) {
      game.cars.splice(i, 1);
    }
  }
  // parked cars: keep a few near the player
  const parked = game.cars.filter((c) => c.driver === 'parked').length;
  if (parked < 10) {
    for (let tries = 0; tries < 8; tries++) {
      const p = game.world.randomRoadPoint(game.rng);
      const d = Math.hypot(p.x - game.player.x, p.y - game.player.y);
      if (d < 260 || d > 900) continue;
      // the school bus runs its route past the school: a yellow van near it
      const school = game.world.landmarks ? game.world.landmarks.find((l) => l.id === 'school') : null;
      const nearSchool = school && Math.hypot(p.x - school.cx, p.y - school.cy) < 420;
      const type = nearSchool && game.rng() < 0.6 ? 'van' : pick(game.rng, ['sedan', 'coupe', 'van', 'sport', 'taxi']);
      const car = createCar(game.world, game.rng, type, p.x + range(game.rng, -10, 10), p.y + range(game.rng, -10, 10), range(game.rng, 0, Math.PI * 2), 'parked');
      if (nearSchool && type === 'van') car.color = '#f2c200'; // school bus yellow
      game.cars.push(car);
      break;
    }
  }
  // pedestrians
  if (game.peds.length < PED_TARGET) {
    for (let tries = 0; tries < 8; tries++) {
      const p = game.world.randomRoadPoint(game.rng);
      const d = Math.hypot(p.x - game.player.x, p.y - game.player.y);
      if (d < 200 || d > 1000) continue;
      game.peds.push(createPed(game.world, game.rng, p.x + 30, p.y + 30));
      break;
    }
  }
  for (let i = game.peds.length - 1; i >= 0; i--) {
    const p = game.peds[i];
    if (Math.hypot(p.x - game.player.x, p.y - game.player.y) > 1300) game.peds.splice(i, 1);
  }
}

export function updatePeds(game, dt) {
  for (const p of game.peds) updatePed(game, p, dt);
  // player car scares / hits peds
  const px = game.player.x, py = game.player.y;
  const inCar = !game.player.onFoot;
  for (let i = game.peds.length - 1; i >= 0; i--) {
    const p = game.peds[i];
    const d2 = dist2(p.x, p.y, px, py);
    if (inCar && d2 < 26 * 26 && Math.abs(game.player.car ? game.player.car.speed : 0) > 60) {
      // hit by car
      game.peds.splice(i, 1);
      game.spawnBlood(p.x, p.y);
      game.addWanted(0.6);
      game.audio.thud();
      game.addShake(3);
      game.stats.pedsHit++;
      continue;
    }
    if (d2 < 130 * 130 && (inCar || game.shotsFiredRecently > 0)) {
      if (p.state !== 'flee') {
        p.state = 'flee'; p.fleeX = px; p.fleeY = py; p.wait = 2.5;
      }
    }
  }
}
