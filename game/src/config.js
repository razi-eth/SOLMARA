// SOLMARA — open-world crime game. All original: city, names, story, art, sound.
// config.js — world constants, palettes, tuning. One clear job: the numbers.
export const CFG = {
  WORLD: 2800,            // world is WORLD x WORLD px
  BLOCK: 200,             // city block size (road pitch)
  ROAD_W: 34,             // road width
  VIEW_W: 1280,
  VIEW_H: 800,
  TILE: 40,
};

// Sun-soaked coastal palette (day). Night/dusk palettes are interpolated in render3d.js.
export const PAL = {
  asphalt: '#3a3f4a',
  asphaltDark: '#31353f',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  sidewalkEdge: '#9a9484',
  grass: '#5da24a',
  grassDark: '#4c8a3e',
  sand: '#e8cf9a',
  water: '#2fa8c9',
  waterDeep: '#1d7fa8',
  waterFoam: '#d8f4f4',
  buildingRoof: ['#c96f4a', '#d9a441', '#7fa3b8', '#b85c6e', '#8a7fb8', '#6fae7e', '#d97b5f', '#5f8fa8'],
  buildingSide: '#00000033',
  wall: '#e8ddc8',
  downtownGlass: '#7fb8d8',
  palmTrunk: '#7a5a38',
  palmLeaf: '#3f9e4d',
  carColors: ['#d9382b', '#2b6fd9', '#e8b62b', '#3aa655', '#e8e8e8', '#222831', '#8a2fd9', '#ff7a1a', '#18b8a8', '#c9a227'],
  taxiYellow: '#f2c200',
  policeWhite: '#f2f2f2',
  policeBlack: '#1a1d24',
  neon: ['#ff2e88', '#22e6ff', '#ffe93c', '#7cff3c', '#ff7a1a'],
};

// Time-of-day keyframes: [hour, sky tint, ambient darkness, sun dir x, sun dir y, sun length, grade color]
export const DAY_KEYS = [
  { h: 0,  dark: 0.62, sun: [0.4, 0.9, 0.0], grade: '#1a2440', lamp: 1.0 },
  { h: 5,  dark: 0.55, sun: [0.9, 0.4, 0.25], grade: '#2a2a55', lamp: 1.0 },
  { h: 7,  dark: 0.18, sun: [1.0, 0.25, 0.9], grade: '#ffb37a', lamp: 0.35 },
  { h: 10, dark: 0.0,  sun: [0.55, 0.85, 1.0], grade: '#fff2cc', lamp: 0.0 },
  { h: 15, dark: 0.0,  sun: [-0.3, 1.0, 1.0], grade: '#ffe9b0', lamp: 0.0 },
  { h: 18, dark: 0.22, sun: [-1.0, 0.2, 0.9], grade: '#ff9a5c', lamp: 0.4 },
  { h: 20, dark: 0.5,  sun: [-0.6, 0.9, 0.3], grade: '#3a2a66', lamp: 1.0 },
  { h: 22, dark: 0.62, sun: [0.4, 0.9, 0.0], grade: '#1a2440', lamp: 1.0 },
];

export const TUNING = {
  playerWalk: 170,       // px/s on foot
  playerRun: 265,
  playerAccel: 1400,
  carAccel: 420,
  carBrake: 700,
  carMaxSpeed: 520,
  carReverseMax: 200,
  carTurn: 2.6,          // rad/s at full steer (scaled by speed)
  carGrip: 3.2,
  carDrag: 0.55,
  bulletSpeed: 900,
  bulletDamage: 34,
  pistolCooldown: 0.22,
  enemyHp: 100,
  playerHp: 100,
  policeRamDamage: 8,
  wantedDecayDelay: 14,  // s without crime before stars start to fall
  wantedDecayRate: 0.09, // stars/s
  saveKey: 'solmara-save-v1',
};

export const CAR_TYPES = {
  sedan:  { w: 46, h: 22, accel: 1.0, max: 1.0, hp: 100, name: 'Sedan' },
  taxi:   { w: 46, h: 22, accel: 0.95, max: 0.95, hp: 100, name: 'Taxi' },
  sport:  { w: 48, h: 21, accel: 1.45, max: 1.3, hp: 80, name: 'Comet GT' },
  truck:  { w: 62, h: 26, accel: 0.7, max: 0.8, hp: 160, name: 'Hauler' },
  van:    { w: 54, h: 24, accel: 0.85, max: 0.9, hp: 130, name: 'Van' },
  police: { w: 47, h: 22, accel: 1.2, max: 1.12, hp: 120, name: 'Interceptor' },
  coupe:  { w: 45, h: 21, accel: 1.15, max: 1.1, hp: 90, name: 'Coupe' },
};

export const MISSIONS = [
  { id: 1, name: 'Fresh Paint', giver: 'Vera Solano',
    brief: 'Jax, you are out. I need wheels — any car, my garage, no questions. Bring one.',
    reward: 500 },
  { id: 2, name: 'The Pickup', giver: 'Vera Solano',
    brief: 'A package is waiting at the marina pier. Walk in, grab it, bring it back. Keep it quiet.',
    reward: 900 },
  { id: 3, name: 'Hot Pursuit', giver: 'Vera Solano',
    brief: 'The Vultures tipped off the cops. You are hot — three stars. Lose them and reach the safehouse.',
    reward: 1400 },
  { id: 4, name: 'The Vultures', giver: 'Vera Solano',
    brief: 'They hit my garage. Go to the warehouse district and settle it. All six of them.',
    reward: 2200 },
  { id: 5, name: 'The Big Score', giver: 'Vera Solano',
    brief: 'A Comet GT sits in the downtown tower garage. Take it, bring it to the pier. Then run — they will all come.',
    reward: 5000 },
  { id: 6, name: 'Shop Job', giver: 'Vera Solano',
    brief: 'The corner store on Ocean Drive keeps its cash in a back safe. Walk in, take it, bring it to the garage.',
    reward: 1800 },
  { id: 7, name: 'Street Kings', giver: 'Vera Solano',
    brief: 'A rival crew challenges you to a race down Ocean Drive. Beat their Comet GT to the pier — 75 seconds.',
    reward: 2600 },
  { id: 8, name: 'Rescue Vera', giver: 'Vera Solano',
    brief: 'They took Vera to the warehouse. Eight guards between you and her. End it, then get her out.',
    reward: 6000 },
];

// Weapons: pistol is free and endless; shotgun + SMG come from the gun shop.
export const WEAPONS = {
  pistol:  { dmg: 34, cd: 0.22, pellets: 1, spread: 0.0,  name: 'PISTOL' },
  shotgun: { dmg: 22, cd: 0.85, pellets: 8, spread: 0.16, name: 'SHOTGUN' },
  smg:     { dmg: 16, cd: 0.09, pellets: 1, spread: 0.09, name: 'SMG' },
};

// Car radio stations (names only — the note patterns live in audio.js).
export const RADIO_STATIONS = ['SOL 87.9', 'NIGHT JAZZ 101', 'STREET ROCK 96'];

export const STORY_INTRO =
  'SOLMARA — the sun city. Jax Marlowe did three years for a job that went wrong. ' +
  'Now he is out, broke, and Vera Solano — the fixer who never forgets a debt — owns his mornings. ' +
  'One last run of jobs, and he is free. It starts with a stolen car.';
