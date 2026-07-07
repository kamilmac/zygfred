# ◆ zygfred

An FM drum machine that lives in the browser.

**Play it: https://zygfred.zweibel-cocaine.com/**

Three FM percussion voices — kick, snare, hihat — synthesized in Rust (fundsp), compiled to
WebAssembly, rendered in an AudioWorklet. Play it with the `a`/`s`/`d` keys, the pads, or any
MIDI controller (notes with a C/D/E pitch class trigger the drums; CC learn binds knobs to
sliders). Install it via Chrome's address-bar icon to get a dock app where MIDI makes sound
without clicking first.

The signature feature is **Rand**: per-hit randomisation that perturbs each voice's sound
params independently for the left and right channel. The soft band on each slider shows
Rand's reach; the white ticks show where each hit actually landed.

## Structure

```
engine/     the sound — FM voices, master chain, offline envelope analysis (Rust → wasm)
web/
  app/      the instrument — one ES module per domain, wired together in main.js
    patch.js      param config + patch state (the single owner)
    engine.js     main-thread audio shell: AudioContext, worklet node, messages
    worklet.js    audio-thread shell: runs the wasm engine per render quantum
    surface.js    bars, panels, master strip, rand bands + ticks
    scope.js      per-voice envelope scope
    midi.js       Web MIDI: triggers, CC learn, channel filter
    presets.js    8 slots, hold to save, localStorage
    main.js       orchestration — the only place domains meet
  index.html / styles.css
deploy.sh   builds the engine, bundles the app (esbuild), publishes to Cloudflare Pages
```

## Develop

```sh
wasm-pack build engine --target web --release --out-dir ../web/pkg
python3 -m http.server -d web 8642
```

## Deploy

```sh
./deploy.sh
```
