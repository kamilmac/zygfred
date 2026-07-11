// main — the one place the domains meet. Wires patch / engine / surface / scope /
// midi / presets together, owns the trigger path and global input (keyboard, wake gesture).

import { PARAMS, DRUMS, MASTER, KEY_SEMITONE, SEMITONE_DRUM, hitTakes, snapshot, masterValue } from './patch.js';
import * as engine from './engine.js';
import * as surface from './surface.js';
import * as scope from './scope.js';
import * as midi from './midi.js';
import * as presets from './presets.js';
import * as theme from './theme.js';

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
    if (st.master[m.msg] !== undefined) surface.controls[base + mi]?.apply(st.master[m.msg]);
  });
  surface.updateAllBands();
  scope.drawAll();
}

// ---------- wiring ----------

surface.init({ onPad: trigger, send: engine.send, pickControl: midi.tryArmLearn, registerCanvas: scope.registerCanvas });
midi.init({ trigger, controls: surface.controls, onLockedNote: () => { if (engine.suspended()) $('#locked').hidden = false; } });
presets.init({
  // presets carry CC bindings when any exist; presets without them leave current bindings alone
  snapshot: () => {
    const st = snapshot();
    const cc = midi.ccSnapshot();
    if (cc) st.cc = cc;
    return st;
  },
  apply: (st) => {
    applyState(st);
    if (st.cc) midi.applyCcMap(st.cc);
  },
});
theme.init({ onChange: scope.drawAll }); // scopes paint in voice colors

surface.build();
presets.build();
midi.build();
theme.build();

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

// ---------- zyg bridge: raw MIDI bytes from a sibling app (zygmund) over postMessage ----------

window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.type !== 'zyg-midi' || !Array.isArray(d.data) || d.data.length < 3) return;
  midi.onMidiMessage({ data: Uint8Array.from(d.data.slice(0, 3)) });
});

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
    $('#theme').hidden = true;
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
  MASTER.forEach((m) => engine.send({ type: m.msg, value: masterValue(m) }));
  scope.init({ sampleRate: engine.sampleRate });
  scope.drawAll();
  // debug/inspection surface
  window.zyg = { ctx, node, trigger, onMidiMessage: midi.onMidiMessage };
}).catch((err) => console.error('boot failed:', err));
