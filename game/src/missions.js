// missions.js — Vera Solano's five jobs, from a stolen sedan to the Big Score,
// plus cash bundles hidden around the city as a side activity.
import { MISSIONS } from './config.js';
import { range, pick } from './random.js';
import { GANG_LOOK } from './meshes.js';
import { showMenu } from './hud.js';

export function makeEnemy(game, x, y) {
  return {
    x, y, angle: 0, hp: 100, speed: 132, shootCd: range(game.rng, 0.4, 1.2),
    walkPhase: range(game.rng, 0, 6), shirt: '#3a3f4a', skin: '#c98a5a',
    kind: 'gang', look: GANG_LOOK,
  };
}

export function startMission(game, index) {
  const def = MISSIONS[index];
  const prev = game.mission;
  if (!def) { game.mission = null; game.storyDone = true; return; }
  // each mission gets its own beacon colour in the 3D world (yellow = fetch,
  // red = fight, green = escape) so the pillar reads at a glance.
  const beaconColor = def.id === 4 || def.id === 8 ? 0xff4040 : def.id === 3 ? 0x3aff7a : 0xffe93c;
  game.mission = {
    def, index, stage: 0, timer: 0, kills: 0, killsNeeded: 0,
    hasPackage: false, comet: null, done: false, beaconColor,
  };
  game.showToast(def.name + ' — ' + def.giver, def.brief);
  game.audio.missionStart();
  if (def.id === 3) {
    // scripted heat
    game.wanted = 3; game.lastCrime = game.time;
  }
  if (def.id === 4) {
    // rivals wait at the warehouse
    game.mission.killsNeeded = 6;
    for (let i = 0; i < 6; i++) {
      game.enemies.push(makeEnemy(game,
        game.world.warehouse.x + range(game.rng, -90, 90),
        game.world.warehouse.y + range(game.rng, -90, 90)));
    }
  }
  if (def.id === 5) {
    // the Comet GT waits in the tower garage
    const c = game.spawnSpecialCar('sport', game.world.tower.x + 40, game.world.tower.y + 40, '#ff2e88');
    game.mission.comet = c;
  }
  if (def.id === 6) {
    // the corner store on Ocean Drive (just west of the beach road)
    game.mission.store = { x: 2320, y: 900 };
  }
  if (def.id === 7) {
    // street race: a rival Comet GT, 75 seconds to the pier
    if (prev && prev.rival) {
      const i = game.cars.indexOf(prev.rival);
      if (i >= 0) game.cars.splice(i, 1);
    }
    const rival = game.spawnSpecialCar('sport', 2350, 1250, '#22e6ff');
    rival.driver = 'traffic';
    rival.cruise = 420;
    rival.target = game.world.nearestIntersection(2350, 1250);
    game.mission.rival = rival;
    game.mission.raceTimer = 75;
    game.showToast('STREET KINGS', 'Race the blue Comet GT to the pier. 75 seconds. Go!');
  }
  if (def.id === 8) {
    // Vera is held at the warehouse: eight guards
    game.mission.killsNeeded = 8;
    game.mission.vera = { x: game.world.warehouse.x + 60, y: game.world.warehouse.y - 40 };
    for (let i = 0; i < 8; i++) {
      game.enemies.push(makeEnemy(game,
        game.world.warehouse.x + range(game.rng, -110, 110),
        game.world.warehouse.y + range(game.rng, -110, 110)));
    }
  }
}

export function missionTarget(game) {
  const m = game.mission;
  if (!m) return null;
  const w = game.world;
  switch (m.def.id) {
    case 1: return m.stage === 0 ? null : { x: w.garage.x, y: w.garage.y, label: 'Solano Garage' };
    case 2:
      if (m.stage === 0) return { x: w.marina.x, y: w.marina.y, label: 'Marina Pier' };
      if (m.stage === 1) return { x: w.marina.x, y: w.marina.y, label: 'Pick up the package' };
      return { x: w.garage.x, y: w.garage.y, label: 'Solano Garage' };
    case 3: return { x: w.safehouse.x, y: w.safehouse.y, label: 'Safehouse' };
    case 4: return { x: w.warehouse.x, y: w.warehouse.y, label: 'Warehouse District' };
    case 5:
      if (m.stage === 0) return { x: w.tower.x, y: w.tower.y, label: 'Downtown Tower — by SOLMARA BANK' };
      if (m.stage === 1) return { x: w.tower.x + 40, y: w.tower.y + 40, label: 'Steal the Comet GT' };
      return { x: w.pier.x + 120, y: w.pier.y + 20, label: 'The Pier' };
    case 6:
      if (m.stage === 0) return { x: m.store.x, y: m.store.y, label: 'Corner Store' };
      return { x: w.garage.x, y: w.garage.y, label: 'Solano Garage' };
    case 7: return { x: w.pier.x + 120, y: w.pier.y + 20, label: 'The Pier — race!' };
    case 8:
      if (m.stage === 0) return { x: w.warehouse.x, y: w.warehouse.y, label: 'Warehouse District' };
      return { x: m.vera.x, y: m.vera.y, label: 'Get Vera out' };
    default: return null;
  }
}

