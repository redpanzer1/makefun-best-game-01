// PETIR — Guardian of the Monsoon. Every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 360,
  /** Seconds of invulnerability after a hit. */
  invulnerable: 1.6,
  /** Base seconds between lightning bolts. */
  fireCooldown: 0.22,
  /** Seconds between bolts while Rapid is active. */
  rapidCooldown: 0.11,
  /** Bolt speed, pixels per second. */
  boltSpeed: 760,
};

/** Lives at the start of a game, and the most a heart can restore to. */
export const LIVES = 3;
export const MAX_LIVES = 4;

/** How many waves a game lasts; clearing wave 10 (the Storm King) wins. */
export const WAVES = 10;
/** Seconds of banner and breathing room between waves. */
export const WAVE_BREAK = 2.5;

/** Enemy kinds, tuned per wave by the world's spawn table. */
export const ENEMY = {
  wisp: { radius: 16, hp: 1, speed: 78, score: 50 },
  moth: { radius: 13, hp: 1, speed: 185, score: 80 },
  orb: { radius: 18, hp: 3, speed: 58, score: 150 },
  boss: { radius: 48, hp: 60, speed: 42, score: 2000 },
};

export const BOLT = { radius: 5, damage: 1, life: 1.1 };
export const ENEMY_SHOT = { radius: 7, speed: 235, life: 6 };

/** Power-up kinds: how long the timed ones last, and the chance a kill drops one. */
export const POWER = {
  dropChance: 0.13,
  spreadSeconds: 12,
  rapidSeconds: 10,
  fallSpeed: 70,
  collectRadius: 30,
  magnetRadius: 110,
};

/** Combo: kills inside this window raise the multiplier, up to COMBO_MAX. */
export const COMBO = { window: 2.5, max: 8 };

/** Particle and floating-text pool sizes; the pools are allocated once, at boot. */
export const POOL = { particles: 256, floaters: 32, bolts: 96, shots: 96, enemies: 48, powers: 12 };

export const PALETTE = {
  skyTop: '#070d1f',
  skyMid: '#12203f',
  skyLow: '#1d3257',
  moon: '#f4e9c8',
  mountainFar: '#16233d',
  mountainNear: '#0e1a30',
  paddy1: '#14352a',
  paddy2: '#1d4a34',
  paddy3: '#276040',
  water: '#2a5d7d',
  player: '#7fe7ff',
  playerCore: '#eafcff',
  gold: '#ffd76a',
  bolt: '#fff3a3',
  wisp: '#8b7cf6',
  wispEye: '#e6e0ff',
  moth: '#ffb347',
  orb: '#ff5fa2',
  boss: '#b678ff',
  enemyShot: '#ff7a9e',
  heart: '#ff5f7a',
  shield: '#6ef3ff',
  spread: '#c9f158',
  rapid: '#ffd76a',
  panel: '#0b1226',
  text: '#f2f5fb',
  muted: '#9aa7c2',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'petir.best';
/** The muted flag is kept beside it. */
export const MUTE_KEY = 'petir.muted';
