import type { MediaAsset, MultimediaProject, TimelineClip } from "./types";
import { interpolateClip, projectDuration, transitionFactor } from "./types";

export async function buildWaveform(url: string, buckets = 96) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("No se pudo leer el audio para generar la forma de onda.");
  const data = await response.arrayBuffer();
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(data.slice(0));
    const channel = buffer.getChannelData(0);
    const size = Math.max(1, Math.floor(channel.length / buckets));
    const peaks: number[] = [];
    for (let bucket = 0; bucket < buckets; bucket += 1) {
      const start = bucket * size;
      const end = Math.min(channel.length, start + size);
      let peak = 0;
      for (let index = start; index < end; index += 1) peak = Math.max(peak, Math.abs(channel[index] || 0));
      peaks.push(Math.max(0.04, peak));
    }
    const max = Math.max(...peaks, 0.001);
    return peaks.map((value) => value / max);
  } finally {
    await context.close();
  }
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function wavBlob(left: Float32Array, right: Float32Array | null, sampleRate: number) {
  const channels = right ? 2 : 1;
  const length = left.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + length * blockAlign, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, length * blockAlign, true);
  let offset = 44;
  for (let index = 0; index < length; index += 1) {
    const leftValue = Math.max(-1, Math.min(1, left[index] || 0));
    view.setInt16(offset, leftValue < 0 ? leftValue * 0x8000 : leftValue * 0x7fff, true);
    offset += 2;
    if (right) {
      const rightValue = Math.max(-1, Math.min(1, right[index] || 0));
      view.setInt16(offset, rightValue < 0 ? rightValue * 0x8000 : rightValue * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function fetchAudioBuffer(context: BaseAudioContext, asset: MediaAsset) {
  if (!asset.url || asset.exportable === false) return null;
  const response = await fetch(asset.url);
  if (!response.ok) return null;
  const raw = await response.arrayBuffer();
  try {
    return await context.decodeAudioData(raw.slice(0));
  } catch {
    return null;
  }
}

function gainAt(clip: TimelineClip, localTime: number) {
  const interpolated = interpolateClip(clip, localTime);
  const transition = transitionFactor(clip, localTime);
  return clip.muted ? 0 : Math.max(0, interpolated.volume * transition.opacity);
}

export async function exportProjectWav(project: MultimediaProject, assets: MediaAsset[]) {
  const duration = projectDuration(project);
  const sampleRate = 44100;
  const frames = Math.ceil(duration * sampleRate);
  const context = new OfflineAudioContext(2, frames, sampleRate);
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const cache = new Map<string, AudioBuffer | null>();

  const audioClips = project.tracks
    .filter((track) => track.kind === "audio" || track.kind === "music" || track.kind === "video")
    .flatMap((track) => track.clips)
    .filter((clip) => clip.clipType === "media" && clip.assetId);

  for (const clip of audioClips) {
    const asset = assetMap.get(clip.assetId!);
    if (!asset) continue;
    if (!cache.has(asset.id)) cache.set(asset.id, await fetchAudioBuffer(context, asset));
    const buffer = cache.get(asset.id);
    if (!buffer) continue;

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);

    const start = Math.max(0, clip.start);
    const offset = Math.max(0, Math.min(clip.offset, Math.max(0, buffer.duration - 0.01)));
    const available = Math.max(0.01, buffer.duration - offset);
    const clipDuration = Math.max(0.01, Math.min(clip.duration, available));
    const steps = Math.max(2, Math.min(24, Math.ceil(clipDuration * 4)));
    for (let step = 0; step <= steps; step += 1) {
      const local = (clipDuration * step) / steps;
      gain.gain.linearRampToValueAtTime(gainAt(clip, local), start + local);
    }
    source.start(start, offset, clipDuration);
  }

  const rendered = await context.startRendering();
  const left = rendered.getChannelData(0);
  const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : null;
  return wavBlob(left, right, sampleRate);
}
