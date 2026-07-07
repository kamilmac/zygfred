// surface — the control surface: bars, voice panels, master strip, and the visual
// feedback tied to them (Rand range bands, per-hit ticks, hit flash). Turns patch data
// into DOM and pointer input back into patch mutations. Cross-domain calls (pad -> trigger,
// master -> engine, learn interception) are injected by main.

import { PARAMS, P_RAND, DRUMS, MASTER, drums, masterValue, masterLabel } from './patch.js';

// registry of every learnable control, indexed by id: drum params first (drum*13+param,
// incl. per-voice Vol), then master
export const controls = [];

let onPad = () => {};
let send = () => {};
let pickControl = () => false; // midi learn: intercept a bar click as "learn this control"
let registerCanvas = () => {};

export function init(deps) {
  onPad = deps.onPad;
  send = deps.send;
  pickControl = deps.pickControl;
  registerCanvas = deps.registerCanvas;
}

function makeBar({ id, name, getNorm, setNorm, getLabel, discreteSteps }) {
  const bar = document.createElement('div');
  bar.className = 'bar';
  const fill = document.createElement('div');
  fill.className = 'fill';
  bar.appendChild(fill);
  const val = document.createElement('span');
  val.className = 'val';

  const refresh = () => {
    fill.style.width = `${getNorm() * 100}%`;
    val.textContent = getLabel();
  };
  const setFromEvent = (e) => {
    const r = bar.getBoundingClientRect();
    let n = (e.clientX - r.left) / r.width;
    if (discreteSteps) n = Math.round(n * (discreteSteps - 1)) / (discreteSteps - 1);
    setNorm(Math.min(1, Math.max(0, n)));
    refresh();
  };
  bar.addEventListener('pointerdown', (e) => {
    if (id !== undefined && pickControl(id)) return; // learn mode: pick, don't set
    bar.setPointerCapture(e.pointerId);
    setFromEvent(e);
  });
  bar.addEventListener('pointermove', (e) => {
    if (bar.hasPointerCapture(e.pointerId)) setFromEvent(e);
  });
  bar.addEventListener('wheel', (e) => {
    e.preventDefault();
    const step = discreteSteps ? 1 / (discreteSteps - 1) : 0.05;
    const d = e.deltaY < 0 ? step : -step;
    setNorm(Math.min(1, Math.max(0, getNorm() + d)));
    refresh();
  }, { passive: false });

  refresh();
  if (id !== undefined) {
    controls[id] = {
      apply: (n) => {
        setNorm(Math.min(1, Math.max(0, n)));
        refresh();
      },
      bar,
      name,
    };
  }
  return { bar, val, refresh };
}

// ---------- rand visualisation: range bands + per-hit ticks ----------

const tickSetters = [[], [], []]; // [drum][param] -> (l), sound params only
const rangeEls = [[], [], []]; // [drum][param] -> the rand-range band element
const randRows = [];

// the band spans value ± rand*15% — the region a hit can actually land in
export function updateBands(drum) {
  const rand = drums[drum][P_RAND];
  randRows[drum]?.classList.toggle('rand-on', rand > 0);
  for (let pi = 0; pi < 9; pi++) {
    const el = rangeEls[drum][pi];
    if (!el) continue;
    if (rand <= 0) {
      el.style.display = 'none';
      continue;
    }
    const v = drums[drum][pi];
    const half = rand * 0.15;
    const lo = Math.max(0, v - half);
    const hi = Math.min(1, v + half);
    el.style.display = 'block';
    el.style.left = `${lo * 100}%`;
    el.style.width = `${(hi - lo) * 100}%`;
  }
}

export function updateAllBands() {
  for (let d = 0; d < DRUMS.length; d++) updateBands(d);
}

/// Visual acknowledgement of one hit: flash the panel; if Rand is in play, drop a fading
/// tick on each sound param where the left take actually landed.
export function showHit(drum, vl, rand) {
  if (rand > 0) for (let i = 0; i < 9; i++) tickSetters[drum][i]?.(vl[i]);
  const panel = document.querySelectorAll('.voice')[drum];
  panel.classList.remove('hit');
  void panel.offsetWidth; // restart the flash animation
  panel.classList.add('hit');
}

// ---------- building ----------

function paramRow(drum, pi) {
  const row = document.createElement('div');
  row.className = 'row';
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = PARAMS[pi];
  const { bar, val } = makeBar({
    id: drum * PARAMS.length + pi,
    name: `${DRUMS[drum].name} ${PARAMS[pi]}`,
    getNorm: () => drums[drum][pi],
    setNorm: (n) => {
      drums[drum][pi] = n;
      updateBands(drum); // rand's reach depends on both the value and Rand itself
    },
    getLabel: () => `${Math.round(drums[drum][pi] * 100)}`,
  });
  if (pi < 9) {
    const range = document.createElement('div');
    range.className = 'range';
    bar.append(range);
    rangeEls[drum][pi] = range;
    // every hit spawns its own tick that decays — the fading trail shows Rand's distribution
    tickSetters[drum][pi] = (l) => {
      const t = document.createElement('div');
      t.className = 'tick';
      t.style.left = `${l * 100}%`;
      bar.append(t);
      const ticks = bar.querySelectorAll('.tick');
      if (ticks.length > 6) ticks[0].remove();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        t.style.transition = 'opacity 1s ease-out 0.15s';
        t.style.opacity = 0;
      }));
      setTimeout(() => t.remove(), 1300);
    };
  }
  row.append(label, bar, val);
  return row;
}

function buildVoice(drum) {
  const panel = document.createElement('section');
  panel.className = 'voice';
  panel.dataset.voice = drum;
  const pad = document.createElement('button');
  pad.className = 'pad';
  pad.innerHTML = `${DRUMS[drum].name} <span class="key">${DRUMS[drum].key}</span>`;
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onPad(drum);
  });
  panel.appendChild(pad);

  for (let pi = 0; pi < 6; pi++) panel.appendChild(paramRow(drum, pi));

  const canvas = document.createElement('canvas');
  canvas.className = 'scope';
  canvas.width = 512;
  canvas.height = 112;
  registerCanvas(drum, canvas);
  panel.appendChild(canvas);

  for (let pi = 6; pi < PARAMS.length; pi++) {
    const row = paramRow(drum, pi);
    if (pi === P_RAND) {
      row.classList.add('sect'); // body | rand+stereo+gain
      randRows[drum] = row;
    }
    panel.appendChild(row);
  }
  return panel;
}

function buildMaster() {
  const strip = document.querySelector('#master');
  for (const [mi, m] of MASTER.entries()) {
    const cell = document.createElement('div');
    cell.className = 'row';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = m.name;
    const { bar, val } = makeBar({
      id: DRUMS.length * PARAMS.length + mi,
      name: m.name,
      discreteSteps: m.options ? m.options.length : 0,
      getNorm: () => m.value,
      setNorm: (n) => {
        // discrete params snap to their option grid so the stored value round-trips exactly
        m.value = m.options ? Math.round(n * (m.options.length - 1)) / (m.options.length - 1) : n;
        send({ type: m.msg, value: masterValue(m) });
      },
      getLabel: () => masterLabel(m),
    });
    cell.append(label, bar, val);
    strip.appendChild(cell);
  }
}

export function build() {
  const voices = document.querySelector('#voices');
  for (let d = 0; d < DRUMS.length; d++) voices.appendChild(buildVoice(d));
  buildMaster();
  updateAllBands();
}
