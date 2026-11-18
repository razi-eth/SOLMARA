// minimap.js — the HUD minimap: the whole city shrunk to a corner, with the player,
// the mission marker, police, enemies and cash. Drawn on the main canvas.
import { CFG } from './config.js';

export function drawMinimap(ctx, game, x, y, size) {
  const W = game.world;
  const s = size / CFG.WORLD;
  const t = game.time;
  ctx.save();
  ctx.translate(x, y);
  // frame
  ctx.fillStyle = 'rgba(8,10,18,0.82)';
  ctx.beginPath(); ctx.roundRect(-6, -6, size + 12, size + 12, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.rect(0, 0, size, size); ctx.clip();
  // land + water
  ctx.fillStyle = '#2a3a2a';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#0d5a80';
  ctx.fillRect(W.water.x * s, 0, W.water.w * s, size);
  ctx.fillStyle = '#e8cf9a';
  ctx.fillRect(W.beach.x * s, 0, W.beach.w * s, size);
  // park
  ctx.fillStyle = '#4c8a3e';
  ctx.fillRect(W.park.x * s, W.park.y * s, W.park.w * s, W.park.h * s);
  // safehouse (blue dot) + gun shop (green dot) — the two places that matter
  ctx.fillStyle = '#4aa8ff';
  ctx.beginPath(); ctx.arc(W.safehouse.x * s, W.safehouse.y * s, 3, 0, 7); ctx.fill();
  ctx.fillStyle = '#3aff7a';
  ctx.beginPath(); ctx.arc(1330 * s, 1130 * s, 3, 0, 7); ctx.fill();
  // roads
  ctx.strokeStyle = 'rgba(220,220,220,0.75)'; ctx.lineWidth = 1.5;
  for (const r of W.roads) {
    ctx.beginPath();
    if (r.vertical) { ctx.moveTo(r.x1 * s, 0); ctx.lineTo(r.x1 * s, size); }
    else { ctx.moveTo(0, r.y1 * s); ctx.lineTo(size, r.y1 * s); }
    ctx.stroke();
  }
  // landmarks: coloured dot + first letter, so the player can navigate by
  // them (BANK, POLICE, AIRPORT, ...). The runway is a dark strip.
  if (W.landmarks) {
    for (const lm of W.landmarks) {
      ctx.fillStyle = lm.color;
      ctx.beginPath(); ctx.arc(lm.cx * s, lm.cy * s, 4.5, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
      ctx.fillText(lm.short[0], lm.cx * s, lm.cy * s + 2.5);
    }
    const ap = W.landmarks.find((l) => l.id === 'airport');
    if (ap) {
      ctx.fillStyle = 'rgba(20,22,26,0.9)';
      ctx.fillRect(1750 * s, 2600 * s, 600 * s, 70 * s);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
      ctx.fillText('✈', 2050 * s, 2638 * s + 2.5);
    }
  }
  // cash bundles
  ctx.fillStyle = '#3aff7a';
  for (const c of game.cash) ctx.fillRect(c.x * s - 1.5, c.y * s - 1.5, 3, 3);
  // enemies
  ctx.fillStyle = '#ff4040';
  for (const e of game.enemies) {
    ctx.beginPath(); ctx.arc(e.x * s, e.y * s, 3, 0, 7); ctx.fill();
  }
  // police
  const ph = Math.floor(t * 5) % 2 === 0;
  ctx.fillStyle = ph ? '#ff2e2e' : '#2e6bff';
  for (const c of game.policeCars) {
    ctx.beginPath(); ctx.arc(c.x * s, c.y * s, 3.5, 0, 7); ctx.fill();
  }
  for (const c of game.cops) {
    ctx.beginPath(); ctx.arc(c.x * s, c.y * s, 3, 0, 7); ctx.fill();
  }
  // pedestrians: tiny white dots, so the sidewalks read as alive
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const pd of game.peds) {
    ctx.beginPath(); ctx.arc(pd.x * s, pd.y * s, 1.5, 0, 7); ctx.fill();
  }
  // mission target (pulsing)
  const target = game.missionTarget ? game.missionTarget() : null;
  if (target) {
    const r = 5 + Math.sin(t * 5) * 2;
    ctx.strokeStyle = '#ffe93c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(target.x * s, target.y * s, r, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffe93c';
    ctx.beginPath(); ctx.arc(target.x * s, target.y * s, 2.5, 0, 7); ctx.fill();
  }
  // player arrow
  const p = game.player;
  ctx.save();
  ctx.translate(p.x * s, p.y * s);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  // north
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
  ctx.fillText('N', size - 10, 14);
  ctx.restore();
}
