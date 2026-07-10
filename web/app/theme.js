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
  ['--panel', '--bg', '--inset', '--track', '--idle', '--dim', '--faint',
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
