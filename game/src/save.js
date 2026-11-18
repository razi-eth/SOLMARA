// save.js — localStorage save / load. Saves money, mission progress, position,
// clock and stats. One job: remember the player's story.
// Pedestrian looks are re-rolled from the seeded RNG on load (createPed), so
// only the player's progress is stored — the crowd is rebuilt fresh each run.
import { TUNING } from './config.js';

export function saveGame(game) {
  try {
    const data = {
      money: game.player.money,
      missionIndex: game.mission ? game.mission.index : (game.storyDone ? 99 : 0),
      x: Math.round(game.player.x),
      y: Math.round(game.player.y),
      clock: game.clock,
      stats: game.stats,
      cashLeft: game.cash.length,
      // the graphics quality (ULTRA/HIGH/FAST) survives between sessions
      quality: game.render3d ? game.render3d.quality : 2,
      // discovered landmarks (13 total) survive too
      landmarksSeen: game.landmarksSeen || [],
    };
    localStorage.setItem(TUNING.saveKey, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(TUNING.saveKey);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.money !== 'number' || typeof d.missionIndex !== 'number') return null;
    if (typeof d.quality !== 'number') d.quality = 2;
    if (!Array.isArray(d.landmarksSeen)) d.landmarksSeen = [];
    return d;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(TUNING.saveKey); } catch (e) { /* ignore */ }
}
