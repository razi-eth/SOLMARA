// save.js — localStorage save / load. Saves money, mission progress, position,
// clock and stats. One job: remember the player's story.
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
    return d;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(TUNING.saveKey); } catch (e) { /* ignore */ }
}
