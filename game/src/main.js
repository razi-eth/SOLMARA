// main.js — SOLMARA entry point. Owns the game object, the loop, the state machine
// (menu / playing / paused / gameover / missionComplete) and every glue method the
// systems call: enterCar, fireBullet, damageCar, addWanted, killPlayer, saveGame.
import { CFG, TUNING, STORY_INTRO } from './config.js';
import { mulberry32, clamp } from './random.js';
import { generateWorld } from './world.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { createPlayer, createCar, updatePlayerFoot, updatePlayerCar, updateCarPhysics } from './entities.js';
import { updateTrafficCar, collideCars, maintainPopulation, updatePeds } from './traffic.js';
import { addWanted, updateWanted, updatePoliceCar, updateCop, policeSirenOn } from './police.js';
import { fireBullet, updateBullets, damageCar, explodeCar, spawnExplosion, spawnParticle, spawnSparks, spawnBlood, updateParticles, addSkid, updateSkids } from './combat.js';
import { startMission, updateMission, missionTarget, missionObjective, missionEnemyDown, completeMission, spawnCashBundles } from './missions.js';
import { initRender3D, render3D } from './render3d.js';
import { SHOP_POS, updateShop, buyItem, closeShop } from './shop.js';
import { spawnHeli, clearHelis } from './heli.js';
import { drawHUD, showMenu, hideMenus, showToast } from './hud.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

