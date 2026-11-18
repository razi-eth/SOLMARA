// world.js — generates the city of SOLMARA (all original): roads, districts, buildings,
// beach + ocean, park, marina pier, props, and the road graph traffic AI drives on.
// Deterministic from a seed. Also owns collision queries.
import { mulberry32, pick, range, rangeInt, chance, clamp } from './random.js';
import { CFG, PAL } from './config.js';

const VERTICALS = [150, 350, 550, 750, 950, 1150, 1350, 1550, 1750, 1950, 2150, 2350];
const HORIZONTALS = [150, 350, 550, 750, 950, 1150, 1350, 1550, 1750, 1950, 2150, 2350, 2550];

function districtAt(x, y) {
  if (x > 2350) return 'beach';
  if (x >= 1750 && x <= 2150 && y >= 350 && y <= 750) return 'park';
  if (x >= 750 && x <= 1950 && y >= 750 && y <= 1950) return 'downtown';
  if (y < 750 && x < 750) return 'industrial';
  if (y > 1950) return 'residential';
  return 'oldtown';
}

export function generateWorld(seed = 20261118) {
  const rng = mulberry32(seed);
  const W = CFG.WORLD;
  const world = {
    roads: [], buildings: [], trees: [], lamps: [], neon: [], pools: [],
    water: { x: 2520, y: 0, w: W - 2520, h: W },
    beach: { x: 2380, y: 0, w: 140, h: W },
    park: { x: 1750, y: 350, w: 400, h: 400 },
    pier: { x: 2460, y: 1380, w: 300, h: 44 },
    graph: new Map(), // "x,y" -> [{x,y}, ...] neighbours
    intersections: [],
    playerSpawn: { x: 1150, y: 1420 },
    garage: { x: 430, y: 640 },
    safehouse: { x: 1250, y: 2470 },
    marina: { x: 2500, y: 1402 },
    warehouse: { x: 430, y: 320 },
    tower: { x: 1250, y: 1050 },
    ferris: { x: 2690, y: 1402 },
  };

  // --- roads ---
  for (const x of VERTICALS) world.roads.push({ x1: x, y1: 0, x2: x, y2: W, w: x === 1150 || x === 2350 ? 52 : CFG.ROAD_W, vertical: true });
  for (const y of HORIZONTALS) world.roads.push({ x1: 0, y1: y, x2: 2380, y2: y, w: y === 1350 ? 52 : CFG.ROAD_W, vertical: false });

  // --- road graph (intersections) ---
  const key = (x, y) => x + ',' + y;
  for (const x of VERTICALS) for (const y of HORIZONTALS) {
    world.intersections.push({ x, y });
    world.graph.set(key(x, y), []);
  }
  for (const x of VERTICALS) for (let i = 0; i < HORIZONTALS.length - 1; i++) {
    const a = key(x, HORIZONTALS[i]), b = key(x, HORIZONTALS[i + 1]);
    world.graph.get(a).push({ x, y: HORIZONTALS[i + 1] });
    world.graph.get(b).push({ x, y: HORIZONTALS[i] });
  }
  for (const y of HORIZONTALS) for (let i = 0; i < VERTICALS.length - 1; i++) {
    const a = key(VERTICALS[i], y), b = key(VERTICALS[i + 1], y);
    world.graph.get(a).push({ x: VERTICALS[i + 1], y });
    world.graph.get(b).push({ x: VERTICALS[i], y });
  }

  // --- buildings, one block at a time ---
  const blocks = [];
  for (let i = 0; i < VERTICALS.length - 1; i++) {
    for (let j = 0; j < HORIZONTALS.length - 1; j++) {
      const bx = VERTICALS[i] + 26, by = HORIZONTALS[j] + 26;
      const bw = VERTICALS[i + 1] - VERTICALS[i] - 52;
      blocks.push({ x: bx, y: by, w: bw, h: HORIZONTALS[j + 1] - HORIZONTALS[j] - 52, cx: bx + bw / 2, cy: by + (HORIZONTALS[j + 1] - HORIZONTALS[j] - 52) / 2 });
    }
  }
  for (const b of blocks) {
    const d = districtAt(b.cx, b.cy);
    if (d === 'beach' || d === 'park') continue;
    const n = d === 'downtown' ? rangeInt(rng, 1, 2) : d === 'industrial' ? 1 : rangeInt(rng, 1, 4);
    const cols = n === 1 ? 1 : 2, rows = Math.ceil(n / cols);
    const cw = b.w / cols, ch = b.h / rows;
    for (let k = 0; k < n; k++) {
      const cx = k % cols, cy = Math.floor(k / cols);
      const m = 10;
      const w = cw - m * 2 - range(rng, 0, 14), h = ch - m * 2 - range(rng, 0, 14);
      if (w < 26 || h < 26) continue;
      const x = b.x + cx * cw + m + range(rng, 0, 6);
      const y = b.y + cy * ch + m + range(rng, 0, 6);
      let hgt, roof;
      if (d === 'downtown') { hgt = range(rng, 26, 46); roof = rangeInt(rng, 0, 9); }
      else if (d === 'industrial') { hgt = range(rng, 12, 18); roof = rangeInt(rng, 0, 9); }
      else if (d === 'residential') { hgt = range(rng, 8, 13); roof = rangeInt(rng, 0, 9); }
      else { hgt = range(rng, 10, 18); roof = rangeInt(rng, 0, 9); }
      world.buildings.push({ x, y, w, h, hgt, roof, district: d, color: pick(rng, PAL.buildingRoof) });
      if (d === 'residential' && chance(rng, 0.35)) {
        world.pools.push({ x: x + w * 0.2, y: y + h + 6, w: 26, h: 14 });
      }
    }
    // trees inside blocks
    if (d === 'residential' || d === 'oldtown') {
      const tn = rangeInt(rng, 1, 3);
      for (let t = 0; t < tn; t++) world.trees.push({ x: b.x + range(rng, 8, b.w - 8), y: b.y + range(rng, 8, b.h - 8), palm: chance(rng, 0.5) });
    }
  }

  // --- park trees + pond ---
  for (let i = 0; i < 26; i++) world.trees.push({ x: range(rng, 1770, 2130), y: range(rng, 370, 730), palm: chance(rng, 0.3) });
  world.pond = { x: 1880, y: 480, w: 130, h: 90 };

  // --- beach palms along Ocean Drive ---
  for (let y = 60; y < W; y += 95) {
    world.trees.push({ x: 2395 + range(rng, -6, 6), y, palm: true });
    if (chance(rng, 0.5)) world.trees.push({ x: 2420 + range(rng, -4, 4), y: y + 45, palm: true });
  }
  // --- avenue palms ---
  for (let x = 200; x < 2300; x += 130) world.trees.push({ x, y: 1332, palm: true });

  // --- street lamps along roads ---
  for (const x of VERTICALS) for (let y = 80; y < W; y += 170) world.lamps.push({ x: x + 24, y });
  for (const y of HORIZONTALS) for (let x = 80; x < 2360; x += 170) world.lamps.push({ x, y: y + 24 });

  // --- neon signs on downtown buildings ---
  const dt = world.buildings.filter((b) => b.district === 'downtown');
  for (let i = 0; i < Math.min(26, dt.length); i++) {
    const b = dt[i];
    world.neon.push({ x: b.x + b.w / 2, y: b.y + b.h + 4, color: pick(rng, PAL.neon), w: Math.min(64, b.w * 0.7) });
  }

  // --- spatial index for collision (cell 200) ---
  world.cell = new Map();
  const cellKey = (cx, cy) => cx + ',' + cy;
  world.buildings.forEach((b, i) => {
    const x0 = Math.floor(b.x / 200), x1 = Math.floor((b.x + b.w) / 200);
    const y0 = Math.floor(b.y / 200), y1 = Math.floor((b.y + b.h) / 200);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const k = cellKey(cx, cy);
      if (!world.cell.has(k)) world.cell.set(k, []);
      world.cell.get(k).push(i);
    }
  });

  // --- collision: circle vs buildings / water / bounds. Returns corrected {x, y}. ---
  world.collideCircle = (x, y, r) => {
    let nx = x, ny = y;
    const cx = Math.floor(x / 200), cy = Math.floor(y / 200);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const list = world.cell.get(cellKey(cx + ox, cy + oy));
      if (!list) continue;
      for (const i of list) {
        const b = world.buildings[i];
        const px = clamp(nx, b.x - 2, b.x + b.w + 2);
        const py = clamp(ny, b.y - 2, b.y + b.h + 2);
        const dx = nx - px, dy = ny - py, d2 = dx * dx + dy * dy;
        if (d2 < r * r && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          nx = px + (dx / d) * r; ny = py + (dy / d) * r;
        } else if (d2 <= 0.0001) {
          // centre inside rect: push out along smallest penetration
          const l = nx - (b.x - 2), rr = (b.x + b.w + 2) - nx;
          const t = ny - (b.y - 2), bb = (b.y + b.h + 2) - ny;
          const m = Math.min(l, rr, t, bb);
          if (m === l) nx = b.x - 2 - r; else if (m === rr) nx = b.x + b.w + 2 + r;
          else if (m === t) ny = b.y - 2 - r; else ny = b.y + b.h + 2 + r;
        }
      }
    }
    // water is solid
    if (nx > world.water.x - r && ny >= 0 && ny <= W) {
      if (nx < world.water.x + world.water.w && !(nx > world.pier.x - 4 && nx < world.pier.x + world.pier.w + 4 && ny > world.pier.y - 4 && ny < world.pier.y + world.pier.h + 4)) {
        nx = world.water.x - r;
      }
    }
    nx = clamp(nx, r + 4, W - r - 4);
    ny = clamp(ny, r + 4, W - r - 4);
    return { x: nx, y: ny };
  };

  world.inBuilding = (x, y) => {
    const cx = Math.floor(x / 200), cy = Math.floor(y / 200);
    const list = world.cell.get(cellKey(cx, cy));
    if (!list) return false;
    for (const i of list) {
      const b = world.buildings[i];
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
    }
    return false;
  };

  world.isWater = (x, y) => x > world.water.x && y >= 0 && y <= W;

  world.nearestIntersection = (x, y) => {
    let best = null, bd = Infinity;
    for (const p of world.intersections) {
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };

  world.randomRoadPoint = (rng2) => {
    const v = pick(rng2, VERTICALS);
    const h = pick(rng2, HORIZONTALS);
    return { x: v + range(rng2, -8, 8), y: h + range(rng2, -8, 8) };
  };

  return world;
}
