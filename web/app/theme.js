// theme — runtime color overrides on top of theme.css. The stylesheet holds the defaults;
// this modal writes inline :root overrides (surface family + ink derived from the picked
// surface, four accent pickers) and persists them. Reset = remove overrides.

const KEY = 'zygfred-colors';
const FIELDS = [
  ['surface', '--panel'],
  ['kick', '--voice0'],
  ['snare', '--voice1'],
  ['hihat', '--voice2'],
  ['master', '--accent'],
];

// curated sets: surface + kick/snare/hihat/master, designed to work together
const THEMES = [
  ['carbon', { surface: '#161616', kick: '#7dc9d1', snare: '#b8486d', hihat: '#d8bf5f', master: '#f0eeea' }],
  ['navy', { surface: '#222e50', kick: '#007991', snare: '#439a86', hihat: '#e9d985', master: '#bcd8c1' }],
  ['rust', { surface: '#26201b', kick: '#e07a5f', snare: '#f2cc8f', hihat: '#81b29a', master: '#f4f1de' }],
  ['forest', { surface: '#1d2a23', kick: '#7fb069', snare: '#e6aa68', hihat: '#cfe1b9', master: '#ecf4e7' }],
  ['dusk', { surface: '#241f3d', kick: '#8e7dff', snare: '#ff7edb', hihat: '#ffd166', master: '#efeafc' }],
  ['port', { surface: '#2a1a24', kick: '#d4707e', snare: '#e8b04b', hihat: '#9fd8cb', master: '#f2e9e4' }],
  ['ocean', { surface: '#132430', kick: '#2e86ab', snare: '#f6ae2d', hihat: '#a7d3e0', master: '#eaf4f4' }],
  ['ember', { surface: '#241518', kick: '#f25c54', snare: '#f4a261', hihat: '#ffe1c6', master: '#fff4ec' }],
  ['moss', { surface: '#212a1e', kick: '#87a878', snare: '#d9bf77', hihat: '#eff7cf', master: '#f4f7ee' }],
  ['arctic', { surface: '#1b2432', kick: '#5390d9', snare: '#ffd6ba', hihat: '#cae9ff', master: '#f1f6f9' }],
  ['sakura', { surface: '#2b2028', kick: '#d88bab', snare: '#9ad1aa', hihat: '#f6e7cb', master: '#fbf3f5' }],
  ['taxi', { surface: '#1b1b1b', kick: '#ffd60a', snare: '#ff453a', hihat: '#e8e8e8', master: '#fffbe6' }],
  ['mint', { surface: '#17251f', kick: '#2ec4b6', snare: '#ff9f1c', hihat: '#cbf3f0', master: '#f0fbf9' }],
  ['grape', { surface: '#251b30', kick: '#9d4edd', snare: '#ffc857', hihat: '#d0bdf4', master: '#f3edfa' }],
  ['copper', { surface: '#211a14', kick: '#bf7145', snare: '#ddb967', hihat: '#d8e2dc', master: '#f2ebe3' }],
  ['lagoon', { surface: '#113537', kick: '#26a69a', snare: '#e4c988', hihat: '#b2dfdb', master: '#ecf7f6' }],
  ['cobalt', { surface: '#14213d', kick: '#fca311', snare: '#e5e5e5', hihat: '#98c1d9', master: '#ffffff' }],
  ['rose noir', { surface: '#1e151c', kick: '#ef476f', snare: '#ffd166', hihat: '#06d6a0', master: '#f7f0f3' }],
];

let onChange = () => {};

export function init(deps) {
  onChange = deps.onChange;
}

// resolve any CSS color string (hsl, hex, rgb) to #rrggbb for the color inputs
function toHex(str) {
  const probe = document.createElement('div');
  probe.style.color = str;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+/g).map(Number);
  probe.remove();
  return '#' + rgb.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
}

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l * 100];
  const d = mx - mn;
  const s = d / (l > 0.5 ? 2 - mx - mn : mx + mn);
  let h;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function apply(colors) {
  const root = document.documentElement.style;
  // surface family + ink derive from the picked panel color
  const [h, s, l] = hexToHsl(colors.surface);
  const c = (ss, ll) => `hsl(${h.toFixed(0)} ${Math.max(0, ss).toFixed(0)}% ${Math.min(96, Math.max(0, ll)).toFixed(1)}%)`;
  root.setProperty('--panel', colors.surface);
  root.setProperty('--bg', c(s, l - 7));
  root.setProperty('--inset', c(s, l - 11));
  root.setProperty('--track', c(s - 12, l + 10));
  root.setProperty('--line', c(s - 14, l + 6));
  root.setProperty('--idle', c(Math.min(s, 22), 78));
  root.setProperty('--dim', c(Math.min(s, 15), 60));
  root.setProperty('--faint', c(Math.min(s, 14), 48));
  root.setProperty('--accent', colors.master);
  root.setProperty('--voice0', colors.kick);
  root.setProperty('--voice1', colors.snare);
  root.setProperty('--voice2', colors.hihat);
}

function clear() {
  const root = document.documentElement.style;
  ['--panel', '--bg', '--inset', '--track', '--line', '--idle', '--dim', '--faint',
    '--accent', '--voice0', '--voice1', '--voice2'].forEach((p) => root.removeProperty(p));
}

function current() {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(FIELDS.map(([name, token]) => [name, toHex(cs.getPropertyValue(token).trim())]));
}

export function build() {
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  })();
  if (stored) apply(stored);

  const modal = document.querySelector('#theme');
  const inputs = Object.fromEntries(FIELDS.map(([name]) => [name, document.querySelector(`#theme-${name}`)]));
  const refresh = () => {
    const cur = current();
    FIELDS.forEach(([name]) => { inputs[name].value = cur[name]; });
  };
  const update = () => {
    const colors = Object.fromEntries(FIELDS.map(([name]) => [name, inputs[name].value]));
    localStorage.setItem(KEY, JSON.stringify(colors));
    apply(colors);
    onChange();
  };
  FIELDS.forEach(([name]) => inputs[name].addEventListener('input', update));
  const sets = document.querySelector('#theme-sets');
  for (const [name, colors] of THEMES) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.title = name;
    const stops = [colors.surface, colors.kick, colors.snare, colors.hihat, colors.master]
      .map((col, i) => `${col} ${i * 20}% ${(i + 1) * 20}%`).join(', ');
    b.style.background = `linear-gradient(90deg, ${stops})`;
    b.addEventListener('click', () => {
      FIELDS.forEach(([n]) => { inputs[n].value = colors[n]; });
      update();
    });
    sets.append(b);
  }
  document.querySelector('#theme-reset').addEventListener('click', () => {
    localStorage.removeItem(KEY);
    clear(); // back to theme.css defaults
    refresh();
    onChange();
  });
  const openBtn = document.querySelector('#theme-open');
  openBtn.addEventListener('click', () => {
    refresh();
    modal.hidden = !modal.hidden;
  });
  document.addEventListener('pointerdown', (e) => {
    if (!modal.hidden && !modal.contains(e.target) && e.target !== openBtn) modal.hidden = true;
  });
}
