export type SilenceRegion = { start: number; end: number; duration: number };
export type AudioAnalysis = { duration: number; peaks: number[]; silence: SilenceRegion[]; peak: number; rms: number };

function normalizePeaks(values: number[]) {
  const max = Math.max(0.0001, ...values);
  return values.map((value) => Math.min(1, value / max));
}

export async function analyzeAudioUrl(url: string, points = 220): Promise<AudioAnalysis> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo leer el audio (${response.status})`);
  const bytes = await response.arrayBuffer();
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("Este navegador no soporta análisis de audio.");
  const context = new AudioContextCtor();

  try {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const length = buffer.length;
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    const bucket = Math.max(1, Math.floor(length / points));
    const rawPeaks: number[] = [];
    let globalPeak = 0;
    let sumSquares = 0;
    let samples = 0;

    for (let i = 0; i < length; i += bucket) {
      const end = Math.min(length, i + bucket);
      let localPeak = 0;
      for (let j = i; j < end; j += Math.max(1, Math.floor(bucket / 120))) {
        let mixed = 0;
        for (const channel of channels) mixed += channel[j] || 0;
        mixed /= Math.max(1, channels.length);
        const absolute = Math.abs(mixed);
        localPeak = Math.max(localPeak, absolute);
        globalPeak = Math.max(globalPeak, absolute);
        sumSquares += mixed * mixed;
        samples += 1;
      }
      rawPeaks.push(localPeak);
    }

    const silence: SilenceRegion[] = [];
    const windowSeconds = 0.2;
    const windowSamples = Math.max(1, Math.floor(buffer.sampleRate * windowSeconds));
    const threshold = 0.018;
    const minimumSilence = 0.65;
    let silenceStart: number | null = null;

    for (let i = 0; i < length; i += windowSamples) {
      const end = Math.min(length, i + windowSamples);
      let square = 0;
      let count = 0;
      for (let j = i; j < end; j += 4) {
        let mixed = 0;
        for (const channel of channels) mixed += channel[j] || 0;
        mixed /= Math.max(1, channels.length);
        square += mixed * mixed;
        count += 1;
      }
      const rms = Math.sqrt(square / Math.max(1, count));
      const time = i / buffer.sampleRate;
      if (rms < threshold && silenceStart === null) silenceStart = time;
      if (rms >= threshold && silenceStart !== null) {
        if (time - silenceStart >= minimumSilence) silence.push({ start: silenceStart, end: time, duration: time - silenceStart });
        silenceStart = null;
      }
    }

    if (silenceStart !== null) {
      const end = buffer.duration;
      if (end - silenceStart >= minimumSilence) silence.push({ start: silenceStart, end, duration: end - silenceStart });
    }

    return {
      duration: buffer.duration,
      peaks: normalizePeaks(rawPeaks),
      silence,
      peak: globalPeak,
      rms: Math.sqrt(sumSquares / Math.max(1, samples)),
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}
