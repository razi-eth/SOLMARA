// hud.js — HUD drawn on the canvas (health, money, wanted stars, clock, speed,
// objective, minimap) + DOM menus (start / pause / game over / mission complete)
// and toast banners. One job: everything the player reads.
import { CFG, RADIO_STATIONS } from './config.js';
import { drawMinimap } from './minimap.js';
import { wantedLevel } from './police.js';

export function drawHUD(game) {
  const ctx = game.ctx, p = game.player;
  const lvl = wantedLevel(game);
  // --- top-left: health + money ---
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.55)';
  ctx.beginPath(); ctx.roundRect(14, 12, 240, 66, 10); ctx.fill();
  // health bar
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.roundRect(24, 22, 200, 14, 7); ctx.fill();
  const hpf = Math.min(1, Math.max(0, p.hp / 100));
  const hg = ctx.createLinearGradient(24, 0, 224, 0);
  hg.addColorStop(0, hpf > 0.3 ? '#37d67a' : '#ff4444');
  hg.addColorStop(1, hpf > 0.3 ? '#1a9e50' : '#c01818');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.roundRect(24, 22, 200 * hpf, 14, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('HP ' + Math.ceil(p.hp), 26, 33);
  // money
  ctx.fillStyle = '#7dff9a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('$' + p.money.toLocaleString(), 24, 62);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '11px monospace';
  ctx.fillText('JAX MARLOWE', 130, 62);
  // --- top-center: wanted stars ---
  if (lvl > 0) {
    const pulse = 0.7 + 0.3 * Math.sin(game.time * 6);
    ctx.fillStyle = 'rgba(8,10,18,0.55)';
    const w = lvl * 30 + 20;
    ctx.beginPath(); ctx.roundRect(CFG.VIEW_W / 2 - w / 2, 12, w, 34, 10); ctx.fill();
    ctx.font = '24px monospace'; ctx.textAlign = 'center';
    for (let i = 0; i < lvl; i++) {
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ffd21f';
      ctx.fillText('★', CFG.VIEW_W / 2 - (lvl - 1) * 15 + i * 30, 38);
    }
    ctx.globalAlpha = 1;
  }
  // --- top-right: clock + minimap ---
  const hh = Math.floor(game.clock), mm = Math.floor((game.clock - hh) * 60);
  ctx.fillStyle = 'rgba(8,10,18,0.55)';
  ctx.beginPath(); ctx.roundRect(CFG.VIEW_W - 118, 12, 104, 30, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
  ctx.fillText(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), CFG.VIEW_W - 66, 33);
  // graphics quality chip (ULTRA / HIGH / FAST) under the clock
  const qNames = ['FAST', 'HIGH', 'ULTRA'];
  const q = game.render3d ? game.render3d.quality : 2;
  ctx.fillStyle = 'rgba(8,10,18,0.5)';
  ctx.beginPath(); ctx.roundRect(CFG.VIEW_W - 118, 46, 104, 18, 8); ctx.fill();
  ctx.fillStyle = q === 2 ? '#7dff9a' : 'rgba(255,255,255,0.75)';
  ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
  ctx.fillText('GFX: ' + qNames[q] + ' · G', CFG.VIEW_W - 66, 59);
  drawMinimap(ctx, game, CFG.VIEW_W - 236, 52, 220);
  // --- bottom-left: objective + nearest landmark ---
  const obj = game.missionObjective ? game.missionObjective() : '';
  if (obj) {
    ctx.fillStyle = 'rgba(8,10,18,0.6)';
    ctx.beginPath(); ctx.roundRect(14, CFG.VIEW_H - 58, 430, 44, 10); ctx.fill();
    ctx.fillStyle = '#ffe93c';
    ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
    ctx.fillText('◆ ' + (game.mission ? game.mission.def.name.toUpperCase() : ''), 26, CFG.VIEW_H - 38);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(obj, 26, CFG.VIEW_H - 20);
  }
  // landmark chip: where you are right now (L toggles the full legend)
  if (game.nearLandmark) {
    ctx.fillStyle = 'rgba(8,10,18,0.6)';
    ctx.beginPath(); ctx.roundRect(14, CFG.VIEW_H - 92, 280, 26, 8); ctx.fill();
    ctx.fillStyle = game.nearLandmark.color;
    ctx.beginPath(); ctx.arc(28, CFG.VIEW_H - 79, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
    ctx.fillText('📍 ' + game.nearLandmark.name, 40, CFG.VIEW_H - 75);
  }
  if (game.showLandmarks && game.world.landmarks) {
    ctx.fillStyle = 'rgba(8,10,18,0.82)';
    ctx.beginPath(); ctx.roundRect(14, 92, 250, 22 + game.world.landmarks.length * 16, 10); ctx.fill();
    ctx.fillStyle = '#ffe93c';
    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
    ctx.fillText('LANDMARKS — press L to hide', 26, 110);
    ctx.font = '11px monospace';
    game.world.landmarks.forEach((lm, i) => {
      ctx.fillStyle = lm.color;
      ctx.beginPath(); ctx.arc(30, 120 + i * 16, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(lm.name, 42, 124 + i * 16);
    });
  }
  // --- bottom-right: speed / weapon / radio / NOS ---
  if (!p.onFoot && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.fillStyle = 'rgba(8,10,18,0.55)';
    ctx.beginPath(); ctx.roundRect(CFG.VIEW_W - 150, CFG.VIEW_H - 58, 136, 44, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px monospace'; ctx.textAlign = 'right';
    ctx.fillText(kmh + '', CFG.VIEW_W - 40, CFG.VIEW_H - 26);
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('KM/H', CFG.VIEW_W - 40, CFG.VIEW_H - 14);
    // damage bar
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(CFG.VIEW_W - 136, CFG.VIEW_H - 62, 108, 4);
    ctx.fillStyle = p.car.hp / p.car.maxHp > 0.35 ? '#37d67a' : '#ff4444';
    ctx.fillRect(CFG.VIEW_W - 136, CFG.VIEW_H - 62, 108 * (p.car.hp / p.car.maxHp), 4);
    // NOS bar + radio station
    ctx.fillStyle = 'rgba(8,10,18,0.55)';
    ctx.beginPath(); ctx.roundRect(CFG.VIEW_W - 150, CFG.VIEW_H - 96, 136, 30, 8); ctx.fill();
    ctx.fillStyle = '#4aa8ff';
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
    ctx.fillText('NOS', CFG.VIEW_W - 140, CFG.VIEW_H - 76);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(CFG.VIEW_W - 108, CFG.VIEW_H - 86, 84, 8);
    ctx.fillStyle = '#4aa8ff';
    ctx.fillRect(CFG.VIEW_W - 108, CFG.VIEW_H - 86, 84 * Math.max(0, p.nos || 0) / 100, 8);
    ctx.fillStyle = '#ffe93c';
    ctx.font = '11px monospace'; ctx.textAlign = 'right';
    ctx.fillText('♪ ' + (RADIO_STATIONS[p.station || 0] || ''), CFG.VIEW_W - 160, CFG.VIEW_H - 76);
  } else {
    ctx.fillStyle = 'rgba(8,10,18,0.45)';
    ctx.beginPath(); ctx.roundRect(CFG.VIEW_W - 320, CFG.VIEW_H - 34, 306, 22, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '11px monospace'; ctx.textAlign = 'right';
    ctx.fillText('WASD move · SHIFT run · CLICK shoot · E enter car · M mute', CFG.VIEW_W - 22, CFG.VIEW_H - 19);
    // weapon readout (on foot)
    const wName = (p.weapon || 'pistol').toUpperCase();
    const ammo = p.weapon === 'shotgun' ? (p.ammo ? p.ammo.shotgun : 0) :
      p.weapon === 'smg' ? (p.ammo ? p.ammo.smg : 0) : '∞';
    ctx.fillStyle = 'rgba(8,10,18,0.55)';
    ctx.beginPath(); ctx.roundRect(CFG.VIEW_W - 150, CFG.VIEW_H - 66, 136, 26, 8); ctx.fill();
    ctx.fillStyle = '#ffe93c';
    ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right';
    ctx.fillText(wName + '  ' + ammo, CFG.VIEW_W - 24, CFG.VIEW_H - 47);
  }
  // --- damage flash ---
  if (p.hp < 35 && p.hp > 0) {
    const a = 0.12 + 0.08 * Math.sin(game.time * 5);
    ctx.fillStyle = `rgba(255,0,0,${a})`;
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  }
  ctx.restore();
}

// --- DOM menus ---
export function showMenu(game, name) {
  for (const id of ['menu-start', 'menu-pause', 'menu-gameover', 'menu-complete']) {
    const el = document.getElementById(id);
    if (el) el.style.display = id === name ? 'flex' : 'none';
  }
  if (name === 'menu-gameover') {
    const t = document.getElementById('gameover-title');
    const s = document.getElementById('gameover-stats');
    if (t) t.textContent = game.player.busted ? 'BUSTED' : 'WASTED';
    if (t) t.style.color = game.player.busted ? '#4aa8ff' : '#ff4444';
    if (s) s.textContent = 'Missions done: ' + game.stats.missions + '  ·  Cash: $' + game.player.money.toLocaleString() + '  ·  Cars stolen: ' + game.stats.carsStolen;
  }
  if (name === 'menu-complete' && game.completedMission) {
    const t = document.getElementById('complete-title');
    const s = document.getElementById('complete-sub');
    if (t) t.textContent = 'MISSION COMPLETE';
    if (s) s.textContent = game.completedMission.def.name + '  ·  +$' + game.completedMission.def.reward.toLocaleString();
  }
}

export function hideMenus() {
  for (const id of ['menu-start', 'menu-pause', 'menu-gameover', 'menu-complete']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
}

export function showToast(game, title, sub) {
  const el = document.getElementById('toast');
  if (!el) return;
  const t = document.getElementById('toast-title');
  const s = document.getElementById('toast-sub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub || '';
  el.style.opacity = '1';
  el.style.transform = 'translate(-50%, 0)';
  clearTimeout(game.toastTimer);
  game.toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -12px)';
  }, 4200);
}
