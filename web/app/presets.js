// presets — 8 slots, hold to save, click / keys 1-8 to load. Owns the preset strip DOM
// and localStorage; how a snapshot is taken and re-applied is injected by main.

const PRESET_KEY = 'zygfred-presets';
const PRESET_HELP = 'hold to save · click or 1–8 to load';
export const SLOTS = 8;

let presets = {};
try { presets = JSON.parse(localStorage.getItem(PRESET_KEY) || '{}'); } catch { /* fresh */ }
let currentSlot = null;
const slotSyncs = [];
let hintTimer = null;

let snapshot = () => ({});
let apply = () => {};

export function init(deps) {
  snapshot = deps.snapshot;
  apply = deps.apply;
}

function hint(text, sticky) {
  const el = document.querySelector('#presets .hint');
  clearTimeout(hintTimer);
  el.textContent = text;
  el.classList.add('accent');
  if (!sticky) {
    hintTimer = setTimeout(() => {
      el.textContent = PRESET_HELP;
      el.classList.remove('accent');
    }, 1600);
  }
}

export function load(i) {
  if (!presets[i]) return;
  apply(presets[i]);
  currentSlot = i;
  slotSyncs.forEach((f) => f());
  hint(`loaded ${i}`);
}

export function build() {
  const strip = document.querySelector('#presets');
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = 'PRESET';
  strip.append(tag);
  for (let i = 1; i <= SLOTS; i++) {
    const b = document.createElement('button');
    b.className = 'slot';
    b.textContent = i;
    const sync = () => {
      b.classList.toggle('filled', !!presets[i]);
      b.classList.toggle('active', currentSlot === i);
    };
    slotSyncs.push(sync);
    let hold = null;
    let held = false;
    const disarm = () => {
      clearTimeout(hold);
      b.classList.remove('arming');
    };
    b.addEventListener('pointerdown', () => {
      held = false;
      b.classList.add('arming'); // charges toward accent for the hold duration
      hold = setTimeout(() => {
        held = true;
        presets[i] = snapshot();
        localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
        currentSlot = i;
        slotSyncs.forEach((f) => f());
        b.classList.remove('arming');
        hint(`saved ${i}`);
      }, 600);
    });
    b.addEventListener('pointerup', () => {
      disarm();
      if (held) return;
      if (presets[i]) load(i);
      else hint(`slot ${i} empty · hold to save`);
    });
    b.addEventListener('pointerleave', disarm);
    sync();
    strip.append(b);
  }
  const hintEl = document.createElement('span');
  hintEl.className = 'hint';
  hintEl.textContent = PRESET_HELP;
  strip.append(hintEl);
}
