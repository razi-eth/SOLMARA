// combat.js — bullets, explosions, particles, skid marks, blood. The action juice.
// Particles are pooled and capped so the graphics mod never tanks the frame rate.
// Particle heights are mapped in render3d's writePoints: muzzle flashes at the
// gun (~19 units on the articulated characters), blood at torso height (~18).
import { TUNING } from './config.js';
import { clamp, range, pick } from './random.js';

const MAX_PARTICLES = 320;

export function fireBullet(game, x, y, angle, from, dmg) {
  game.bullets.push({
    x, y, vx: Math.cos(angle) * TUNING.bulletSpeed, vy: Math.sin(angle) * TUNING.bulletSpeed,
    life: 0.9, from, angle, dmg: dmg || TUNING.bulletDamage,
  });
  game.spawnParticle(x, y, Math.cos(angle) * 60, Math.sin(angle) * 60, 0.08, 7, 'rgba(255,230,150,0.95)', 'flash');
  // muzzle flash: a real light in the 3D scene, so the shot lights the street
  if (game.spawnFlash) game.spawnFlash(x, y, 0xffd970);
  game.shotsFiredRecently = 1.5;
}

export function updateBullets(game, dt) {
  const p = game.player;
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    // hit a building?
    if (!dead && game.world.inBuilding(b.x, b.y)) {
      game.spawnSparks(b.x, b.y, 3);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      // hit an enemy
      for (let j = game.enemies.length - 1; j >= 0; j--) {
        const e = game.enemies[j];
        if (Math.hypot(e.x - b.x, e.y - b.y) < 14) {
          e.hp -= b.dmg;
          game.spawnBlood(b.x, b.y);
          if (e.hp <= 0) {
            game.enemies.splice(j, 1);
            game.addWanted(0.5);
            game.stats.kills++;
            game.missionEnemyDown(e);
          }
          dead = true;
          break;
        }
      }
      // hit the police helicopter (arcade: close pass counts)
      if (!dead && game.helis) for (let j = game.helis.length - 1; j >= 0; j--) {
        const h = game.helis[j];
        if (h.state !== 'falling' && Math.hypot(h.x - b.x, h.y - b.y) < 30) {
          h.hp -= b.dmg;
          game.spawnSparks(b.x, b.y, 4);
          if (h.hp <= 0) {
            h.state = 'falling';
            h.fallV = 0;
            game.stats.kills++;
          }
          dead = true;
          break;
        }
      }
      // hit a cop
      if (!dead) for (let j = game.cops.length - 1; j >= 0; j--) {
        const c = game.cops[j];
        if (Math.hypot(c.x - b.x, c.y - b.y) < 13) {
          c.hp -= b.dmg;
          game.spawnBlood(b.x, b.y);
          game.addWanted(0.8);
          if (c.hp <= 0) {
            game.cops.splice(j, 1);
            game.stats.kills++;
          }
          dead = true;
          break;
        }
      }
      // hit a car
      if (!dead) for (const c of game.cars) {
        if (c.driver === 'player') continue;
        const dx = b.x - c.x, dy = b.y - c.y;
        const localX = dx * Math.cos(-c.angle) - dy * Math.sin(-c.angle);
        const localY = dx * Math.sin(-c.angle) + dy * Math.cos(-c.angle);
        if (Math.abs(localX) < c.w / 2 + 2 && Math.abs(localY) < c.h / 2 + 2) {
          game.damageCar(c, b.dmg * 0.5);
          game.spawnSparks(b.x, b.y, 3);
          dead = true;
          break;
        }
      }
      // hit a ped (counts as a crime)
      if (!dead) for (let j = game.peds.length - 1; j >= 0; j--) {
        const pe = game.peds[j];
        if (Math.hypot(pe.x - b.x, pe.y - b.y) < 11) {
          game.peds.splice(j, 1);
          game.spawnBlood(b.x, b.y);
          game.addWanted(0.7);
          game.stats.pedsHit++;
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      if (p.onFoot && Math.hypot(p.x - b.x, p.y - b.y) < 12) {
        p.hp -= 12;
        game.spawnBlood(b.x, b.y);
        game.addShake(2);
        if (p.hp <= 0) game.killPlayer('wasted');
        dead = true;
      } else if (!p.onFoot && p.car) {
        const c = p.car;
        const dx = b.x - c.x, dy = b.y - c.y;
        const localX = dx * Math.cos(-c.angle) - dy * Math.sin(-c.angle);
        const localY = dx * Math.sin(-c.angle) + dy * Math.cos(-c.angle);
        if (Math.abs(localX) < c.w / 2 && Math.abs(localY) < c.h / 2) {
          game.damageCar(c, 8);
          dead = true;
        }
      }
    }
    if (dead) game.bullets.splice(i, 1);
  }
  game.shotsFiredRecently = Math.max(0, game.shotsFiredRecently - dt);
}

export function damageCar(game, car, amount) {
  if (car.hp <= 0) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    explodeCar(game, car);
  }
}

