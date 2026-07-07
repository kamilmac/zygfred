// patch — what a zygfred sound IS: the param config and the live patch values.
// Single owner of patch state; every other domain reads it or mutates through the
// control surface, and derives per-hit data via hitTakes().

export const PARAMS = ['Tune', 'Ratio', 'FM', 'FMDec', 'PEnv', 'PDec', 'Decay', 'Snap', 'Tone', 'Rand', 'Haas', 'Width', 'Vol'];
export const P_RAND = 9;
export const P_HAAS = 10;
export const P_WIDTH = 11; // 0 = mono (left take on both channels), 1 = full stereo
export const P_VOL = 12; // per-voice gain, applied on the velocity path (voice amp is linear in vel)

export const DRUMS = [
  { name: 'KICK', key: 'A' },
  { name: 'SNARE', key: 'S' },
  { name: 'HIHAT', key: 'D' },
];

export const BIT_OPTIONS = [
  ['off', 0], ['12bit', 2048], ['8bit', 128], ['6bit', 32], ['4bit', 8], ['3bit', 4],
];

// ordered as the signal flows through the engine: reverb -> drive -> bits -> comp -> volume.
// a param with `options` is discrete: its 0..1 value snaps to an option, and the engine is
// sent that option's value instead of the raw normal
export const MASTER = [
  { name: 'Reverb', msg: 'reverb', value: 0.0 },
  { name: 'Drive', msg: 'drive', value: 0.0 },
  { name: 'Bits', msg: 'bits', value: 0.0, options: BIT_OPTIONS },
  { name: 'Comp', msg: 'comp', value: 0.0 },
  { name: 'Volume', msg: 'volume', value: 0.7 },
];

const optionIdx = (m) => Math.round(m.value * (m.options.length - 1));
export const masterValue = (m) => (m.options ? m.options[optionIdx(m)][1] : m.value);
export const masterLabel = (m) => (m.options ? m.options[optionIdx(m)][0] : `${Math.round(m.value * 100)}`);

const DEFAULTS = [
  [0.18, 0.10, 0.20, 0.70, 0.55, 0.65, 0.45, 0.10, 0.10, 0.15, 0.10, 1.00, 1.00],
  [0.42, 0.25, 0.40, 0.60, 0.20, 0.70, 0.25, 0.70, 0.50, 0.35, 0.25, 1.00, 1.00],
  [0.72, 0.45, 0.60, 0.20, 0.00, 0.50, 0.12, 0.60, 0.80, 0.40, 0.35, 1.00, 1.00],
];

// same trigger mapping as native zygfred: keys are semitones, C/D/E pitch classes hit the drums
export const KEY_SEMITONE = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };
export const SEMITONE_DRUM = { 0: 0, 2: 1, 4: 2 };

export const drums = DEFAULTS.map((p) => [...p]);

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
const rnd = () => Math.random() * 2 - 1;

/// One hit's actual parameters: independently-perturbed L/R takes (Rand's work) plus the
/// derived stereo/length/gain values the engine needs.
export function hitTakes(drum, vel = 0.9) {
  const p = drums[drum];
  const rand = p[P_RAND];
  const vl = new Float32Array(9);
  const vr = new Float32Array(9);
  for (let i = 0; i < 9; i++) {
    vl[i] = clamp01(p[i] + rand * 0.15 * rnd());
    vr[i] = clamp01(p[i] + rand * 0.15 * rnd());
  }
  return {
    vl,
    vr,
    rand,
    vel: vel * p[P_VOL],
    haas: p[P_HAAS] * 0.03, // 0..30 ms inter-channel delay
    width: p[P_WIDTH],
    len: 0.08 + 1.8 * p[6],
  };
}

export function snapshot() {
  // master values keyed by name — immune to strip reordering; discrete params store their
  // normalized value like everything else
  const master = Object.fromEntries(MASTER.map((m) => [m.msg, m.value]));
  return { drums: drums.map((p) => [...p]), master };
}
