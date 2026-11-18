// entities.js — the actors of SOLMARA: player on foot, cars with arcade physics,
// pedestrians. Creation + movement. AI lives in traffic.js / police.js.
import { TUNING, CAR_TYPES, WEAPONS } from './config.js';
import { clamp, lerp, angDiff, dist2, pick, range } from './random.js';
import { makePedLook, JAX_LOOK } from './meshes.js';

let nextId = 1;

export function createPlayer(world) {
  return {
    id: 0, x: world.playerSpawn.x, y: world.playerSpawn.y,
    vx: 0, vy: 0, angle: -Math.PI / 2, hp: TUNING.playerHp, money: 0,
    onFoot: true, car: null, aimAngle: -Math.PI / 2,
    shootCd: 0, run: false, dead: false, busted: false,
    walkPhase: 0, moving: false, look: JAX_LOOK,
    weapon: 'pistol', owned: { shotgun: false, smg: false },
    ammo: { shotgun: 0, smg: 0 }, nos: 100, station: 0,
  };
}

export function createCar(world, rng, type, x, y, angle, driver) {
  const t = CAR_TYPES[type] || CAR_TYPES.sedan;
  // plate code + trim: the 3D builder stamps a real license plate on every car
  const plate = 'SOL-' + String(100 + Math.floor(rng() * 900));
  return {
    id: nextId++, type, x, y, angle,
    vx: 0, vy: 0, speed: 0, w: t.w, h: t.h,
    color: type === 'taxi' ? '#f2c200' : type === 'police' ? '#f2f2f2' : pick(rng, ['#d9382b', '#2b6fd9', '#e8b62b', '#3aa655', '#e8e8e8', '#222831', '#8a2fd9', '#ff7a1a', '#18b8a8', '#c9a227']),
    plate, trim: pick(rng, ['#d8dde6', '#b8bcc4', '#8a8f9a']),
    hp: t.hp, maxHp: t.hp, driver: driver || null,
    target: null, stuck: 0, siren: type === 'police', sirenPhase: rng() * 6,
    smoke: 0, skid: 0, brakeLight: false,
  };
}

// Parked landmark vehicles: two interceptors outside Police HQ, a fire truck
// at the station, a yellow school bus at the school, and a couple of cars at
// the mall lot. They are ordinary parked cars the player can steal.
export function spawnLandmarkVehicles(game) {
  const w = game.world;
  const lm = (id) => (w.landmarks || []).find((l) => l.id === id);
  const park = (type, color, plate, x, y, angle) => {
    const c = createCar(w, game.rng, type, x, y, angle, 'parked');
    c.color = color; c.plate = plate;
    game.cars.push(c);
    return c;
  };
  const hq = lm('police');
  if (hq) {
    park('police', '#f2f2f2', 'PD-07', hq.cx - 34, hq.cy + 58, Math.PI / 2);
    park('police', '#f2f2f2', 'PD-12', hq.cx + 34, hq.cy + 58, Math.PI / 2);
  }
  const fire = lm('fire');
  if (fire) park('truck', '#c02020', 'FD-07', fire.cx - 20, fire.cy + 58, Math.PI / 2);
  const hospital = lm('hospital');
  if (hospital) park('van', '#f2f2f2', 'EMS-1', hospital.cx - 30, hospital.cy + 58, Math.PI / 2);
  const school = lm('school');
  if (school) park('van', '#f2c200', 'BUS-1', school.cx + 40, school.cy + 52, Math.PI / 2);
  const mall = lm('mall');
  if (mall) {
    park('sedan', '#d9382b', 'SOL-214', mall.cx - 55, mall.cy + 88, Math.PI / 2);
    park('coupe', '#2b6fd9', 'SOL-318', mall.cx - 33, mall.cy + 88, Math.PI / 2);
    park('sedan', '#3aa655', 'SOL-451', mall.cx + 33, mall.cy + 88, Math.PI / 2);
    park('van', '#e8e8e8', 'SOL-502', mall.cx + 55, mall.cy + 88, Math.PI / 2);
  }
}

export function createPed(world, rng, x, y) {
  // every pedestrian gets a full look (kind, hair, outfit, height) so no two
  // on the same sidewalk are identical; shirt/skin mirror the look for any
  // legacy reader.
  const look = makePedLook(rng);
  return {
    id: nextId++, x, y, angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 34, 58), state: 'walk', tx: x, ty: y,
    shirt: look.shirt, skin: look.skin, look,
    wait: 0, fleeX: 0, fleeY: 0, walkPhase: range(rng, 0, 6),
  };
}

