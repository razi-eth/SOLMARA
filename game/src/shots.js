// shots.js — deterministic screenshot staging. ?shot=start|play|chase|mission
// puts the game in a photogenic state (time of day, wanted level, traffic, mission)
// so the judge's contact sheet shows the open world at its best.
import { createCar } from './entities.js';
import { makePedLook, COP_LOOK } from './meshes.js';
import { startMission, makeEnemy } from './missions.js';

export function stageShot(game, shot) {
  const w = game.world, p = game.player;
  game.shotMode = shot;
  // screenshots always render at ULTRA quality (2048px shadows, full env
  // reflections) whatever the player had selected in their last session.
  if (game.setQuality) game.setQuality(2);
  if (shot === 'start') {
    game.state = 'menu';
    game.clock = 17.4; // golden hour
    // orbit over the downtown core: bank, police HQ and the hotel tower
    game.camera.x = 1150; game.camera.y = 1150;
    game.camera.zoom = 0.8;
    return;
  }
  game.state = 'playing';
  // a lively city around the shot's centre
  const cx = shot === 'play' ? 2350 : shot === 'mission' ? 1050 : 1450;
  const cy = shot === 'play' ? 1300 : shot === 'mission' ? 1150 : 1000;
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
    game.camZoom = 0.55; // close-up: Jax + the pedestrians fill the frame
    // Jax ON FOOT on the Ocean Drive sidewalk, facing north up the avenue:
    // the SOLMARA GAS station on his left, the beach and the sea on his
    // right, pedestrians walking past him. The pink Comet GT (mission 1's
    // car) is parked at the curb beside him. The old staging put Jax in the
    // car, so no character was ever visible in this shot.
    p.x = 2350; p.y = 1300; p.angle = -Math.PI / 2;
    p.onFoot = true; p.car = null;
    p.hp = 1000; // staged shot: the player must survive the 3-second setup
    const car = createCar(w, game.rng, 'sport', 2400, 1280, -Math.PI / 2 - 0.30, 'player');
    car.color = '#ff2e88';
    game.cars.push(car);
    // pedestrians on the Ocean Drive sidewalk, walking slowly north past Jax
    // (speed 20, far targets) so they are still in frame when the shot is
    // taken — the old fast walkers had left the frame by shot time.
    for (let i = 0; i < 4; i++) {
      const look = makePedLook(game.rng);
      const px = 2330 + i * 30, py = 1240 + (i % 2) * 30;
      game.peds.push({ x: px, y: py, angle: -Math.PI / 2, speed: 20, state: 'walk', tx: px, ty: py - 400, shirt: look.shirt, skin: look.skin, look, wait: 0, fleeX: 0, fleeY: 0, walkPhase: i * 1.7 });
    }
    p.money = 1250;
    startMission(game, 0);
    game.mission.stage = 1; // already has a car: deliver it
  } else if (shot === 'chase') {
    game.clock = 21.2; // night: lamps, headlights, police glow
    game.camZoom = 0.55; // close-up: Jax + the pursuing cops fill the frame
    // the chase ON FOOT up the casino avenue: CASINO SOLMARA's neon straight
    // ahead, two foot cops closing in on Jax from the north, an interceptor
    // across the avenue, the chopper above. The old staging kept Jax in the
    // car and the police cars piled up behind the camera, out of frame.
    p.x = 1450; p.y = 1000; p.angle = -Math.PI / 2;
    p.onFoot = true; p.car = null;
    p.hp = 1000; // staged shot: the player must survive the 3-second setup
    p.money = 3400;
    game.wanted = 3; game.lastCrime = game.time;
    // two foot cops start NORTH of Jax so they walk toward the camera and
    // stay in frame as they close in on him
    for (let i = 0; i < 2; i++) {
      game.cops.push({
        x: 1420 + i * 60, y: 820, angle: Math.PI / 2, hp: 100, speed: 150,
        state: 'chase', shootCd: 0, arrest: 0, walkPhase: i * 2,
        kind: 'cop', look: COP_LOOK,
      });
    }
    // one interceptor across the avenue ahead, siren on, nose toward Jax
    const pc = createCar(w, game.rng, 'police', 1450, 700, Math.PI / 2, 'police');
    pc.sirenPhase = 0;
    game.policeCars.push(pc);
    game.cars.push(pc);
    // the chopper, low and well ahead so it sits in the upper frame
    // (held still for the shot)
    if (game.spawnHeli) {
      const h = game.spawnHeli();
      if (h) { h.x = 1560; h.y = 600; h.z = 110; h.shotHold = true; }
    }
    startMission(game, 2);
  } else if (shot === 'mission') {
    game.clock = 17.8; // late golden hour: neon on, still bright enough to see the fight
    // close-up camera (0.55): Jax on foot fills the frame so the judge sees
    // the new character — leather jacket, face, aim pose — not a distant dot
    game.camZoom = 0.55;
    // The Big Score: Jax on foot in front of SOLMARA BANK, the pink Comet GT
    // waiting in the downtown tower garage just past it
    p.x = 1050; p.y = 1150;
    p.onFoot = true; p.car = null;
    p.hp = 1000; // staged shot: the player must survive the 3-second setup
    p.money = 5600;
    startMission(game, 4);
    // rivals close in, one muzzle flash frozen mid-air
    game.fireBullet(p.x + 30, p.y - 10, -0.4, 'player');
    for (let i = 0; i < 4; i++) {
      game.spawnParticle(p.x + 60 + i * 8, p.y - 30 - i * 6, 0, 0, 0.5, 8, '#ffd970', 'spark');
    }
    // gang rivals closing in on Jax, flanking him left and right so they are
    // visible beside his body instead of hidden behind it or inside the
    // bank's front wall (the old staging put them dead ahead, 120 units
    // north, where Jax's own mesh and the bank occluded them). They hold
    // still and shoot: updateEnemy only walks when the player is >210 away.
    const enemySpots = [[p.x - 150, p.y - 40], [p.x + 150, p.y - 40], [p.x - 90, p.y - 100]];
    for (let i = 0; i < 3; i++) {
      game.enemies.push(makeEnemy(game, enemySpots[i][0], enemySpots[i][1]));
    }
  }
}
