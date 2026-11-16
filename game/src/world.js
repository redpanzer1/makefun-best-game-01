// PETIR's world: pure game logic, no DOM and no drawing, so the same code runs in the
// browser and in a headless test. A fixed-step simulation over flat pools: the player
// (a storm-kite guardian), lightning bolts, three enemy kinds, a boss, enemy shots,
// power-ups, particles and floating score text.
//
// Ten waves. Clearing wave 10 — the Storm King falls — wins the game (EVENT_WIN).
// Losing the last life ends it (EVENT_OVER). Kills inside COMBO.window raise a
// multiplier up to COMBO.max; a hit resets it.

import { BOLT, COMBO, ENEMY, ENEMY_SHOT, FIELD, LIVES, MAX_LIVES, PLAYER, POOL, POWER, WAVE_BREAK, WAVES } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_WAVE = 8;
export const EVENT_KILL = 16;
export const EVENT_POWER = 32;
export const EVENT_BOSS = 64;

export const KIND_WISP = 'wisp';
export const KIND_MOTH = 'moth';
export const KIND_ORB = 'orb';
export const KIND_BOSS = 'boss';

const TAU = Math.PI * 2;

/** How many of each kind a wave spawns. [wisps, moths, orbs] */
const WAVE_TABLE = [
  [6, 0, 0],
  [8, 2, 0],
  [8, 4, 0],
  [10, 4, 1],
  [10, 6, 2],
  [12, 6, 2],
  [12, 8, 2],
  [14, 8, 3],
  [14, 10, 3],
  [0, 0, 0], // wave 10 is the boss
];

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    best: 0,
    lives: LIVES,
    wave: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    shotsFired: 0,
    /** 'title' | 'play' | 'over' | 'win' — the loop owns the screens; the world owns the outcome. */
    outcome: 'title',
    waveBreak: 0,
    waveBanner: 0,
    spawnQueue: [],
    spawnTimer: 0,
    bossSpawnTimer: 0,
    flash: 0,
    shake: 0,
    player: {
      x: FIELD.width / 2,
      y: FIELD.height * 0.62,
      vx: 0,
      vy: 0,
      radius: PLAYER.radius,
      angle: -Math.PI / 2,
      cooldown: 0,
      invulnerable: 0,
      spread: 0,
      rapid: 0,
      shield: false,
      alive: true,
      trail: 0,
    },
    bolts: [],
    shots: [],
    enemies: [],
    powers: [],
    particles: [],
    floaters: [],
  };

  for (let i = 0; i < POOL.bolts; i += 1) state.bolts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  for (let i = 0; i < POOL.shots; i += 1) state.shots.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  for (let i = 0; i < POOL.enemies; i += 1) state.enemies.push({ active: false, kind: KIND_WISP, x: 0, y: 0, vx: 0, vy: 0, hp: 1, r: 10, t: 0, phase: 0, shootTimer: 0, score: 0 });
  for (let i = 0; i < POOL.powers; i += 1) state.powers.push({ active: false, kind: 'heart', x: 0, y: 0, t: 0 });
  for (let i = 0; i < POOL.particles; i += 1) state.particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff' });
  for (let i = 0; i < POOL.floaters; i += 1) state.floaters.push({ active: false, x: 0, y: 0, text: '', life: 0, color: '#fff' });

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const p = free(state.particles);
      if (!p) return;
      const a = random() * TAU;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.max = 0.4 + random() * 0.5;
      p.life = p.max;
      p.size = 2 + random() * 3;
      p.color = color;
    }
  }

  function floatText(x, y, text, color) {
    const f = free(state.floaters);
    if (!f) return;
    f.active = true;
    f.x = x;
    f.y = y;
    f.text = text;
    f.life = 1.1;
    f.color = color;
  }

  function spawnEnemy(kind) {
    const e = free(state.enemies);
    if (!e) return;
    const spec = ENEMY[kind];
    // Enter from the top or a side, never on top of the player.
    let x;
    let y;
    const edge = random();
    if (edge < 0.6) {
      x = 40 + random() * (FIELD.width - 80);
      y = -30;
    } else if (edge < 0.8) {
      x = -30;
      y = 40 + random() * (FIELD.height * 0.55);
    } else {
      x = FIELD.width + 30;
      y = 40 + random() * (FIELD.height * 0.55);
    }
    e.active = true;
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.vx = 0;
    e.vy = 0;
    e.hp = spec.hp;
    e.r = spec.radius;
    e.t = 0;
    e.phase = random() * TAU;
    e.shootTimer = 1.2 + random() * 1.4;
    e.score = spec.score;
  }

  function startWave(n) {
    state.wave = n;
    state.waveBanner = WAVE_BREAK;
    state.waveBreak = WAVE_BREAK;
    state.spawnQueue = [];
    state.spawnTimer = 0.4;
    if (n === WAVES) {
      state.spawnQueue.push(KIND_BOSS);
      state.bossSpawnTimer = 0;
    } else {
      const [wisps, moths, orbs] = WAVE_TABLE[n - 1];
      for (let i = 0; i < wisps; i += 1) state.spawnQueue.push(KIND_WISP);
      for (let i = 0; i < moths; i += 1) state.spawnQueue.push(KIND_MOTH);
      for (let i = 0; i < orbs; i += 1) state.spawnQueue.push(KIND_ORB);
      // Shuffle the queue so the wave never arrives in one block of a kind.
      for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
      }
    }
    state.flash = 0.5;
  }

  function dropPower(x, y) {
    if (random() > POWER.dropChance) return;
    const p = free(state.powers);
    if (!p) return;
    const roll = random();
    p.kind = roll < 0.3 ? 'spread' : roll < 0.55 ? 'rapid' : roll < 0.8 ? 'shield' : 'heart';
    p.active = true;
    p.x = x;
    p.y = y;
    p.t = 0;
  }

  function killEnemy(e) {
    e.active = false;
    state.kills += 1;
    state.combo = Math.min(state.combo + 1, COMBO.max);
    state.comboTimer = COMBO.window;
    const mult = state.combo;
    const gained = e.score * mult;
    state.score += gained;
    floatText(e.x, e.y, `+${gained}`, mult > 1 ? '#ffd76a' : '#f2f5fb');
    const color = e.kind === KIND_BOSS ? '#b678ff' : e.kind === KIND_ORB ? '#ff5fa2' : e.kind === KIND_MOTH ? '#ffb347' : '#8b7cf6';
    burst(e.x, e.y, color, e.kind === KIND_BOSS ? 60 : 16, e.kind === KIND_BOSS ? 320 : 200);
    state.shake = Math.max(state.shake, e.kind === KIND_BOSS ? 14 : 5);
    if (e.kind === KIND_BOSS) state.flash = 0.9;
    if (e.kind !== KIND_BOSS) dropPower(e.x, e.y);
  }

  function hurtPlayer() {
    const p = state.player;
    if (p.invulnerable > 0 || !p.alive) return EVENT_HIT;
    if (p.shield) {
      p.shield = false;
      p.invulnerable = 1.2;
      burst(p.x, p.y, '#6ef3ff', 22, 240);
      state.shake = Math.max(state.shake, 8);
      return EVENT_HIT;
    }
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    p.invulnerable = PLAYER.invulnerable;
    burst(p.x, p.y, '#ff5f7a', 26, 260);
    state.shake = Math.max(state.shake, 12);
    state.flash = 0.35;
    if (state.lives <= 0) {
      p.alive = false;
      burst(p.x, p.y, '#7fe7ff', 50, 300);
      state.outcome = 'over';
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function fireBolt(angle) {
    const b = free(state.bolts);
    if (!b) return;
    const p = state.player;
    b.active = true;
    b.x = p.x + Math.cos(angle) * (p.radius + 8);
    b.y = p.y + Math.sin(angle) * (p.radius + 8);
    b.vx = Math.cos(angle) * PLAYER.boltSpeed;
    b.vy = Math.sin(angle) * PLAYER.boltSpeed;
    b.life = BOLT.life;
    state.shotsFired += 1;
  }

  function enemyShoot(e) {
    const s = free(state.shots);
    if (!s) return;
    const p = state.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    s.active = true;
    s.x = e.x;
    s.y = e.y;
    s.vx = (dx / d) * ENEMY_SHOT.speed;
    s.vy = (dy / d) * ENEMY_SHOT.speed;
    s.life = ENEMY_SHOT.life;
  }

  function bossBurst(e, count, speed, offset) {
    for (let i = 0; i < count; i += 1) {
      const s = free(state.shots);
      if (!s) return;
      const a = offset + (i / count) * TAU;
      s.active = true;
      s.x = e.x + Math.cos(a) * (e.r + 6);
      s.y = e.y + Math.sin(a) * (e.r + 6);
      s.vx = Math.cos(a) * speed;
      s.vy = Math.sin(a) * speed;
      s.life = ENEMY_SHOT.life;
    }
  }

  function applyPower(kind) {
    const p = state.player;
    if (kind === 'spread') p.spread = POWER.spreadSeconds;
    else if (kind === 'rapid') p.rapid = POWER.rapidSeconds;
    else if (kind === 'shield') p.shield = true;
    else if (kind === 'heart') {
      if (state.lives < MAX_LIVES) state.lives += 1;
      else state.score += 500;
    }
    const label = kind === 'spread' ? 'SPREAD SHOT!' : kind === 'rapid' ? 'RAPID FIRE!' : kind === 'shield' ? 'SHIELD UP!' : 'EXTRA LIFE!';
    floatText(p.x, p.y - 30, label, '#6ef3ff');
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.lives = LIVES;
    state.wave = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.kills = 0;
    state.shotsFired = 0;
    state.outcome = 'title';
    state.waveBreak = 0;
    state.waveBanner = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.bossSpawnTimer = 0;
    state.flash = 0;
    state.shake = 0;
    const p = state.player;
    p.x = FIELD.width / 2;
    p.y = FIELD.height * 0.62;
    p.vx = 0;
    p.vy = 0;
    p.angle = -Math.PI / 2;
    p.cooldown = 0;
    p.invulnerable = 0;
    p.spread = 0;
    p.rapid = 0;
    p.shield = false;
    p.alive = true;
    p.trail = 0;
    for (const list of [state.bolts, state.shots, state.enemies, state.powers, state.particles, state.floaters]) {
      for (const e of list) e.active = false;
    }
  }

  function begin() {
    reset();
    state.outcome = 'play';
    startWave(1);
  }

  /**
   * One fixed step. `input` is {mx, my, ax, ay, firing} — move direction, aim
   * direction (unit, or null), and whether the player is firing. `attract` runs
   * the title-screen demo: enemies drift, the player never dies and never shoots.
   * Returns an EVENT_* bitmask.
   */
  function step(dt, input, attract) {
    let events = 0;
    state.time += dt;
    const p = state.player;

    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.4);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    if (state.waveBanner > 0) state.waveBanner = Math.max(0, state.waveBanner - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // --- player ---
    if (p.alive && !attract) {
      const mx = input.mx || 0;
      const my = input.my || 0;
      const len = Math.hypot(mx, my);
      if (len > 0.01) {
        p.vx = (mx / len) * PLAYER.speed;
        p.vy = (my / len) * PLAYER.speed;
      } else {
        p.vx = 0;
        p.vy = 0;
      }
      p.x = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
      p.y = Math.min(FIELD.height - p.radius - 46, Math.max(p.radius + 8, p.y + p.vy * dt));
      if (input.ax !== null && input.ay !== null && (input.ax !== 0 || input.ay !== 0)) {
        p.angle = Math.atan2(input.ay, input.ax);
      }
      if (p.invulnerable > 0) p.invulnerable -= dt;
      if (p.spread > 0) p.spread -= dt;
      if (p.rapid > 0) p.rapid -= dt;
      p.cooldown -= dt;
      p.trail -= dt;
      if ((p.vx !== 0 || p.vy !== 0) && p.trail <= 0) {
        p.trail = 0.05;
        const part = free(state.particles);
        if (part) {
          part.active = true;
          part.x = p.x - Math.cos(p.angle) * p.radius;
          part.y = p.y - Math.sin(p.angle) * p.radius;
          part.vx = -p.vx * 0.12;
          part.vy = -p.vy * 0.12;
          part.max = 0.35;
          part.life = 0.35;
          part.size = 3;
          part.color = '#7fe7ff';
        }
      }
      if (input.firing && p.cooldown <= 0) {
        p.cooldown = p.rapid > 0 ? PLAYER.rapidCooldown : PLAYER.fireCooldown;
        fireBolt(p.angle);
        if (p.spread > 0) {
          fireBolt(p.angle - 0.17);
          fireBolt(p.angle + 0.17);
        }
      }
    } else if (attract) {
      // Title demo: the kite drifts on its own, untouchable.
      p.x = FIELD.width / 2 + Math.sin(state.time * 0.5) * 180;
      p.y = FIELD.height * 0.62 + Math.sin(state.time * 0.8) * 26;
      p.angle = -Math.PI / 2 + Math.sin(state.time * 0.5) * 0.25;
    }

    // --- spawning ---
    if (!attract && state.outcome === 'play') {
      if (state.waveBreak > 0) {
        state.waveBreak -= dt;
      } else if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          const kind = state.spawnQueue.shift();
          spawnEnemy(kind);
          if (kind === KIND_BOSS) events |= EVENT_BOSS;
          const base = state.wave >= WAVES ? 1.2 : Math.max(0.42, 0.95 - state.wave * 0.05);
          state.spawnTimer = base * (0.8 + random() * 0.4);
        }
      }
      // The Storm King keeps a few wisps in the air.
      if (state.wave === WAVES) {
        state.bossSpawnTimer -= dt;
        let alive = 0;
        let bossAlive = false;
        for (const e of state.enemies) {
          if (!e.active) continue;
          if (e.kind === KIND_BOSS) bossAlive = true;
          else alive += 1;
        }
        if (bossAlive && alive < 4 && state.bossSpawnTimer <= 0) {
          spawnEnemy(KIND_WISP);
          state.bossSpawnTimer = 6;
        }
      }
    } else if (attract) {
      // A slow trickle of wisps behind the title.
      state.spawnTimer -= dt;
      let wisps = 0;
      for (const e of state.enemies) if (e.active) wisps += 1;
      if (state.spawnTimer <= 0 && wisps < 5) {
        spawnEnemy(KIND_WISP);
        state.spawnTimer = 1.6;
      }
    }

    // --- bolts ---
    for (const b of state.bolts) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of state.enemies) {
        if (!e.active) continue;
        const rr = e.r + BOLT.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.active = false;
          e.hp -= BOLT.damage;
          burst(b.x, b.y, '#fff3a3', 5, 160);
          if (e.hp <= 0) {
            killEnemy(e);
            events |= EVENT_KILL;
            if (e.kind === KIND_BOSS) {
              state.outcome = 'win';
              events |= EVENT_WIN;
            }
          }
          break;
        }
      }
    }

    // --- enemies ---
    for (const e of state.enemies) {
      if (!e.active) continue;
      e.t += dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const speedScale = 1 + (state.wave - 1) * 0.04;
      if (e.kind === KIND_WISP) {
        const sp = ENEMY.wisp.speed * speedScale;
        e.vx = (dx / d) * sp;
        e.vy = (dy / d) * sp;
        // Wisps wobble as they drift.
        e.vx += Math.cos(e.t * 2.2 + e.phase) * 26;
      } else if (e.kind === KIND_MOTH) {
        const sp = ENEMY.moth.speed * speedScale;
        e.vx = (dx / d) * sp + Math.cos(e.t * 5 + e.phase) * 120;
        e.vy = (dy / d) * sp * 0.7 + Math.sin(e.t * 5 + e.phase) * 90;
      } else if (e.kind === KIND_ORB) {
        // Keep about 280 px away and strafe.
        const want = 280;
        const toward = d > want + 40 ? 1 : d < want - 40 ? -1 : 0;
        const sp = ENEMY.orb.speed * speedScale;
        e.vx = (dx / d) * sp * toward + (-dy / d) * 46 * Math.sin(e.t * 0.9 + e.phase);
        e.vy = (dy / d) * sp * toward + (dx / d) * 46 * Math.sin(e.t * 0.9 + e.phase);
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && !attract && p.alive) {
          enemyShoot(e);
          e.shootTimer = 2.4 + random() * 0.8;
        }
      } else if (e.kind === KIND_BOSS) {
        // Hover toward the upper middle, drift sideways, and rain shots.
        const tx = FIELD.width / 2 + Math.sin(e.t * 0.45) * 260;
        const ty = 150 + Math.sin(e.t * 0.7) * 46;
        e.vx = (tx - e.x) * 0.55;
        e.vy = (ty - e.y) * 0.55;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && !attract && p.alive) {
          bossBurst(e, 9, 200, e.t);
          e.shootTimer = 2.6;
          if (e.hp < ENEMY.boss.hp * 0.5) {
            bossBurst(e, 12, 165, e.t + 0.5);
            e.shootTimer = 2.0;
          }
        }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      // Wisps and moths that drift off the bottom come back at the top.
      if (e.kind !== KIND_BOSS && e.y > FIELD.height + 40) {
        e.y = -30;
        e.x = 40 + random() * (FIELD.width - 80);
      }
      if (e.kind !== KIND_BOSS) {
        e.x = Math.min(FIELD.width + 40, Math.max(-40, e.x));
      }
      // Touching the player hurts (never in attract mode).
      if (!attract && p.alive && p.invulnerable <= 0) {
        const rr = e.r + PLAYER.radius - 4;
        if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
          if (e.kind !== KIND_BOSS) {
            e.active = false;
            burst(e.x, e.y, '#8b7cf6', 14, 200);
          }
          events |= hurtPlayer();
          if (state.outcome === 'over') return events;
        }
      }
    }

    // --- enemy shots ---
    for (const s of state.shots) {
      if (!s.active) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.x < -20 || s.x > FIELD.width + 20 || s.y < -20 || s.y > FIELD.height + 20) {
        s.active = false;
        continue;
      }
      if (!attract && p.alive && p.invulnerable <= 0) {
        const rr = ENEMY_SHOT.radius + PLAYER.radius - 4;
        if (dist2(s.x, s.y, p.x, p.y) < rr * rr) {
          s.active = false;
          events |= hurtPlayer();
          if (state.outcome === 'over') return events;
        }
      }
    }

    // --- power-ups ---
    for (const pw of state.powers) {
      if (!pw.active) continue;
      pw.t += dt;
      pw.y += POWER.fallSpeed * dt;
      if (!attract && p.alive) {
        const d2 = dist2(pw.x, pw.y, p.x, p.y);
        if (d2 < POWER.magnetRadius * POWER.magnetRadius) {
          const d = Math.sqrt(d2) || 1;
          pw.x += ((p.x - pw.x) / d) * 260 * dt;
          pw.y += ((p.y - pw.y) / d) * 260 * dt;
        }
        if (d2 < POWER.collectRadius * POWER.collectRadius) {
          pw.active = false;
          applyPower(pw.kind);
          events |= EVENT_POWER;
          burst(pw.x, pw.y, '#6ef3ff', 12, 180);
        }
      }
      if (pw.y > FIELD.height + 24) pw.active = false;
    }

    // --- particles and floaters ---
    for (const part of state.particles) {
      if (!part.active) continue;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vx *= 1 - 2.4 * dt;
      part.vy *= 1 - 2.4 * dt;
      part.life -= dt;
      if (part.life <= 0) part.active = false;
    }
    for (const f of state.floaters) {
      if (!f.active) continue;
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) f.active = false;
    }

    // --- wave clear ---
    if (!attract && state.outcome === 'play' && state.waveBreak <= 0 && state.spawnQueue.length === 0) {
      let anyAlive = false;
      for (const e of state.enemies) if (e.active) { anyAlive = true; break; }
      if (!anyAlive) {
        const bonus = 250 * state.wave;
        state.score += bonus;
        floatText(FIELD.width / 2, FIELD.height / 2 - 40, `WAVE ${state.wave} CLEAR  +${bonus}`, '#ffd76a');
        events |= EVENT_WAVE;
        if (state.wave >= WAVES) {
          state.outcome = 'win';
          events |= EVENT_WIN;
        } else {
          startWave(state.wave + 1);
        }
      }
    }

    return events;
  }

  return { state, reset, begin, step };
}
