// engine (main-thread shell) — owns the AudioContext and the worklet node.
// Everything that crosses to the audio thread crosses here, as messages.

import init from '../pkg/zygfred_engine.js';

let ctx = null;
let node = null;

export function send(msg) {
  if (node) node.port.postMessage(msg);
}

export const ready = () => !!node;
export const sampleRate = () => (ctx ? ctx.sampleRate : 48000);
export const suspended = () => !!ctx && ctx.state === 'suspended';
export const resume = () => {
  if (suspended()) ctx.resume();
};

export async function boot() {
  ctx = new AudioContext(); // allowed pre-gesture; starts suspended, resumed by first input
  const bytes = await (await fetch('./pkg/zygfred_engine_bg.wasm')).arrayBuffer();
  const module = await WebAssembly.compile(bytes);
  await init({ module_or_path: module }); // main-thread instance, offline analysis only
  await ctx.audioWorklet.addModule('./app/worklet.js');
  node = new AudioWorkletNode(ctx, 'zygfred', {
    numberOfInputs: 0,
    outputChannelCount: [2],
    processorOptions: { module }, // the worklet scope has no fetch — hand it the compiled module
  });
  await new Promise((resolve) => {
    node.port.onmessage = (e) => e.data.type === 'ready' && resolve();
  });
  node.connect(ctx.destination);
  return { ctx, node };
}