export function explodeCar(game, car) {
  game.spawnExplosion(car.x, car.y);
  game.audio.explosion();
  game.addShake(12);
  // gas station hazard: a car blowing up next to the pumps sets the whole
  // forecourt off — a second, bigger blast and a warning toast.
  const gas = game.world.landmarks ? game.world.landmarks.find((l) => l.id === 'gas') : null;
  if (gas && gas.pumps) {
    for (const p of gas.pumps) {
      if (Math.hypot(car.x - p.x, car.y - p.y) < 70) {
        game.spawnExplosion(car.x, car.y);
        game.addShake(10);
        game.showToast('GAS STATION!', 'The pumps went up — get clear!');
        break;
      }
    }
  }
  if (car.driver === 'player') {
    game.player.hp -= 35;
    game.exitCar(true);
    if (game.player.hp <= 0) game.killPlayer('wasted');
  }
  // remove from lists
  const ci = game.cars.indexOf(car);
  if (ci >= 0) game.cars.splice(ci, 1);
  const pi = game.policeCars.indexOf(car);
  if (pi >= 0) game.policeCars.splice(pi, 1);
  // chain: damage nearby cars
  for (const o of [...game.cars]) {
    if (Math.hypot(o.x - car.x, o.y - car.y) < 90) game.damageCar(o, 45);
  }
  if (Math.hypot(game.player.x - car.x, game.player.y - car.y) < 80 && game.player.onFoot) {
    game.player.hp -= 25;
    if (game.player.hp <= 0) game.killPlayer('wasted');
  }
}

export function spawnExplosion(game, x, y) {
  for (let i = 0; i < 22; i++) {
    const a = range(game.rng, 0, Math.PI * 2), sp = range(game.rng, 40, 260);
    game.spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, range(game.rng, 0.4, 0.9), range(game.rng, 6, 16),
      pick(game.rng, ['#ffdd55', '#ff8822', '#ff4422', '#ffcc88']), 'fire');
  }
  for (let i = 0; i < 12; i++) {
    game.spawnParticle(x + range(game.rng, -14, 14), y + range(game.rng, -14, 14), range(game.rng, -16, 16), range(game.rng, -46, -10),
      range(game.rng, 0.9, 1.8), range(game.rng, 12, 22), 'rgba(50,50,50,0.55)', 'smoke');
  }
  game.spawnParticle(x, y, 0, 0, 0.28, 90, 'rgba(255,240,180,0.9)', 'ring');
  game.spawnParticle(x, y, 0, 0, 0.12, 60, 'rgba(255,255,255,0.9)', 'flash');
  // the blast lights the whole block for a moment
  if (game.spawnFlash) game.spawnFlash(x, y, 0xff8822);
}

export function spawnParticle(game, x, y, vx, vy, life, size, color, kind) {
  if (game.particles.length >= MAX_PARTICLES) game.particles.shift();
  game.particles.push({ x, y, vx, vy, life, maxLife: life, size, color, kind });
}

export function spawnSparks(game, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = range(game.rng, 0, Math.PI * 2), sp = range(game.rng, 60, 220);
    game.spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, range(game.rng, 0.1, 0.3), range(game.rng, 2, 4), '#ffd970', 'spark');
  }
}

export function spawnBlood(game, x, y) {
  for (let i = 0; i < 8; i++) {
    const a = range(game.rng, 0, Math.PI * 2), sp = range(game.rng, 20, 90);
    game.spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, range(game.rng, 0.2, 0.5), range(game.rng, 3, 6), '#a01818', 'blood');
  }
}

export function updateParticles(game, dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= dt;
    if (p.life <= 0) { game.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'smoke') { p.vy -= 12 * dt; p.size += 14 * dt; p.vx *= 0.98; }
    else if (p.kind === 'fire') { p.vx *= 0.94; p.vy *= 0.94; p.size *= 0.98; }
    else if (p.kind === 'spark') { p.vy += 300 * dt; }
    else if (p.kind === 'blood') { p.vx *= 0.9; p.vy *= 0.9; }
    else if (p.kind === 'ring') { p.size += 320 * dt; }
  }
}

export function addSkid(game, x, y, angle, w) {
  game.skids.push({ x, y, angle, w, life: 9 });
  if (game.skids.length > 420) game.skids.shift();
}

export function updateSkids(game, dt) {
  for (let i = game.skids.length - 1; i >= 0; i--) {
    game.skids[i].life -= dt;
    if (game.skids[i].life <= 0) game.skids.splice(i, 1);
  }
}
