// The renderer: one canvas, a fixed 1280x720 logical field scaled to the window.
// Everything is drawn with canvas paths and gradients — no images, no network.
// Screens: title, play, paused, game over, victory.

import { ENEMY, FIELD, FONT, PALETTE } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

// Fixed stars and rain, so every load paints the same sky.
const starRandom = createRandom(20261116);
const STARS = [];
for (let i = 0; i < 130; i += 1) {
  STARS.push({ x: starRandom() * FIELD.width, y: starRandom() * FIELD.height * 0.55, r: 0.5 + starRandom() * 1.4, tw: starRandom() * TAU });
}
const RAIN = [];
for (let i = 0; i < 90; i += 1) {
  RAIN.push({ x: starRandom() * (FIELD.width + 80), y: starRandom() * FIELD.height, len: 14 + starRandom() * 18, speed: 520 + starRandom() * 260 });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let cssW = FIELD.width;
  let cssH = FIELD.height;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = canvas.clientWidth || FIELD.width;
    cssH = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = Math.min(cssW / FIELD.width, cssH / FIELD.height);
    offsetX = (cssW - FIELD.width * scale) / 2;
    offsetY = (cssH - FIELD.height * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  /** Canvas CSS pixels to logical field coordinates. */
  function toLogical(x, y) {
    return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
  }

  function drawBackground(state) {
    const t = state.time;
    // Night sky.
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Stars, gently twinkling.
    for (const s of STARS) {
      ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(t * 0.7 + s.tw));
      ctx.fillStyle = '#dfe9ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Moon with a halo.
    const mx = FIELD.width - 190;
    const my = 92;
    const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 120);
    halo.addColorStop(0, 'rgba(244, 233, 200, 0.35)');
    halo.addColorStop(1, 'rgba(244, 233, 200, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 130, my - 130, 260, 260);
    ctx.fillStyle = PALETTE.moon;
    ctx.beginPath();
    ctx.arc(mx, my, 38, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(190, 175, 130, 0.35)';
    ctx.beginPath();
    ctx.arc(mx - 15, my + 9, 5, 0, TAU);
    ctx.arc(mx + 9, my - 13, 4, 0, TAU);
    ctx.arc(mx + 17, my + 11, 3, 0, TAU);
    ctx.fill();
    // Distant mountains.
    ctx.fillStyle = PALETTE.mountainFar;
    ctx.beginPath();
    ctx.moveTo(0, 470);
    ctx.lineTo(180, 380);
    ctx.lineTo(330, 450);
    ctx.lineTo(520, 360);
    ctx.lineTo(700, 460);
    ctx.lineTo(880, 385);
    ctx.lineTo(1060, 455);
    ctx.lineTo(1280, 390);
    ctx.lineTo(1280, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.mountainNear;
    ctx.beginPath();
    ctx.moveTo(0, 520);
    ctx.lineTo(220, 450);
    ctx.lineTo(430, 515);
    ctx.lineTo(660, 445);
    ctx.lineTo(900, 520);
    ctx.lineTo(1120, 460);
    ctx.lineTo(1280, 510);
    ctx.lineTo(1280, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fill();
    // Rice paddies: layered green bands with a water shine.
    const bands = [
      { y: 560, h: 52, c: PALETTE.paddy1 },
      { y: 606, h: 54, c: PALETTE.paddy2 },
      { y: 654, h: 66, c: PALETTE.paddy3 },
    ];
    for (const b of bands) {
      ctx.fillStyle = b.c;
      ctx.fillRect(0, b.y, FIELD.width, b.h);
      ctx.fillStyle = 'rgba(120, 200, 255, 0.10)';
      ctx.fillRect(0, b.y, FIELD.width, 3);
    }
    // Paddy reflections: a few still, glowing rows.
    ctx.strokeStyle = 'rgba(127, 231, 255, 0.16)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i += 1) {
      const y = 578 + i * 19;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(320, y - 6, 640, y + 6, 1280, y - 3);
      ctx.stroke();
    }
  }

  function drawRain(state) {
    ctx.strokeStyle = 'rgba(174, 205, 255, 0.28)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const d of RAIN) {
      const y = (d.y + state.time * d.speed) % (FIELD.height + 40) - 20;
      const x = d.x - (state.time * 60) % 90;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + d.len);
    }
    ctx.stroke();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.alive) return;
    if (p.invulnerable > 0 && Math.floor(state.time * 14) % 2 === 0) return; // blink while invulnerable
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 18;
    // Kite body: a bright diamond with a gold spine.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(0, -2, 4.5, 0, TAU);
    ctx.fill();
    // Tail ribbons.
    ctx.strokeStyle = 'rgba(255, 215, 106, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 16);
    ctx.quadraticCurveTo(-12, 30 + Math.sin(state.time * 6) * 4, -6, 42);
    ctx.moveTo(6, 16);
    ctx.quadraticCurveTo(12, 30 - Math.sin(state.time * 6) * 4, 6, 42);
    ctx.stroke();
    ctx.restore();
    // Shield ring.
    if (p.shield) {
      ctx.save();
      ctx.strokeStyle = 'rgba(110, 243, 255, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = PALETTE.shield;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 + Math.sin(state.time * 4) * 2, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemies(state) {
    for (const e of state.enemies) {
      if (!e.active) continue;
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === 'wisp') {
        ctx.shadowColor = PALETTE.wisp;
        ctx.shadowBlur = 14;
        ctx.fillStyle = 'rgba(139, 124, 246, 0.9)';
        ctx.beginPath();
        ctx.arc(0, 0, e.r, Math.PI, 0);
        ctx.lineTo(e.r, e.r * 0.7);
        ctx.lineTo(e.r * 0.45, e.r * 0.3);
        ctx.lineTo(0, e.r * 0.7);
        ctx.lineTo(-e.r * 0.45, e.r * 0.3);
        ctx.lineTo(-e.r, e.r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = PALETTE.wispEye;
        ctx.beginPath();
        ctx.arc(-6, -3, 3, 0, TAU);
        ctx.arc(6, -3, 3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#2a2350';
        ctx.beginPath();
        ctx.arc(-6, -3, 1.4, 0, TAU);
        ctx.arc(6, -3, 1.4, 0, TAU);
        ctx.fill();
      } else if (e.kind === 'moth') {
        const flap = Math.sin(e.t * 14 + e.phase) * 0.5;
        ctx.shadowColor = PALETTE.moth;
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(255, 179, 71, 0.92)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-14, -10 - flap * 8);
        ctx.lineTo(-8, 8);
        ctx.closePath();
        ctx.moveTo(0, 0);
        ctx.lineTo(14, -10 - flap * 8);
        ctx.lineTo(8, 8);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#5a3a10';
        ctx.beginPath();
        ctx.ellipse(0, 0, 4, 8, 0, 0, TAU);
        ctx.fill();
      } else if (e.kind === 'orb') {
        ctx.shadowColor = PALETTE.orb;
        ctx.shadowBlur = 14;
        ctx.fillStyle = 'rgba(255, 95, 162, 0.9)';
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * TAU + e.t * 0.8;
          const r = i % 2 === 0 ? e.r + 5 : e.r - 3;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff0f6';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, TAU);
        ctx.fill();
      } else if (e.kind === 'boss') {
        // The Storm King: a huge bruised cloud with lightning eyes.
        ctx.shadowColor = PALETTE.boss;
        ctx.shadowBlur = 30;
        ctx.fillStyle = 'rgba(88, 52, 140, 0.95)';
        ctx.beginPath();
        ctx.arc(-26, 6, 26, 0, TAU);
        ctx.arc(0, -12, 32, 0, TAU);
        ctx.arc(28, 6, 26, 0, TAU);
        ctx.arc(0, 14, 28, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(182, 120, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(0, -10, 24, 0, TAU);
        ctx.fill();
        // Lightning eyes.
        ctx.strokeStyle = '#ffe95e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-16, -14);
        ctx.lineTo(-11, -4);
        ctx.lineTo(-15, -4);
        ctx.lineTo(-9, 6);
        ctx.moveTo(16, -14);
        ctx.lineTo(11, -4);
        ctx.lineTo(15, -4);
        ctx.lineTo(9, 6);
        ctx.stroke();
        // Crown spikes.
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.moveTo(-24, -26);
        ctx.lineTo(-18, -42);
        ctx.lineTo(-12, -26);
        ctx.lineTo(-4, -44);
        ctx.lineTo(4, -26);
        ctx.lineTo(12, -42);
        ctx.lineTo(18, -26);
        ctx.closePath();
        ctx.fill();
        // HP ring.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 12, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      // HP pips for tough enemies.
      if ((e.kind === 'orb' || e.kind === 'boss') && e.hp > 0) {
        const max = e.kind === 'boss' ? ENEMY.boss.hp : 3;
        const w = e.kind === 'boss' ? 90 : 30;
        const x = e.x - w / 2;
        const y = e.y - e.r - 14;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(x - 1, y - 1, w + 2, 7);
        ctx.fillStyle = e.kind === 'boss' ? PALETTE.boss : PALETTE.orb;
        ctx.fillRect(x, y, (w * Math.max(0, e.hp)) / max, 5);
      }
    }
  }

  function drawShots(state) {
    // Player bolts: bright streaks.
    ctx.save();
    ctx.shadowColor = PALETTE.bolt;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = PALETTE.bolt;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const b of state.bolts) {
      if (!b.active) continue;
      ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
    // Enemy shots: glowing storm orbs.
    for (const s of state.shots) {
      if (!s.active) continue;
      ctx.save();
      ctx.shadowColor = PALETTE.enemyShot;
      ctx.shadowBlur = 12;
      ctx.fillStyle = PALETTE.enemyShot;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPowers(state) {
    for (const pw of state.powers) {
      if (!pw.active) continue;
      const bob = Math.sin(pw.t * 4) * 3;
      const colors = { spread: PALETTE.spread, rapid: PALETTE.rapid, shield: PALETTE.shield, heart: PALETTE.heart };
      const color = colors[pw.kind] || '#fff';
      ctx.save();
      ctx.translate(pw.x, pw.y + bob);
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(11, 18, 38, 0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.font = 'bold 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const glyph = pw.kind === 'spread' ? '✦' : pw.kind === 'rapid' ? '⚡' : pw.kind === 'shield' ? '◉' : '♥';
      ctx.fillText(glyph, 0, 1);
      ctx.restore();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of state.floaters) {
      if (!f.active) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function heart(x, y, filled, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 16, size / 16);
    ctx.fillStyle = filled ? PALETTE.heart : 'rgba(255, 255, 255, 0.18)';
    ctx.shadowColor = filled ? PALETTE.heart : 'transparent';
    ctx.shadowBlur = filled ? 8 : 0;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.bezierCurveTo(-9, -3, -5, -10, 0, -5);
    ctx.bezierCurveTo(5, -10, 9, -3, 0, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHud(state, best) {
    // Top bar.
    ctx.fillStyle = 'rgba(7, 13, 31, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, 52);
    ctx.font = 'bold 20px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('SKOR  ' + state.score.toLocaleString('en-US'), 18, 17);
    ctx.font = '14px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('TERBAIK  ' + Math.max(best, state.score).toLocaleString('en-US'), 18, 40);
    ctx.font = 'bold 21px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(state.wave > 0 ? 'GELOMBANG  ' + state.wave + ' / 10' : 'PETIR', FIELD.width / 2, 27);
    // Lives, top right.
    for (let i = 0; i < 4; i += 1) {
      heart(FIELD.width - 26 - i * 30, 26, i < state.lives, 15);
    }
    // Combo meter.
    if (state.combo > 1) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 17px ' + FONT;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText('KOMBO ×' + state.combo, 18, 72);
      ctx.fillStyle = 'rgba(255, 215, 106, 0.25)';
      ctx.fillRect(18, 82, 120, 5);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(18, 82, 120 * (state.comboTimer / 2.5), 5);
    }
    // Active power-ups as chips.
    const p = state.player;
    const chips = [];
    if (p.spread > 0) chips.push(['SPREAD', p.spread / 12, PALETTE.spread]);
    if (p.rapid > 0) chips.push(['RAPID', p.rapid / 10, PALETTE.rapid]);
    if (p.shield) chips.push(['SHIELD', 1, PALETTE.shield]);
    chips.forEach((chip, i) => {
      const x = 18;
      const y = 104 + i * 26;
      ctx.fillStyle = 'rgba(7, 13, 31, 0.6)';
      roundRect(ctx, x, y, 132, 20, 10);
      ctx.fill();
      ctx.fillStyle = chip[2];
      ctx.fillRect(x + 8, y + 13, 116 * chip[1], 4);
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(chip[0], x + 8, y + 9);
    });
    // Boss health bar.
    let boss = null;
    for (const e of state.enemies) if (e.active && e.kind === 'boss') { boss = e; break; }
    if (boss) {
      const w = 420;
      const x = (FIELD.width - w) / 2;
      const y = 66;
      ctx.fillStyle = 'rgba(7, 13, 31, 0.7)';
      roundRect(ctx, x - 8, y - 8, w + 16, 30, 8);
      ctx.fill();
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e6d4ff';
      ctx.fillText('RAJA BADAI', FIELD.width / 2, y + 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(x, y + 8, w, 7);
      ctx.fillStyle = PALETTE.boss;
      ctx.fillRect(x, y + 8, (w * Math.max(0, boss.hp)) / ENEMY.boss.hp, 7);
    }
    // Wave banner.
    if (state.waveBanner > 0 && state.wave > 0) {
      const a = Math.min(1, state.waveBanner / 0.6);
      ctx.globalAlpha = a;
      ctx.font = 'bold 44px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.gold;
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 24;
      ctx.fillText(state.wave === 10 ? 'RAJA BADAI DATANG' : 'GELOMBANG ' + state.wave, FIELD.width / 2, FIELD.height / 2 - 60);
      ctx.shadowBlur = 0;
      ctx.font = '17px ' + FONT;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(state.wave === 10 ? 'Kalahkan dia dan fajar pun tiba.' : 'Bertahanlah sampai fajar.', FIELD.width / 2, FIELD.height / 2 - 26);
      ctx.globalAlpha = 1;
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(5, 9, 22, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 28;
    ctx.font = 'bold 72px ' + FONT;
    ctx.fillText(title, FIELD.width / 2, 218);
    ctx.shadowBlur = 0;
    ctx.font = '21px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    let y = 300;
    for (const line of lines) {
      ctx.fillText(line, FIELD.width / 2, y);
      y += 34;
    }
  }

  function drawTitle(state, best) {
    overlay('PETIR', [
      'Guardian of the Monsoon  •  Penjaga Sawah di Malam Badai',
      '',
      'WASD / Panah — terbang      Mouse — membidik      Klik / Spasi — petir',
      'P — jeda      M — suara      R — ulang',
      '',
      'Bertahanlah 10 gelombang. Kalahkan Raja Badai dan fajar pun tiba.',
    ], PALETTE.player);
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('Tekan Spasi atau Klik untuk mulai', FIELD.width / 2, 520);
    if (best > 0) {
      ctx.font = '17px ' + FONT;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('Skor terbaik: ' + best.toLocaleString('en-US'), FIELD.width / 2, 556);
    }
  }

  function drawPaused() {
    overlay('JEDA', ['Permainan dijeda.', 'Tekan P atau Spasi untuk lanjut.', 'R — mulai dari awal.'], PALETTE.muted);
  }

  function drawOver(state, best) {
    overlay('GAME OVER', [
      'Badai menelan sang penjaga.',
      '',
      'Skor: ' + state.score.toLocaleString('en-US') + '    •    Terbaik: ' + Math.max(best, state.score).toLocaleString('en-US'),
      'Gelombang tercapai: ' + state.wave + ' / 10      •      Musuh dikalahkan: ' + state.kills,
      '',
      'Tekan R atau Enter untuk mencoba lagi',
    ], '#ff5f7a');
  }

  function drawWin(state, best) {
    overlay('FAJAR TIBA', [
      'Raja Badai tumbang. Mentari terbit di atas sawah.',
      '',
      'Skor: ' + state.score.toLocaleString('en-US') + '    •    Terbaik: ' + Math.max(best, state.score).toLocaleString('en-US'),
      'Musuh dikalahkan: ' + state.kills + '      •      Semua 10 gelombang dilewati',
      '',
      'Tekan R atau Enter untuk bermain lagi',
    ], PALETTE.gold);
  }

  function draw(state, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
    // Letterbox bars.
    ctx.fillStyle = '#050914';
    ctx.fillRect(-offsetX / scale - 2, -offsetY / scale - 2, FIELD.width + (offsetX / scale) * 2 + 4, FIELD.height + (offsetY / scale) * 2 + 4);
    ctx.save();
    if (state.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawBackground(state);
    drawRain(state);
    drawPowers(state);
    drawEnemies(state);
    drawPlayer(state);
    drawShots(state);
    drawParticles(state);
    ctx.restore();
    // Lightning flash.
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(230, 240, 255, ${Math.min(0.5, state.flash * 0.5)})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_WIN) drawWin(state, best);
  }

  return { draw, resize, toLogical };
}