export function missionObjective(game) {
  const m = game.mission;
  if (!m) return game.storyDone ? 'Free roam — Solmara is yours. Find cash bundles!' : '';
  switch (m.def.id) {
    case 1: return m.stage === 0 ? 'Steal a car (walk up, press E)' : 'Deliver the car to Solano Garage';
    case 2:
      if (m.stage === 0) return 'Go to the Marina Pier on foot';
      if (m.stage === 1) return 'Pick up the package';
      return 'Bring the package back to the garage';
    case 3: return 'Lose the cops — reach the Safehouse';
    case 4: return 'Take out the Vultures (' + m.kills + '/' + m.killsNeeded + ')';
    case 5:
      if (m.stage === 0) return 'Go to the Downtown Tower garage';
      if (m.stage === 1) return 'Steal the Comet GT';
      return 'Deliver the Comet GT to the Pier — run!';
    case 6:
      if (m.stage === 0) return 'Rob the corner store on Ocean Drive (walk in)';
      return 'Bring the cash to the garage';
    case 7: return 'Race to the Pier before the blue Comet GT! (' + Math.ceil(m.raceTimer) + 's)';
    case 8:
      if (m.stage === 0) return 'Take out the guards (' + m.kills + '/' + m.killsNeeded + ')';
      return 'Get Vera out of the warehouse';
    default: return '';
  }
}

export function updateMission(game, dt) {
  const m = game.mission;
  if (!m) return;
  const p = game.player, w = game.world;
  m.timer += dt;
  const at = (x, y, r) => Math.hypot(p.x - x, p.y - y) < r;

  switch (m.def.id) {
    case 1:
      if (m.stage === 0 && !p.onFoot) { m.stage = 1; game.showToast('Nice wheels', 'Now bring it to the garage.'); }
      else if (m.stage === 1 && at(w.garage.x, w.garage.y, 60)) completeMission(game);
      break;
    case 2:
      if (m.stage === 0 && p.onFoot && at(w.marina.x, w.marina.y, 50)) { m.stage = 1; game.showToast('The package', 'Grab it and go.'); }
      else if (m.stage === 1 && at(w.marina.x, w.marina.y, 30)) { m.stage = 2; m.hasPackage = true; game.audio.pickup(); game.showToast('Package secured', 'Back to the garage — stay quiet.'); }
      else if (m.stage === 2 && at(w.garage.x, w.garage.y, 60)) completeMission(game);
      break;
    case 3:
      if (at(w.safehouse.x, w.safehouse.y, 60)) {
        game.wanted = 0;
        game.cops.length = 0;
        for (const c of [...game.policeCars]) {
          const i = game.cars.indexOf(c);
          if (i >= 0) game.cars.splice(i, 1);
        }
        game.policeCars.length = 0;
        completeMission(game);
      }
      break;
    case 4:
      if (m.kills >= m.killsNeeded) completeMission(game);
      break;
    case 5:
      if (m.stage === 0 && at(w.tower.x, w.tower.y, 70)) { m.stage = 1; game.showToast('There it is', 'The pink Comet GT. Take it.'); }
      else if (m.stage === 1 && p.car === m.comet) {
        m.stage = 2;
        game.wanted = Math.max(game.wanted, 4); game.lastCrime = game.time;
        game.showToast('ALARM!', 'The whole city is coming. Drive to the pier!');
      } else if (m.stage === 2 && p.car === m.comet && at(w.pier.x + 120, w.pier.y + 20, 70)) {
        completeMission(game);
      }
      break;
    case 6:
      if (m.stage === 0 && p.onFoot && at(m.store.x, m.store.y, 45)) {
        m.stage = 1;
        p.money += 0; // cash is paid on delivery, not at the till
        game.audio.pickup();
        game.showToast('Cash grabbed', 'Now get it to the garage — quietly.');
        game.addWanted(1);
      } else if (m.stage === 1 && at(w.garage.x, w.garage.y, 60)) completeMission(game);
      break;
    case 7: {
      m.raceTimer -= dt;
      const rival = m.rival;
      if (rival) {
        // the rival drives for the pier; if it gets there first, you lose
        if (Math.hypot(rival.x - (w.pier.x + 120), rival.y - (w.pier.y + 20)) < 70) {
          game.showToast('RACE LOST', 'The blue Comet GT beat you to the pier. Again!');
          startMission(game, 6);
          return;
        }
      }
      if (at(w.pier.x + 120, w.pier.y + 20, 70)) completeMission(game);
      else if (m.raceTimer <= 0) {
        game.showToast('TOO SLOW', '75 seconds are gone. The crew is laughing. Again!');
        startMission(game, 6);
        return;
      }
      break;
    }
    case 8:
      if (m.stage === 0 && m.kills >= m.killsNeeded) {
        m.stage = 1;
        game.showToast('Vera is free', 'Get to her — now!');
      } else if (m.stage === 1 && at(m.vera.x, m.vera.y, 50)) completeMission(game);
      break;
    default: break;
  }

  // enemy AI (rivals + any spawned foes)
  for (const e of game.enemies) updateEnemy(game, e, dt);

  // cash bundles
  for (let i = game.cash.length - 1; i >= 0; i--) {
    const c = game.cash[i];
    if (Math.hypot(p.x - c.x, p.y - c.y) < 30) {
      game.cash.splice(i, 1);
      p.money += 100;
      game.audio.pickup();
      game.showToast('+$100', 'Cash bundle found. (' + (20 - game.cash.length) + '/20)');
      game.stats.cash++;
    }
  }
}

