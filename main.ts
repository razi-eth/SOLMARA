// SOLMARA — "Make GTA 6" (gta6-01) entry program.
// Hands the game in: copies game/ and screenshots/ from this repository to
// /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Hyper-realistic graphics pass (round 2): PBR clearcoat paint, procedural
// PMREM environment reflections, ACES tone mapping, 2048px PCFSoft shadows,
// emissive night windows, animated shader ocean with sun glint, sky shader
// with sun disc + drifting clouds + moon, headlight beams and muzzle-flash
// lighting — all procedural, no external assets.
// Landmark pass (round 3): 13 distinct landmarks (bank, hotel, casino,
// police HQ, bar, mall, fire station, hospital, church, gas station, school
// + field, stadium, airport + runway, park rollercoaster) with their own
// silhouettes, palettes and signage, plus 3 facade palettes per district,
// pitched roofs and glass setback crowns so no two blocks read the same.
// Character pass (round 4): articulated people with real proportions (head
// 1/7.3 of height, face, hair styles, outfits), 8 pedestrian archetypes,
// uniformed cops, gang enemies, Jax in a leather jacket, walk-cycle limb
// animation, idle breathing + look-around, gun held in the right hand.
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
for (const name of ['game', 'screenshots']) {
  const target = join(outDir, name);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  cpSync(join(repoDir, name), target, { recursive: true });
}
if (existsSync(join(outDir, 'dossier.json'))) rmSync(join(outDir, 'dossier.json'));

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
}));
console.log('SOLMARA handed in to ' + outDir);
