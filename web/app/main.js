// main — the one place the domains meet. Wires patch / engine / surface / scope /
// midi / presets together, owns the trigger path and global input (keyboard, wake gesture).

import { PARAMS, DRUMS, BIT_OPTIONS, MASTER, KEY_SEMITONE, SEMITONE_DRUM, state, hitTakes, snapshot } from './patch.js';
import * as engine from './engine.js';
import * as surface from './surface.js';
import * as scope from './scope.js';
import * as midi from './midi.js';
import * as presets from './presets.js';
import { capture_spectrogram } from '../pkg/zygfred_engine.js';

const $ = (sel) => document.querySelector(sel);

// ---------- the trigger path: patch -> engine -> visual feedback ----------

function trigger(drum, vel = 0.9) {
  if (!engine.ready()) return;
  // per-hit randomisation happens on this side, not in the engine, so the surface can
  // show where the takes actually landed (ticks) and the scope can render this hit
  const t = hitTakes(drum, vel);
  engine.send({ type: 'trigger', vl: t.vl, vr: t.vr, vel: t.vel, haas: t.haas, width: t.width, len: t.len });
  surface.showHit(drum, t.vl, t.rand);
  scope.draw(drum, t.vl);
}

// ---------- preset application: state -> control surface -> visuals ----------

function applyState(st) {
  st.drums.forEach((p, d) => p.forEach((v, i) => surface.controls[d * PARAMS.length + i]?.apply(v)));
  const base = DRUMS.length * PARAMS.length;
  MASTER.forEach((m, mi) => {
    if (m.msg === 'bits') surface.controls[base + mi]?.apply(st.bits / (BIT_OPTIONS.length - 1));
    else if (st.master[m.msg] !== undefined) surface.controls[base + mi]?.apply(st.master[m.msg]);
  });
  surface.updateAllBands();
  scope.drawAll();
}

// ---------- wiring ----------

surface.init({ onPad: trigger, send: engine.send, pickControl: midi.tryArmLearn });
midi.init({ trigger, controls: surface.controls, onLockedNote: () => { if (engine.suspended()) $('#locked').hidden = false; } });
presets.init({ snapshot, apply: applyState });

surface.build();
presets.build();
midi.build();

// help sheet
$('#help-open').addEventListener('click', () => { $('#help').hidden = false; });
$('#help').addEventListener('pointerdown', (e) => {
  if (e.target === e.currentTarget) $('#help').hidden = true; // backdrop closes; the sheet doesn't
});

// ---------- installed-app window ----------

// browsers give no control over a PWA window's initial size, but a standalone window may
// resize itself — snap it to the content once; Chrome remembers the size for next launches
function fitWindow() {
  if (!matchMedia('(display-mode: standalone)').matches) return;
  const tokens = getComputedStyle(document.documentElement);
  const appW = parseInt(tokens.getPropertyValue('--app-width'));
  const padX = parseInt(tokens.getPropertyValue('--sp-page-x'));
  const padBottom = parseInt(tokens.getPropertyValue('--sp-page'));
  const contentW = appW + 2 * padX;
  const contentH = Math.ceil(document.querySelector('footer').getBoundingClientRect().bottom) + padBottom;
  window.resizeTo(
    contentW + (window.outerWidth - window.innerWidth),
    contentH + (window.outerHeight - window.innerHeight),
  );
}
requestAnimationFrame(fitWindow);

// ---------- global input ----------

// browsers require one user gesture before audio can run — hijack the first natural one
let midiStarted = false;
function wake() {
  engine.resume();
  $('#locked').hidden = true;
  fitWindow(); // some platforms only allow self-resize after a gesture
  if (!midiStarted) {
    midiStarted = true;
    midi.start();
  }
}
document.addEventListener('pointerdown', wake, { capture: true });
document.addEventListener('keydown', wake, { capture: true });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    midi.disarmLearn();
    $('#help').hidden = true;
    return;
  }
  if (e.repeat || e.metaKey || e.ctrlKey || e.target.tagName === 'SELECT') return;
  if (e.key >= '1' && e.key <= String(presets.SLOTS)) {
    presets.load(+e.key);
    return;
  }
  const st = KEY_SEMITONE[e.key.toLowerCase()];
  if (st === undefined) return;
  const drum = SEMITONE_DRUM[((st % 12) + 12) % 12];
  if (drum !== undefined) trigger(drum);
});

// ---------- boot ----------

engine.boot().then(({ ctx, node }) => {
  // push full master state to the audio thread
  MASTER.forEach((m, mi) => {
    if (m.msg !== 'bits') engine.send({ type: m.msg, value: m.value });
  });
  engine.send({ type: 'bits', value: BIT_OPTIONS[state.bitsIdx][1] });
  scope.init({ sampleRate: engine.sampleRate });
  scope.drawAll();
  // debug/inspection surface
  window.zyg = {
    ctx,
    node,
    trigger,
    onMidiMessage: midi.onMidiMessage,
    capture: (p, secs = 0.6) => capture_spectrogram(new Float32Array(p), engine.sampleRate(), 256, 56, secs),
  };
}).catch((err) => console.error('boot failed:', err));
