import { DEFAULT_AUDIO_EFFECTS, type AudioEffects } from "./types";

/** Non-destructive Web Audio DSP shared by the monitor and both export engines. */
export function createAudioEffectsChain(
  context: BaseAudioContext,
  source: AudioNode,
  destination: AudioNode,
  options?: Partial<AudioEffects>,
) {
  const highpass = context.createBiquadFilter();
  highpass.type = "highpass";
  const low = context.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 180;
  const mid = context.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1400;
  mid.Q.value = 0.8;
  const high = context.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 4500;
  const compressor = context.createDynamicsCompressor();
  const panner = context.createStereoPanner();
  const makeup = context.createGain();

  const nodes: AudioNode[] = [highpass, low, mid, high, compressor, panner, makeup];
  source.connect(nodes[0]);
  for (let index = 1; index < nodes.length; index++) nodes[index - 1].connect(nodes[index]);
  nodes[nodes.length - 1].connect(destination);

  // Parallel wet paths keep the dry signal intact and work in OfflineAudioContext.
  const delay = context.createDelay(1);
  delay.delayTime.value = 0.27;
  const echoWet = context.createGain();
  makeup.connect(delay);
  delay.connect(echoWet);
  echoWet.connect(destination);

  const convolver = context.createConvolver();
  const reverbWet = context.createGain();
  const length = Math.round(context.sampleRate * 0.65);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const samples = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3);
    }
  }
  convolver.buffer = impulse;
  makeup.connect(convolver);
  convolver.connect(reverbWet);
  reverbWet.connect(destination);

  const setOptions = (incoming?: Partial<AudioEffects>) => {
    const fx = { ...DEFAULT_AUDIO_EFFECTS, ...incoming };
    const db = (value: number) => Math.max(-24, Math.min(24, Number(value) || 0));
    highpass.frequency.value = Math.max(20, Math.min(1200, Number(fx.highpassHz) || 20));
    low.gain.value = db(fx.lowDb);
    mid.gain.value = db(fx.midDb);
    high.gain.value = db(fx.highDb);
    const strength = Math.max(0, Math.min(1, fx.compression || 0));
    compressor.threshold.value = strength ? -12 - strength * 26 : 0;
    compressor.ratio.value = strength ? 1 + strength * 7 : 1;
    compressor.knee.value = 12;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;
    panner.pan.value = Math.max(-1, Math.min(1, fx.pan || 0));
    makeup.gain.value = Math.pow(10, db(fx.gainDb) / 20);
    echoWet.gain.value = Math.max(0, Math.min(1, fx.echo || 0)) * 0.45;
    reverbWet.gain.value = Math.max(0, Math.min(1, fx.reverb || 0)) * 0.55;
  };
  setOptions(options);
  return {
    setOptions,
    disconnect: () => {
      try { source.disconnect(highpass); } catch { /* element may already be gone */ }
      nodes.forEach((node) => node.disconnect());
      delay.disconnect();
      echoWet.disconnect();
      convolver.disconnect();
      reverbWet.disconnect();
    },
  };
}