// --- player on foot ---
export function updatePlayerFoot(game, dt) {
  const p = game.player, inp = game.input;
  const ax = inp.axis();
  const running = inp.down('shift');
  const max = running ? TUNING.playerRun : TUNING.playerWalk;
  const tx = ax.x * max, ty = ax.y * max;
  p.vx = lerp(p.vx, tx, Math.min(1, dt * 10));
  p.vy = lerp(p.vy, ty, Math.min(1, dt * 10));
  const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
  const c = game.world.collideCircle(nx, ny, 10);
  p.x = c.x; p.y = c.y;
  p.moving = Math.abs(p.vx) + Math.abs(p.vy) > 20;
  p.run = running && p.moving;
  const prevPhase = p.walkPhase;
  if (p.moving) p.walkPhase += dt * (running ? 14 : 9);
  // footsteps: a quiet tick each time a foot plants (every half walk cycle)
  if (p.moving && Math.floor(p.walkPhase / Math.PI) !== Math.floor(prevPhase / Math.PI)) game.audio.step();
  // aim at mouse (screen -> world)
  const m = game.screenToWorld(inp.mouse.x, inp.mouse.y);
  p.aimAngle = Math.atan2(m.y - p.y, m.x - p.x);
  if (p.moving) p.angle = Math.atan2(p.vy, p.vx);
  // shooting: current weapon (pistol endless, shotgun/SMG use ammo)
  p.shootCd -= dt;
  const w = WEAPONS[p.weapon] || WEAPONS.pistol;
  if (inp.mouse.down && p.shootCd <= 0) {
    const outOfAmmo = (p.weapon === 'shotgun' && p.ammo.shotgun <= 0) ||
      (p.weapon === 'smg' && p.ammo.smg <= 0);
    if (outOfAmmo) {
      p.shootCd = 0.3;
      game.audio.click();
      game.showToast('OUT OF AMMO', 'Visit the gun shop — green beacon downtown.');
    } else {
      p.shootCd = w.cd;
      for (let i = 0; i < w.pellets; i++) {
        const a = p.aimAngle + (Math.random() - 0.5) * 2 * w.spread;
        game.fireBullet(p.x + Math.cos(p.aimAngle) * 14, p.y + Math.sin(p.aimAngle) * 14, a, 'player', w.dmg);
      }
      if (p.weapon === 'shotgun') p.ammo.shotgun--;
      if (p.weapon === 'smg') p.ammo.smg--;
      game.audio.shot();
      game.stats.shots++;
    }
  }
  // weapon switch: 1 pistol, 2 shotgun, 3 SMG (owned only)
  if (inp.hit('1')) p.weapon = 'pistol';
  if (inp.hit('2') && p.owned.shotgun) { p.weapon = 'shotgun'; game.audio.click(); }
  if (inp.hit('3') && p.owned.smg) { p.weapon = 'smg'; game.audio.click(); }
  // enter car
  if (inp.hit('e')) {
    const car = game.nearestCar(p.x, p.y, 46);
    if (car && car.driver !== 'player') {
      game.enterCar(car);
    }
  }
}

