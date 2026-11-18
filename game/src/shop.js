// shop.js — SOLMARA 3D: the gun shop + the safehouse.
// Walk up to the green beacon, press E, buy weapons and ammo with mission cash.
// The safehouse (south residential) heals you and saves the game.
// No shopkeeper NPC: the shop is a beacon + menu, so it works even when the
// street is empty and no pedestrian is nearby.
export const SHOP_POS = { x: 1330, y: 1130 };

export const SHOP_ITEMS = [
  { id: 'shotgun', name: 'PUMP SHOTGUN', price: 800, desc: '8 pellets, huge close-range damage' },
  { id: 'smg', name: 'STREET SMG', price: 1200, desc: 'Very fast fire, sprays bullets' },
  { id: 'shells', name: 'SHOTGUN SHELLS x24', price: 150, desc: 'Ammo for the shotgun' },
  { id: 'smg-ammo', name: 'SMG ROUNDS x120', price: 150, desc: 'Ammo for the SMG' },
  { id: 'armor', name: 'BODY ARMOR', price: 300, desc: 'Restore 50 HP right now' },
];

export function ensureWeaponState(p) {
  if (!p.weapon) {
    p.weapon = 'pistol';
    p.owned = { shotgun: false, smg: false };
    p.ammo = { shotgun: 0, smg: 0 };
    p.nos = 100;
    p.station = 0;
  }
}

export function buyItem(game, id) {
  const p = game.player;
  ensureWeaponState(p);
  const item = SHOP_ITEMS.find((s) => s.id === id);
  if (!item) return;
  if (p.money < item.price) {
    game.showToast('NOT ENOUGH CASH', 'You need $' + item.price + ' — go earn it.');
    game.audio.click();
    return;
  }
  if (id === 'shotgun' && p.owned.shotgun) { game.showToast('ALREADY OWNED', 'You already have the shotgun. Buy shells instead.'); return; }
  if (id === 'smg' && p.owned.smg) { game.showToast('ALREADY OWNED', 'You already have the SMG. Buy rounds instead.'); return; }
  if (id === 'shells' && !p.owned.shotgun) { game.showToast('NO SHOTGUN', 'Buy the shotgun first.'); return; }
  if (id === 'smg-ammo' && !p.owned.smg) { game.showToast('NO SMG', 'Buy the SMG first.'); return; }
  p.money -= item.price;
  if (id === 'shotgun') { p.owned.shotgun = true; p.ammo.shotgun = 24; p.weapon = 'shotgun'; }
  else if (id === 'smg') { p.owned.smg = true; p.ammo.smg = 120; p.weapon = 'smg'; }
  else if (id === 'shells') { p.ammo.shotgun += 24; }
  else if (id === 'smg-ammo') { p.ammo.smg += 120; }
  else if (id === 'armor') { p.hp = Math.min(100, p.hp + 50); }
  game.audio.pickup();
  game.showToast('BOUGHT: ' + item.name, 'Cash left: $' + p.money.toLocaleString());
}

export function openShop(game) {
  game.state = 'shop';
  const el = document.getElementById('menu-shop');
  if (el) el.style.display = 'flex';
  const cash = document.getElementById('shop-cash');
  if (cash) cash.textContent = 'YOUR CASH: $' + game.player.money.toLocaleString();
  game.audio.click();
}

export function closeShop(game) {
  const el = document.getElementById('menu-shop');
  if (el) el.style.display = 'none';
  game.state = 'playing';
  game.audio.click();
}

// Proximity triggers, called every frame from the main loop while playing.
export function updateShop(game, dt) {
  const p = game.player;
  ensureWeaponState(p);
  // the shop beacon pulses faster as the player gets closer (render3d reads it)
  if (game.render3d) {
    const d = Math.hypot(p.x - SHOP_POS.x, p.y - SHOP_POS.y);
    game.shopPulse = d < 300 ? 2.2 + (1 - d / 300) * 4 : 2.2;
  }
  if (game.state !== 'playing' || !p.onFoot) return;
  const dShop = Math.hypot(p.x - SHOP_POS.x, p.y - SHOP_POS.y);
  if (dShop < 55 && game.input.hit('e')) {
    openShop(game);
    return;
  }
  const sh = game.world.safehouse;
  const dSafe = Math.hypot(p.x - sh.x, p.y - sh.y);
  if (dSafe < 60 && game.input.hit('e')) {
    p.hp = 100;
    game.saveGame();
    game.showToast('SAFEHOUSE', 'Healed up and saved. Vera would be proud.');
    game.audio.pickup();
  }
  // hint toasts (throttled by the game's toast timer)
  if (dShop < 55 && game.shopHint !== 'shop') {
    game.shopHint = 'shop';
    game.showToast('GUN SHOP — by SOLMARA BANK', 'Press E to buy weapons and ammo.');
  } else if (dSafe < 60 && game.shopHint !== 'safe') {
    game.shopHint = 'safe';
    game.showToast('SAFEHOUSE', 'Press E to heal and save.');
  } else if (dShop >= 55 && dSafe >= 60) {
    game.shopHint = null;
  }
}