export function newGame(seed = 20261118) {
  const world = generateWorld(seed);
  const game = {
    world,
    input: new Input(canvas),
    audio: new AudioSys(),
    rng: mulberry32(seed ^ 0x9e3779b9),
    ctx, canvas,
    state: 'menu',
    stateTimer: 0,
    time: 0,
    clock: 16.5, // golden-hour afternoon
    camera: { x: world.playerSpawn.x, y: world.playerSpawn.y, zoom: 0.9 },
    shake: 0,
    wanted: 0,
    lastCrime: -100,
    spawnTimer: 0,
    popTimer: 0,
    shotsFiredRecently: 0,
    toastTimer: 0,
    storyDone: false,
    completedMission: null,
    mission: null,
    player: createPlayer(world),
    cars: [], peds: [], cops: [], policeCars: [], enemies: [], helis: [],
    bullets: [], particles: [], skids: [], cash: [],
    stats: { missions: 0, carsStolen: 0, kills: 0, pedsHit: 0, shots: 0, cash: 0 },
    tod: null,
    view: { x0: 0, y0: 0, x1: 1280, y1: 800 },
    screenToWorld: (sx, sy) => ({ x: sx, y: sy }),
    missionTarget: null, missionObjective: null,
    shotMode: null,
    shopPos: SHOP_POS,
    shopHint: null,
  };
  initRender3D(game);

  // --- glue methods (called by the systems) ---
  game.fireBullet = (x, y, a, from, dmg) => fireBullet(game, x, y, a, from, dmg);
  game.spawnHeli = () => spawnHeli(game);
  game.clearHelis = () => clearHelis(game);
  game.damageCar = (car, amt) => damageCar(game, car, amt);
  game.addWanted = (amt) => addWanted(game, amt);
  game.addShake = (amt) => { game.shake = Math.min(16, game.shake + amt); };
  game.spawnParticle = (x, y, vx, vy, life, size, color, kind) => spawnParticle(game, x, y, vx, vy, life, size, color, kind);
  game.spawnSparks = (x, y, n) => spawnSparks(game, x, y, n);
  game.spawnBlood = (x, y) => spawnBlood(game, x, y);
  game.spawnExplosion = (x, y) => spawnExplosion(game, x, y);
  game.addSkid = (x, y, a, w) => addSkid(game, x, y, a, w);
  game.missionEnemyDown = (e) => missionEnemyDown(game, e);
  game.missionTarget = () => missionTarget(game);
  game.missionObjective = () => missionObjective(game);
  game.showToast = (t, s) => showToast(game, t, s);
  game.saveGame = () => saveGame(game);
  game.spawnSpecialCar = (type, x, y, color) => {
    const c = createCar(world, game.rng, type, x, y, 0, 'parked');
    c.color = color; c.special = true;
    game.cars.push(c);
    return c;
  };
  game.nearestCar = (x, y, maxD) => {
    let best = null, bd = maxD * maxD;
    for (const c of game.cars) {
      if (c.hp <= 0) continue;
      const d = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };
  game.enterCar = (car, silent) => {
    const p = game.player;
    if (car.driver === 'traffic') {
      // the driver bails and runs
      const ped = { x: car.x + 30, y: car.y, angle: 0, speed: 150, state: 'flee', tx: car.x, ty: car.y, shirt: '#e8b62b', skin: '#c98a5a', wait: 2.5, fleeX: car.x, fleeY: car.y, walkPhase: 0 };
      game.peds.push(ped);
      if (!silent) game.addWanted(0.5);
    } else if (car.driver === 'parked' && !silent) {
      game.addWanted(0.2);
    }
    car.driver = 'player';
    p.car = car; p.onFoot = false;
    p.x = car.x; p.y = car.y;
    game.stats.carsStolen++;
    game.audio.click();
  };
  game.exitCar = (wrecked) => {
    const p = game.player;
    if (!p.car) return;
    const car = p.car;
    car.driver = wrecked ? null : 'parked';
    const a = car.angle + Math.PI / 2;
    const nx = car.x + Math.cos(a) * 34, ny = car.y + Math.sin(a) * 34;
    const c = world.collideCircle(nx, ny, 10);
    p.x = c.x; p.y = c.y;
    p.vx = 0; p.vy = 0;
    p.car = null; p.onFoot = true;
  };
  game.killPlayer = (how) => {
    const p = game.player;
    if (p.dead) return;
    p.dead = true;
    p.busted = how === 'busted';
    if (p.car) game.exitCar(true);
    game.audio.busted();
    game.state = 'gameover';
    game.stateTimer = 0;
    showMenu(game, 'menu-gameover');
  };
  game.retry = () => {
    const p = game.player;
    const idx = game.mission ? game.mission.index : 0;
    p.dead = false; p.busted = false; p.hp = TUNING.playerHp;
    p.money = Math.max(0, p.money - 100);
    game.wanted = 0;
    p.x = world.safehouse.x; p.y = world.safehouse.y;
    p.onFoot = true; p.car = null;
    game.cops.length = 0;
    game.enemies.length = 0;
    game.clearHelis();
    for (const c of [...game.policeCars]) {
      const i = game.cars.indexOf(c);
      if (i >= 0) game.cars.splice(i, 1);
    }
    game.policeCars.length = 0;
    for (let i = game.cars.length - 1; i >= 0; i--) {
      if (game.cars[i].special) game.cars.splice(i, 1);
    }
    game.bullets.length = 0;
    startMission(game, idx);
    game.state = 'playing';
    hideMenus();
  };
  game.startNewGame = () => {
    clearSave();
    const p = game.player;
    p.money = 0; p.hp = TUNING.playerHp;
    p.x = world.playerSpawn.x; p.y = world.playerSpawn.y;
    p.onFoot = true; p.car = null; p.dead = false;
    game.wanted = 0;
    game.stats = { missions: 0, carsStolen: 0, kills: 0, pedsHit: 0, shots: 0, cash: 0 };
    game.storyDone = false;
    game.cars.length = 0; game.cops.length = 0; game.policeCars.length = 0;
    game.enemies.length = 0; game.bullets.length = 0;
    spawnCashBundles(game);
    startMission(game, 0);
    game.state = 'playing';
    hideMenus();
    game.audio.ensure();
  };
  game.continueGame = () => {
    const s = loadGame();
    if (!s) return game.startNewGame();
    const p = game.player;
    p.money = s.money; p.hp = TUNING.playerHp;
    p.x = s.x; p.y = s.y; p.onFoot = true; p.car = null; p.dead = false;
    game.clock = s.clock;
    game.stats = s.stats || game.stats;
    game.wanted = 0;
    game.storyDone = s.missionIndex >= 99;
    spawnCashBundles(game);
    startMission(game, Math.min(s.missionIndex, 7));
    game.state = 'playing';
    hideMenus();
    game.audio.ensure();
  };

  spawnCashBundles(game);
  return game;
}

const game = newGame();
window.__solmara = game; // for debugging / shot harness

// --- wire the DOM menus ---
function wire(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => { game.audio.ensure(); game.audio.click(); fn(); });
}
wire('btn-new', () => game.startNewGame());
wire('btn-continue', () => game.continueGame());
wire('btn-resume', () => { game.state = 'playing'; hideMenus(); });
wire('btn-save', () => { game.saveGame(); game.showToast('Saved', 'Progress saved to this browser.'); });
wire('btn-restart-mission', () => {
  if (game.mission) { game.retry(); }
});
wire('btn-quit', () => { game.state = 'menu'; showMenu(game, 'menu-start'); });
wire('btn-retry', () => game.retry());
wire('btn-menu', () => { game.state = 'menu'; showMenu(game, 'menu-start'); });
wire('btn-shop-close', () => closeShop(game));
wire('btn-buy-shotgun', () => buyItem(game, 'shotgun'));
wire('btn-buy-smg', () => buyItem(game, 'smg'));
wire('btn-buy-shells', () => buyItem(game, 'shells'));
wire('btn-buy-smg-ammo', () => buyItem(game, 'smg-ammo'));
wire('btn-buy-armor', () => buyItem(game, 'armor'));
wire('btn-sound', () => {
  game.audio.setMuted(!game.audio.muted);
  const b = document.getElementById('btn-sound');
  if (b) b.textContent = game.audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
});

