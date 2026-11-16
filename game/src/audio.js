// Procedural sound, WebAudio only — no audio files, no network. The context is
// created on the first user gesture (browsers block sound before one) and every call
// is guarded, so a browser without audio simply stays silent.

let ctx = null;
let master = null;
let muted = false;

export function setMuted(value) {
  muted = !!value;
  if (master) master.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

function ensure() {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Unlock audio from a user gesture (call on start / first click). */
export function unlockAudio() {
  ensure();
}

function tone(freq, dur, type, vol, slideTo) {
  const ac = ensure();
  if (!ac) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ac.currentTime + dur + 0.02);
  } catch {
    // Sound is garnish: never let it break the game.
  }
}

function noise(dur, vol, lowpass) {
  const ac = ensure();
  if (!ac) return;
  try {
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  } catch {
    // Sound is garnish: never let it break the game.
  }
}

export const sfx = {
  /** A lightning bolt leaves the kite. */
  zap() {
    tone(880, 0.09, 'sawtooth', 0.16, 220);
  },
  /** Something bursts. */
  boom() {
    noise(0.22, 0.3, 900);
    tone(160, 0.18, 'triangle', 0.2, 50);
  },
  /** The player is hit. */
  hurt() {
    tone(220, 0.25, 'square', 0.2, 60);
    noise(0.18, 0.22, 500);
  },
  /** A power-up is collected. */
  pickup() {
    tone(660, 0.1, 'sine', 0.22);
    setTimeout(() => tone(990, 0.14, 'sine', 0.22), 70);
  },
  /** A wave begins: distant thunder. */
  wave() {
    noise(0.7, 0.25, 320);
    tone(70, 0.6, 'sine', 0.25, 40);
  },
  /** The Storm King appears. */
  boss() {
    tone(110, 0.5, 'sawtooth', 0.22, 55);
    noise(0.5, 0.2, 400);
  },
  /** Dawn breaks: the game is won. */
  win() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.22), i * 110));
  },
  /** The last life is gone. */
  lose() {
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.2), i * 130));
  },
};
