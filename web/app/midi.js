// midi — Web MIDI: note triggers (C/D/E pitch class, velocity), CC learn, channel filter.
// Owns the MIDI strip DOM, the CC map, and learn state. Gets trigger + the control
// registry injected by main; never reaches into other domains directly.

import { SEMITONE_DRUM } from './patch.js';

const CC_KEY = 'zygfred-cc';
const CH_KEY = 'zygfred-midi-ch';

let midiAccess = null;
let midiChannel = +(localStorage.getItem(CH_KEY) || 0); // 0 = omni
let ccMap = {}; // cc number -> control id
try { ccMap = JSON.parse(localStorage.getItem(CC_KEY) || '{}'); } catch { /* fresh map */ }
let learn = null; // null | 'pick' (waiting for a slider click) | control id (waiting for a CC)
let toastTimer = null;
const els = {};

let trigger = () => {};
let controls = [];
let onLockedNote = () => {}; // MIDI arrived while audio is suspended — main shows the banner

export function init(deps) {
  trigger = deps.trigger;
  controls = deps.controls;
  onLockedNote = deps.onLockedNote;
}

function saveCcMap() {
  localStorage.setItem(CC_KEY, JSON.stringify(ccMap));
}

/// CC bindings for preset embedding — undefined when nothing is learned
export function ccSnapshot() {
  return Object.keys(ccMap).length ? { ...ccMap } : undefined;
}

export function applyCcMap(map) {
  ccMap = { ...map };
  saveCcMap();
  refreshStatus();
}

function refreshStatus() {
  if (!els.status || !midiAccess) return;
  const names = [...midiAccess.inputs.values()].map((p) => p.name);
  const port = names.length ? names.join(' · ') : 'no device';
  els.status.textContent = `${port} · ${Object.keys(ccMap).length} CC maps`;
}

function toast(text) {
  clearTimeout(toastTimer);
  els.status.classList.add('accent');
  els.status.textContent = text;
  toastTimer = setTimeout(() => {
    els.status.classList.remove('accent');
    refreshStatus();
  }, 2000);
}

/// The surface calls this on every bar pointerdown; true = the click was a learn pick.
export function tryArmLearn(id) {
  if (learn !== 'pick') return false;
  learn = id;
  controls[id].bar.classList.add('armed');
  els.status.textContent = `turn a knob → ${controls[id].name}`;
  return true;
}

export function disarmLearn() {
  if (typeof learn === 'number') controls[learn]?.bar.classList.remove('armed');
  learn = null;
  els.learnBtn?.classList.remove('on');
  refreshStatus();
}

export function onMidiMessage(e) {
  if (e.data.length < 3) return;
  onLockedNote();
  const [status, d1, d2] = e.data;
  const ch = status & 0x0f;
  if (midiChannel !== 0 && midiChannel !== ch + 1) return;
  const type = status & 0xf0;
  if (type === 0x90 && d2 > 0) {
    const drum = SEMITONE_DRUM[d1 % 12]; // any C/D/E pitch class, like native
    if (drum !== undefined) trigger(drum, d2 / 127);
  } else if (type === 0xb0) {
    if (typeof learn === 'number') {
      const id = learn;
      ccMap[d1] = id;
      saveCcMap();
      disarmLearn();
      toast(`CC${d1} → ${controls[id].name}`);
    } else if (ccMap[d1] !== undefined) {
      controls[ccMap[d1]]?.apply(d2 / 127);
    }
  }
}

function attachInputs() {
  for (const input of midiAccess.inputs.values()) input.onmidimessage = onMidiMessage;
  refreshStatus();
}

export async function start() {
  if (!navigator.requestMIDIAccess) {
    els.status.textContent = 'Web MIDI not supported in this browser';
    els.learnBtn.disabled = true;
    return;
  }
  try {
    midiAccess = await navigator.requestMIDIAccess();
  } catch {
    els.status.textContent = 'MIDI access denied';
    return;
  }
  midiAccess.onstatechange = attachInputs; // hot-plug: the controller can arrive later
  attachInputs();
}

export function build() {
  const strip = document.querySelector('#midi');
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = 'MIDI';

  const chSel = document.createElement('select');
  ['Omni', ...Array.from({ length: 16 }, (_, i) => `ch ${i + 1}`)].forEach((t, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = t;
    chSel.append(o);
  });
  chSel.value = midiChannel;
  chSel.addEventListener('change', () => {
    midiChannel = +chSel.value;
    localStorage.setItem(CH_KEY, midiChannel);
  });

  const learnBtn = document.createElement('button');
  learnBtn.className = 'learn';
  learnBtn.textContent = 'learn';
  learnBtn.addEventListener('click', () => {
    if (learn !== null) {
      disarmLearn();
      return;
    }
    learn = 'pick';
    learnBtn.classList.add('on');
    els.status.textContent = 'click a slider…';
  });

  const status = document.createElement('span');
  status.className = 'status';
  status.textContent = 'click or play to enable';

  els.learnBtn = learnBtn;
  els.status = status;
  strip.append(tag, chSel, learnBtn, status);
}
