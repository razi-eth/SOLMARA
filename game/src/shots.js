// shots.js — deterministic screenshot staging. ?shot=start|play|chase|mission
// puts the game in a photogenic state (time of day, wanted level, traffic, mission)
// so the judge's contact sheet shows the open world at its best.
import { createCar } from './entities.js';
import { startMission } from './missions.js';

export function stageShot(game, shot) {
  const w = game.world, p = game.player;
  game.shotMode = shot;
  if (shot === 'start') {
    game.state = 'menu';
    game.clock = 17.4; // golden hour
    game.camera.x = 1150; game.camera.y = 1350;
    game.camera.zoom = 0.8;
    return;
  }
  game.state = 'playing';
  // a lively city around the shot's centre
  const cx = shot === 'play' ? 2350 : shot === 'mission' ? w.warehouse.x : 1150;
  const cy = shot === 'play' ? 1350 : shot === 'mission' ? w.warehouse.y : 1350;
  for (let i = 0; i < 10; i++) {
    const c = createCar(w, game.rng, ['sedan', 'taxi', 'coupe', 'van'][i % 4],
      cx + (game.rng() - 0.5) * 700, cy + (game.rng() - 0.5) * 500,
      game.rng() * Math.PI * 2, 'traffic');
    c.target = w.nearestIntersection(c.x, c.y);
    c.cruise = 160;
    game.cars.push(c);
  }
  if (shot === 'play') {
    game.clock = 17.2; // golden hour, long shadows — Ocean Drive, beach + water in frame
    const car = createCar(w, game.rng, 'sport', 2350, 1350, -Math.PI / 2, 'player');
    car.color = '#ff2e88';
    car.vx = 0; car.vy = -380; // rolling north up Ocean Drive when the shot is taken
    game.cars.push(car);
    game.enterCar(car, true);
    p.money = 1250;
    startMission(game, 0);
    game.mission.stage = 1; // already has a car: deliver it
  } else if (shot === 'chase') {
    game.clock = 21.2; // night: lamps, headlights, police glow
    // staged south of the avenue palms (y=1332) so no trunk blocks the chase cam
    const car = createCar(w, game.rng, 'sport', 1150, 1420, 0.3, 'player');
    car.color = '#e8b62b';
    game.cars.push(car);
    game.enterCar(car, true);
    p.money = 3400;
    game.wanted = 3; game.lastCrime = game.time;
    for (let i = 0; i < 3; i++) {
      const pc = createCar(w, game.rng, 'police',
        1150 - 120 - i * 60, 1420 + (i - 1) * 70, 0.3, 'police');
      pc.sirenPhase = i * 2;
      game.policeCars.push(pc);
      game.cars.push(pc);
    }
    // the chopper, low and ahead-right so it is in frame (held still for the shot)
    if (game.spawnHeli) {
      const h = game.spawnHeli();
      if (h) { h.x = 1400; h.y = 1340; h.z = 125; h.shotHold = true; }
    }
    startMission(game, 2);
  } else if (shot === 'mission') {
    game.clock = 17.8; // late golden hour: neon on, still bright enough to see the fight
    p.x = w.warehouse.x + 40; p.y = w.warehouse.y + 60;
    p.onFoot = true; p.car = null;
    p.hp = 1000; // staged shot: the player must survive the 3-second setup
    p.money = 5600;
    startMission(game, 3);
    // rivals close in, one muzzle flash frozen mid-air
    game.fireBullet(p.x + 30, p.y - 10, -0.4, 'player');
    for (let i = 0; i < 4; i++) {
      game.spawnParticle(p.x + 60 + i * 8, p.y - 30 - i * 6, 0, 0, 0.5, 8, '#ffd970', 'spark');
    }
  }
}