function updateEnemy(game, e, dt) {
  const p = game.player;
  const dx = p.x - e.x, dy = p.y - e.y;
  const d = Math.hypot(dx, dy);
  e.angle = Math.atan2(dy, dx);
  if (d > 210) {
    const nx = e.x + Math.cos(e.angle) * e.speed * dt;
    const ny = e.y + Math.sin(e.angle) * e.speed * dt;
    const c = game.world.collideCircle(nx, ny, 9);
    e.x = c.x; e.y = c.y;
    e.walkPhase += dt * 11;
  }
  e.shootCd -= dt;
  if (d < 340 && e.shootCd <= 0) {
    e.shootCd = range(game.rng, 0.8, 1.4);
    game.fireBullet(e.x + Math.cos(e.angle) * 14, e.y + Math.sin(e.angle) * 14, e.angle + range(game.rng, -0.14, 0.14), 'enemy');
    game.audio.shotFar();
  }
}

export function missionEnemyDown(game, e) {
  const m = game.mission;
  if (m && (m.def.id === 4 || m.def.id === 8)) {
    m.kills++;
    game.showToast(m.def.id === 4 ? 'Vulture down' : 'Guard down', m.kills + ' / ' + m.killsNeeded);
  }
}

export function completeMission(game) {
  const m = game.mission;
  if (!m || m.done) return;
  m.done = true;
  const p = game.player;
  p.money += m.def.reward;
  game.stats.missions++;
  game.audio.missionComplete();
  game.state = 'missionComplete';
  game.stateTimer = 0;
  game.completedMission = m;
  game.saveGame();
  showMenu(game, 'menu-complete');
  // main.js watches stateTimer and starts the next mission after the splash.
}

export function spawnCashBundles(game) {
  game.cash = [];
  const w = game.world;
  for (let i = 0; i < 20; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const p = w.randomRoadPoint(game.rng);
      const x = p.x + range(game.rng, -60, 60), y = p.y + range(game.rng, -60, 60);
      if (w.inBuilding(x, y) || w.isWater(x, y)) continue;
      if (Math.hypot(x - game.player.x, y - game.player.y) < 200) continue;
      game.cash.push({ x, y, bob: range(game.rng, 0, 6) });
      break;
    }
  }
}