// show Continue only when a save exists
if (!loadGame()) {
  const b = document.getElementById('btn-continue');
  if (b) b.style.display = 'none';
}

// --- shot staging (?shot=...) ---
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
// story intro is shown on the start menu in every mode
const intro = document.getElementById('story-intro');
if (intro) intro.textContent = STORY_INTRO;
if (shot) {
  // pre-populate a little city life, then stage the shot
  for (let i = 0; i < 8; i++) {
    const pt = game.world.randomRoadPoint(game.rng);
    game.peds.push({ x: pt.x + 30, y: pt.y + 30, angle: 0, speed: 44, state: 'walk', tx: pt.x, ty: pt.y, shirt: '#2b6fd9', skin: '#e8b88a', wait: 0, fleeX: 0, fleeY: 0, walkPhase: 0 });
  }
  stageShot(game, shot);
  if (shot === 'start') showMenu(game, 'menu-start');
  else hideMenus();
} else {
  showMenu(game, 'menu-start');
}

// --- main loop ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const inp = game.input;

  if (game.state === 'playing') {
    game.time += dt;
    game.clock = (game.clock + dt / 45) % 24; // a full day in ~18 minutes
    const p = game.player;

    if (inp.hit('escape') || inp.hit('p')) {
      game.state = 'paused';
      showMenu(game, 'menu-pause');
    }
    if (inp.hit('m')) {
      game.audio.setMuted(!game.audio.muted);
      const b = document.getElementById('btn-sound');
      if (b) b.textContent = game.audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
    }

    // player
    if (p.onFoot) updatePlayerFoot(game, dt);
    else updatePlayerCar(game, dt);
    if (p.hp <= 0 && !p.dead) game.killPlayer('wasted');

    // cars
    for (const car of [...game.cars]) {
      if (car.driver === 'traffic') updateTrafficCar(game, car, dt);
      else if (car.driver === 'police') updatePoliceCar(game, car, dt);
    }
    collideCars(game);
    maintainPopulation(game, dt);

    // people + police
    updatePeds(game, dt);
    for (const cop of [...game.cops]) updateCop(game, cop, dt);
    updateWanted(game, dt);

    // combat + missions + shop
    updateBullets(game, dt);
    updateParticles(game, dt);
    updateSkids(game, dt);
    updateMission(game, dt);
    updateShop(game, dt);

    // audio: siren / engine / music
    game.audio.siren(dt, policeSirenOn(game) && game.wanted >= 1);
    game.audio.engine(p.onFoot ? 0 : Math.abs(p.car.speed) / 520);
    game.audio.music(dt, true);
  } else if (game.state === 'shop') {
    // shop open: world frozen, Esc closes it
    if (inp.hit('escape')) closeShop(game);
  } else if (game.state === 'menu') {
    // slow cinematic pan over the city behind the start screen
    game.time += dt;
    game.camera.x = 1150 + Math.cos(game.time * 0.05) * 260;
    game.camera.y = 1350 + Math.sin(game.time * 0.04) * 200;
    game.clock = 17.4;
    if (inp.anyKey || inp.mouse.clicked) game.audio.ensure();
  } else if (game.state === 'missionComplete') {
    game.stateTimer += dt;
    game.time += dt;
    if (game.stateTimer > 2.6) {
      const next = game.completedMission ? game.completedMission.index + 1 : 0;
      startMission(game, next);
      game.state = 'playing';
      hideMenus();
    }
  } else if (game.state === 'gameover') {
    game.stateTimer += dt;
    if (inp.hit('enter') || inp.hit('r')) game.retry();
  } else if (game.state === 'paused') {
    if (inp.hit('escape') || inp.hit('p')) {
      game.state = 'playing';
      hideMenus();
    }
  }

  render3D(game, dt);
  if (game.state === 'playing' || game.state === 'missionComplete') drawHUD(game);
  inp.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
