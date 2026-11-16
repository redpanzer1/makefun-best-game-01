// The screenshot scenes behind ?shot=start|play|victory|end. Each one plays the
// real rules forward from a fresh world for a fixed time, steered by an autopilot
// (kite away from the nearest threat, aim at the nearest enemy, fire whenever one
// is in range), so the frame is what a real game looks like and the same seed
// always gives the same frame. The "victory" pilot plays to win; the "end" pilot
// looks only a heartbeat ahead, so it is caught out as a hurried player is.
import { FIELD, PLAYER, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN, KIND_BOSS } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;
/** How far ahead, in seconds, the pilot checks for danger. */
const HORIZON_SKILLED = 0.9;
const HORIZON_HURRIED = 0.22;

/**
 * One pilot decision: {mx, my, ax, ay, firing}. The skilled pilot keeps its
 * distance from every threat (repulsion summed over enemies and enemy shots,
 * weighted by closeness), sidesteps, collects a power-up when the air is clear,
 * and fires at the most dangerous enemy (the boss, then orb shooters, then the
 * nearest). A hurried pilot does none of that: it drifts to the middle and fires,
 * so the storm catches it as it catches a hurried player.
 */
function autopilot(state, horizon) {
  const p = state.player;
  if (horizon <= 0.25) {
    const cx = FIELD.width / 2;
    const cy = FIELD.height * 0.55;
    let target = null;
    let targetD = Infinity;
    for (const e of state.enemies) {
      if (!e.active) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < targetD) {
        targetD = d;
        target = e;
      }
    }
    let ax = 0;
    let ay = -1;
    let firing = false;
    if (target) {
      const d = Math.max(1, targetD);
      ax = (target.x - p.x) / d;
      ay = (target.y - p.y) / d;
      firing = true;
    }
    return { mx: (cx - p.x) / 400, my: (cy - p.y) / 400, ax, ay, firing };
  }

  let mx = 0;
  let my = 0;
  // Repulsion from every enemy close enough to matter, weighted by closeness.
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const reach = e.r + PLAYER.radius + horizon * 300;
    if (d < reach) {
      const w = (1 - d / reach) * 2.2;
      mx += (dx / d) * w;
      my += (dy / d) * w;
    }
  }
  // Repulsion from enemy shots by where they will be in `horizon` seconds.
  for (const s of state.shots) {
    if (!s.active) continue;
    const fx = s.x + s.vx * horizon;
    const fy = s.y + s.vy * horizon;
    const dx = p.x - fx;
    const dy = p.y - fy;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 110) {
      const w = (1 - d / 110) * 2.4;
      mx += (dx / d) * w;
      my += (dy / d) * w;
    }
  }
  // Keep off the walls.
  if (p.x < 130) mx += 0.8;
  if (p.x > FIELD.width - 130) mx -= 0.8;
  if (p.y < 130) my += 0.8;
  if (p.y > FIELD.height - 170) my -= 0.8;
  const mLen = Math.hypot(mx, my);
  if (mLen > 0.05) {
    mx /= mLen;
    my /= mLen;
  } else {
    // No danger: fetch the nearest power-up, else drift to mid-field.
    let pw = null;
    let pwD = Infinity;
    for (const item of state.powers) {
      if (!item.active) continue;
      const d = Math.hypot(item.x - p.x, item.y - p.y);
      if (d < pwD) {
        pwD = d;
        pw = item;
      }
    }
    if (pw) {
      mx = (pw.x - p.x) / Math.max(1, pwD);
      my = (pw.y - p.y) / Math.max(1, pwD);
    } else {
      mx = (FIELD.width / 2 - p.x) / 300;
      my = (FIELD.height * 0.55 - p.y) / 300;
    }
  }
  // Aim: the boss first, then orb shooters, then the nearest enemy.
  let target = null;
  let targetScore = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    const rank = e.kind === KIND_BOSS ? -10000 : e.kind === 'orb' ? -2000 : 0;
    const score = d + rank;
    if (score < targetScore) {
      targetScore = score;
      target = e;
    }
  }
  let ax = 0;
  let ay = -1;
  let firing = false;
  if (target) {
    const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
    // Lead the target a little: bolts take d/760 s to arrive.
    const lead = d / 760;
    const tx = target.x + (target.vx || 0) * lead;
    const ty = target.y + (target.vy || 0) * lead;
    const td = Math.hypot(tx - p.x, ty - p.y) || 1;
    ax = (tx - p.x) / td;
    ay = (ty - p.y) / td;
    firing = true;
  }
  return { mx, my, ax, ay, firing };
}

function playForward(world, seconds, horizon) {
  let events = 0;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    events = world.step(STEP, autopilot(world.state, horizon), false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, victory or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'victory' && name !== 'end') {
    // Title over a live demo world.
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { mx: 0, my: 0, ax: null, ay: null, firing: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  world.begin();
  if (name === 'play') {
    // Play until the Storm King arrives, then five more seconds of the boss
    // fight, so the frame shows the busiest moment of the game — the boss,
    // his spiral shots, trickling wisps and the kite's own bolts — rather than
    // the tail of a wave the pilot has nearly cleared.
    let guard = 0;
    const limit = Math.round(LIMIT_SECONDS / STEP);
    while (!(world.state.wave >= 10 && world.state.waveBreak <= 0) && guard < limit) {
      const events = world.step(STEP, autopilot(world.state, HORIZON_SKILLED), false);
      guard += 1;
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    for (let i = 0; i < Math.round(5 / STEP); i += 1) {
      const events = world.step(STEP, autopilot(world.state, HORIZON_SKILLED), false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    const over = world.state.outcome === 'over';
    const won = world.state.outcome === 'win';
    return { screen: over ? SCREEN_OVER : won ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'victory') {
    playForward(world, LIMIT_SECONDS, HORIZON_SKILLED);
    const won = world.state.outcome === 'win';
    return { screen: won ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
  }
  // end: the hurried pilot.
  playForward(world, LIMIT_SECONDS, HORIZON_HURRIED);
  const over = world.state.outcome === 'over';
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
