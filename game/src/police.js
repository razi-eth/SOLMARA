// police.js — the wanted system and the Solmara PD. Stars rise with crime and fall
// when the player stays clean and out of sight; police cars ram and foot cops chase.
import { createCar, updateCarPhysics } from './entities.js';
import { clamp, pick, range } from './random.js';
import { COP_LOOK } from './meshes.js';

export function wantedLevel(game) {
  return Math.min(5, Math.floor(game.wanted));
}

export function addWanted(game, amount) {
  if (game.state !== 'playing') return;
  game.wanted = clamp(game.wanted + amount, 0, 5);
  game.lastCrime = game.time;
  if (game.wanted >= 1 && game.cops.length === 0 && game.policeCars.length === 0) {
    spawnPolice(game, 1);
  }
}

function spawnPolice(game, n) {
  const w = game.world;
  for (let i = 0; i < n; i++) {
    // half the time the unit rolls out of Police HQ (on the road beside it)
    // instead of appearing out of thin air — the HQ is their home.
    const hq = w.landmarks ? w.landmarks.find((l) => l.id === 'police') : null;
    if (hq && game.rng() < 0.5) {
      const fromHq = game.rng() < 0.5
        ? { x: 1150, y: hq.cy + range(game.rng, -40, 40) }
        : { x: hq.cx + range(game.rng, -40, 40), y: 1150 };
      if (!w.inBuilding(fromHq.x, fromHq.y) && !w.isWater(fromHq.x, fromHq.y)) {
        const car = createCar(w, game.rng, 'police', fromHq.x, fromHq.y, range(game.rng, 0, Math.PI * 2), 'police');
        car.cruise = 300;
        game.policeCars.push(car);
        game.cars.push(car);
        continue;
      }
    }
    for (let tries = 0; tries < 10; tries++) {
      const a = range(game.rng, 0, Math.PI * 2);
      const d = range(game.rng, 420, 700);
      const x = game.player.x + Math.cos(a) * d, y = game.player.y + Math.sin(a) * d;
      if (x < 40 || y < 40 || x > 2760 || y > 2760) continue;
      if (w.inBuilding(x, y) || w.isWater(x, y)) continue;
      if (game.wanted >= 1 && game.rng() < 0.6) {
        const car = createCar(w, game.rng, 'police', x, y, a, 'police');
        car.cruise = 300;
        game.policeCars.push(car);
        game.cars.push(car);
      } else {
        game.cops.push({
          x, y, angle: a, hp: 100, speed: 150, state: 'chase',
          shootCd: 0, arrest: 0, walkPhase: 0, kind: 'cop', look: COP_LOOK,
        });
      }
      break;
    }
  }
}

export function updateWanted(game, dt) {
  // decay: no crime for a while and no police close by
  const lvl = wantedLevel(game);
  if (lvl === 0) { game.wanted = 0; return; }
  if (game.time - game.lastCrime > 14) {
    const near = nearestPoliceDist(game) < 500;
    if (!near) game.wanted = Math.max(0, game.wanted - 0.09 * dt);
  }
  // keep pressure: target number of police units by stars
  const wantUnits = [0, 2, 3, 4, 6, 8][lvl];
  const have = game.policeCars.length + game.cops.length;
  game.spawnTimer -= dt;
  if (have < wantUnits && game.spawnTimer <= 0) {
    game.spawnTimer = 1.6;
    spawnPolice(game, 1);
  }
  // the chopper comes out at three stars
  if (lvl >= 3 && game.spawnHeli && (!game.helis || game.helis.length === 0)) {
    game.spawnHeli();
  }
  // despawn police far away when wanted is 0
  if (game.wanted < 0.5) {
    for (let i = game.policeCars.length - 1; i >= 0; i--) {
      const c = game.policeCars[i];
      if (Math.hypot(c.x - game.player.x, c.y - game.player.y) > 1200) {
        game.cars.splice(game.cars.indexOf(c), 1);
        game.policeCars.splice(i, 1);
      }
    }
    for (let i = game.cops.length - 1; i >= 0; i--) {
      const c = game.cops[i];
      if (Math.hypot(c.x - game.player.x, c.y - game.player.y) > 1200) game.cops.splice(i, 1);
    }
  }
}

export function nearestPoliceDist(game) {
  let d = Infinity;
  for (const c of game.policeCars) d = Math.min(d, Math.hypot(c.x - game.player.x, c.y - game.player.y));
  for (const c of game.cops) d = Math.min(d, Math.hypot(c.x - game.player.x, c.y - game.player.y));
  return d;
}

// Police car: pursue the player, ram to stop them.
export function updatePoliceCar(game, car, dt) {
  const p = game.player;
  const dx = p.x - car.x, dy = p.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return;
  const aim = Math.atan2(dy, dx);
  const diff = ((aim - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const steer = clamp(diff * 2.6, -1, 1);
  // ram: full throttle, ease off only when very close and slow
  let throttle = 1;
  if (d < 60 && Math.abs(car.speed) > 240) throttle = 0.2;
  updateCarPhysics(game, car, dt, throttle, steer);
  car.sirenPhase += dt * 7;
  // brake lights flare when the interceptor slows to ram
  car.brakeLight = throttle < 0.5;
  // ramming damage to the player's car / player
  if (d < (car.w + 20) * 0.5) {
    if (p.car) {
      game.damageCar(p.car, 14 * dt);
    } else {
      p.hp -= 10 * dt;
      if (p.hp <= 0) game.killPlayer('busted');
    }
  }
  if (car.hp <= 0) {
    // exploded already handled by damageCar
  }
}

// Foot cop: chase on foot, shoot at range, arrest up close.
export function updateCop(game, cop, dt) {
  const p = game.player;
  const dx = p.x - cop.x, dy = p.y - cop.y;
  const d = Math.hypot(dx, dy);
  if (d > 700) { cop.state = 'chase'; }
  cop.angle = Math.atan2(dy, dx);
  const sp = cop.speed;
  if (d > 26) {
    const nx = cop.x + Math.cos(cop.angle) * sp * dt;
    const ny = cop.y + Math.sin(cop.angle) * sp * dt;
    const c = game.world.collideCircle(nx, ny, 9);
    cop.x = c.x; cop.y = c.y;
    cop.walkPhase += dt * 12;
    cop.arrest = 0;
  } else {
    // up close: arrest the player
    cop.arrest += dt;
    if (cop.arrest > 1.4 && !p.car) {
      game.killPlayer('busted');
    }
    if (p.car) {
      // drag the player out? just damage the car
      game.damageCar(p.car, 6 * dt);
    }
  }
  // shoot at range if player is armed/dangerous
  cop.shootCd -= dt;
  if (d > 60 && d < 320 && cop.shootCd <= 0 && game.wanted >= 2) {
    cop.shootCd = 0.9;
    game.fireBullet(cop.x + Math.cos(cop.angle) * 14, cop.y + Math.sin(cop.angle) * 14, cop.angle + range(game.rng, -0.12, 0.12), 'enemy');
    game.audio.shotFar();
  }
}

export function policeSirenOn(game) {
  return game.policeCars.length > 0 || game.cops.length > 0;
}
