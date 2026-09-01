export type WaveformChannel = {
  min: number[];
  max: number[];
};

export type DetailedWaveform = {
  channels: WaveformChannel[];
  duration: number;
  sampleRate: number;
  channelCount: number;
  buckets: number;
};

function clampBucketCount(value: number) {
  return Math.max(240, Math.min(1800, Math.round(value || 1200)));
}

export async function buildDetailedWaveform(url: string, requestedBuckets = 1200): Promise<DetailedWaveform> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("No se pudo leer el audio para generar la forma de onda detallada.");

  const data = await response.arrayBuffer();
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(data.slice(0));
    const buckets = Math.min(clampBucketCount(requestedBuckets), Math.max(1, buffer.length));
    const channelCount = Math.max(1, buffer.numberOfChannels);
    const visibleChannels = Math.min(2, channelCount);
    const bucketSize = Math.max(1, Math.ceil(buffer.length / buckets));
    const channels: WaveformChannel[] = [];
    let globalPeak = 0;

    for (let channelIndex = 0; channelIndex < visibleChannels; channelIndex += 1) {
      const source = buffer.getChannelData(channelIndex);
      const minValues: number[] = [];
      const maxValues: number[] = [];

      for (let bucket = 0; bucket < buckets; bucket += 1) {
        const start = bucket * bucketSize;
        if (start >= source.length) {
          minValues.push(0);
          maxValues.push(0);
          continue;
        }
        const end = Math.min(source.length, start + bucketSize);
        let min = 1;
        let max = -1;
        for (let index = start; index < end; index += 1) {
          const value = source[index] || 0;
          if (value < min) min = value;
          if (value > max) max = value;
        }
        if (min > max) {
          min = 0;
          max = 0;
        }
        globalPeak = Math.max(globalPeak, Math.abs(min), Math.abs(max));
        minValues.push(min);
        maxValues.push(max);
      }

      channels.push({ min: minValues, max: maxValues });
    }

    const normalizer = Math.max(0.001, globalPeak);
    const normalized = channels.map((channel) => ({
      min: channel.min.map((value) => Math.max(-1, Math.min(1, value / normalizer))),
      max: channel.max.map((value) => Math.max(-1, Math.min(1, value / normalizer))),
    }));

    return {
      channels: normalized,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channelCount,
      buckets,
    };
  } finally {
    await context.close();
  }
}