// --- arcade car physics: forward speed, steering, grip, drag ---
// boost: 1 while NOS is held (faster accel + higher top speed).
export function updateCarPhysics(game, car, dt, throttle, steer, boost) {
  const t = CAR_TYPES[car.type];
  const accel = TUNING.carAccel * t.accel * (boost ? 1.7 : 1);
  const maxSpd = TUNING.carMaxSpeed * t.max * (boost ? 1.45 : 1);
  // forward speed along heading
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let fwd = car.vx * fx + car.vy * fy;
  fwd += throttle * accel * dt;
  // drag + rolling resistance
  fwd -= fwd * TUNING.carDrag * dt;
  fwd = clamp(fwd, -TUNING.carReverseMax, maxSpd);
  // steering (stronger at moderate speed, none when stopped)
  const steerAuthority = clamp(Math.abs(fwd) / 90, 0, 1) * (fwd < 0 ? -1 : 1);
  car.angle += steer * TUNING.carTurn * steerAuthority * dt;
  // rebuild velocity: mostly forward, a little lateral slide (drift)
  const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
  const latX = car.vx - (car.vx * nfx + car.vy * nfy) * nfx;
  const latY = car.vy - (car.vx * nfx + car.vy * nfy) * nfy;
  const grip = Math.exp(-TUNING.carGrip * dt);
  car.vx = nfx * fwd + latX * grip;
  car.vy = nfy * fwd + latY * grip;
  car.speed = fwd;
  // integrate + collide (circle approx)
  const nx = car.x + car.vx * dt, ny = car.y + car.vy * dt;
  const r = car.w * 0.42;
  const c = game.world.collideCircle(nx, ny, r);
  if (Math.abs(c.x - nx) > 0.5 || Math.abs(c.y - ny) > 0.5) {
    // hit something solid: scrape speed, spark, damage
    const impact = Math.abs(fwd);
    car.vx *= 0.45; car.vy *= 0.45;
    if (impact > 160) {
      game.damageCar(car, impact * 0.02);
      game.audio.crash(impact);
      game.addShake(Math.min(8, impact * 0.02));
      game.spawnSparks(car.x, car.y, 6);
      if (car.driver === 'player') game.addWanted(0.15);
    }
  }
  car.x = c.x; car.y = c.y;
  // smoke when hurt
  if (car.hp < car.maxHp * 0.35) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      game.spawnParticle(car.x - Math.cos(car.angle) * car.w * 0.4, car.y - Math.sin(car.angle) * car.w * 0.4, 0, -30, 0.9, 9, 'rgba(60,60,60,0.5)', 'smoke');
    }
  }
  // skid marks when hard steering at speed
  if (Math.abs(steer) > 0.6 && Math.abs(fwd) > 260) {
    car.skid += dt;
    if (car.skid > 0.05) {
      car.skid = 0;
      game.addSkid(car.x, car.y, car.angle, car.w);
    }
  }
  car.brakeLight = throttle < 0;
}

// --- player driving ---
export function updatePlayerCar(game, dt) {
  const p = game.player, car = p.car, inp = game.input;
  const ax = inp.axis();
  const throttle = ax.y < 0 ? 1 : ax.y > 0 ? -0.7 : 0;
  const steer = ax.x;
  // NOS boost (hold N): drains the tank, refills slowly when off
  const nos = inp.down('n') && p.nos > 0 && throttle > 0;
  if (nos) {
    p.nos = Math.max(0, p.nos - 28 * dt);
    if (Math.abs(car.speed) > 200) {
      game.spawnParticle(car.x - Math.cos(car.angle) * car.w * 0.5, car.y - Math.sin(car.angle) * car.w * 0.5,
        -Math.cos(car.angle) * 120, -Math.sin(car.angle) * 120, 0.25, 7, '#4aa8ff', 'fire');
    }
  } else {
    p.nos = Math.min(100, p.nos + 5 * dt);
  }
  updateCarPhysics(game, car, dt, throttle, steer, nos);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  // exit car
  if (inp.hit('e')) game.exitCar();
  // handbrake: hard turn + slide
  if (inp.down(' ')) {
    car.vx *= Math.exp(-2.2 * dt); car.vy *= Math.exp(-2.2 * dt);
    if (Math.abs(car.speed) > 200) game.addSkid(car.x, car.y, car.angle, car.w);
  }
  // horn
  if (inp.hit('h')) game.audio.horn();
  // radio: R cycles the station
  if (inp.hit('r')) {
    const name = game.audio.setStation(p.station + 1);
    p.station = game.audio.station;
    game.showToast('RADIO: ' + name, 'R switches station · M mutes');
  }
}

// --- pedestrians ---
export function updatePed(game, ped, dt) {
  const w = game.world;
  if (ped.state === 'flee') {
    const a = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
    ped.angle = a;
    const sp = 150;
    const nx = ped.x + Math.cos(a) * sp * dt, ny = ped.y + Math.sin(a) * sp * dt;
    const c = w.collideCircle(nx, ny, 8);
    ped.x = c.x; ped.y = c.y;
    ped.walkPhase += dt * 16;
    ped.wait -= dt;
    if (ped.wait <= 0) ped.state = 'walk';
    return;
  }
  if (ped.wait > 0) { ped.wait -= dt; return; }
  const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    // pick a new nearby sidewalk target
    const p = w.randomRoadPoint(game.rng);
    ped.tx = p.x + (game.rng() < 0.5 ? -26 : 26);
    ped.ty = p.y + (game.rng() < 0.5 ? -26 : 26);
    ped.wait = range(game.rng, 0, 2.5);
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
  const c = w.collideCircle(nx, ny, 8);
  ped.x = c.x; ped.y = c.y;
  ped.walkPhase += dt * 8;
}

export function pedFlee(game, ped, fx, fy) {
  ped.state = 'flee';
  ped.fleeX = fx; ped.fleeY = fy;
  ped.wait = 2.5;
}
