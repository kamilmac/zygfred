// scope — renders a hit's amplitude envelope (offline wasm render of the left take)
// into a voice's canvas. Owns the canvases; the surface registers them at build time.

import { capture_envelope } from '../pkg/zygfred_engine.js';
import { drums } from './patch.js';

const COLS = 256;
const canvases = [];
let getSampleRate = null; // set once the engine has booted; draws are no-ops before that

export function init({ sampleRate }) {
  getSampleRate = sampleRate;
}

export function registerCanvas(drum, canvas) {
  canvases[drum] = canvas;
}

export function draw(drum, vl) {
  const canvas = canvases[drum];
  if (!canvas || !getSampleRate) return;
  const take = vl ? new Float32Array(vl) : new Float32Array(drums[drum].slice(0, 9));
  // time span = where the amp envelope reaches -60dB (dec rate = 40 - 37*decay, env = e^-t*dec)
  const decRate = 40 - 37 * take[6];
  const seconds = Math.min(1.2, Math.max(0.15, 6.9 / decRate));
  const env = capture_envelope(take, getSampleRate(), COLS, seconds);
  const g = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  g.clearRect(0, 0, w, h);
  const accent = getComputedStyle(canvas.parentElement).getPropertyValue('--accent');

  // amplitude band: fill between per-column min and max
  const mid = h / 2;
  const yAmp = (v) => mid - v * (mid - 2);
  g.beginPath();
  for (let c = 0; c < COLS; c++) {
    const x = (c / (COLS - 1)) * w;
    c === 0 ? g.moveTo(x, yAmp(env[2 * c + 1])) : g.lineTo(x, yAmp(env[2 * c + 1]));
  }
  for (let c = COLS - 1; c >= 0; c--) {
    g.lineTo((c / (COLS - 1)) * w, yAmp(env[2 * c]));
  }
  g.closePath();
  g.globalAlpha = 0.55;
  g.fillStyle = accent;
  g.fill();
  g.globalAlpha = 1;
}

export function drawAll() {
  for (let d = 0; d < canvases.length; d++) draw(d);
}
