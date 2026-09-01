"use client";

import extractPeaksFromBuffer from "@waveform-playlist/webaudio-peaks";
import { useEffect, useRef, useState } from "react";

type PeakArray = Int8Array | Int16Array;
type WaveformPeakData = {
  length: number;
  data: PeakArray[];
  bits: 8 | 16;
};

type AudioWaveformCanvasProps = {
  url: string;
  offset: number;
  duration: number;
  amplitudeScale?: number;
  className?: string;
};

const audioBufferCache = new Map<string, Promise<AudioBuffer>>();
const peaksCache = new Map<string, WaveformPeakData>();
const MAX_AUDIO_CACHE = 24;
const MAX_PEAK_CACHE = 96;

function trimCache<K, V>(cache: Map<K, V>, max: number) {
  while (cache.size > max) {
    const first = cache.keys().next().value as K | undefined;
    if (first === undefined) break;
    cache.delete(first);
  }
}

async function decodeAudio(url: string) {
  const cached = audioBufferCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("No se pudo leer el audio para dibujar la forma de onda.");
    const raw = await response.arrayBuffer();
    const context = new AudioContext();
    try {
      return await context.decodeAudioData(raw.slice(0));
    } finally {
      await context.close();
    }
  })();

  audioBufferCache.set(url, promise);
  trimCache(audioBufferCache, MAX_AUDIO_CACHE);
  try {
    return await promise;
  } catch (error) {
    audioBufferCache.delete(url);
    throw error;
  }
}

function peakDivisor(bits: 8 | 16) {
  return bits === 8 ? 127 : 32767;
}

function peakCacheKey(url: string, cueIn: number, cueOut: number, samplesPerPixel: number) {
  return `${url}|${cueIn}|${cueOut}|${samplesPerPixel}`;
}

export default function AudioWaveformCanvas({
  url,
  offset,
  duration,
  amplitudeScale = 1,
  className = "",
}: AudioWaveformCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [peaks, setPeaks] = useState<WaveformPeakData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => {
      const rect = host.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!url || size.width <= 1 || duration <= 0) return;

    void (async () => {
      try {
        const buffer = await decodeAudio(url);
        if (cancelled) return;

        const cueIn = Math.max(0, Math.min(buffer.length - 1, Math.floor(offset * buffer.sampleRate)));
        const requestedEnd = Math.ceil((offset + duration) * buffer.sampleRate);
        const cueOut = Math.max(cueIn + 1, Math.min(buffer.length, requestedEnd));
        const sourceSamples = Math.max(1, cueOut - cueIn);

        // Un par min/max por columna visible aproximadamente. Al hacer zoom la
        // resolución aumenta automáticamente en vez de estirar una figura vieja.
        const targetColumns = Math.max(80, Math.min(6000, Math.ceil(size.width * 1.35)));
        const samplesPerPixel = Math.max(1, Math.floor(sourceSamples / targetColumns));
        const key = peakCacheKey(url, cueIn, cueOut, samplesPerPixel);
        let next = peaksCache.get(key);
        if (!next) {
          next = extractPeaksFromBuffer(buffer, samplesPerPixel, false, cueIn, cueOut, 16) as WaveformPeakData;
          peaksCache.set(key, next);
          trimCache(peaksCache, MAX_PEAK_CACHE);
        }

        if (!cancelled) {
          setPeaks(next);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setPeaks(null);
          setError(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [duration, offset, size.width, url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host || !peaks || size.width <= 0 || size.height <= 0) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(size.width * dpr));
    canvas.height = Math.max(1, Math.round(size.height * dpr));
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);

    const inherited = getComputedStyle(host).color || "rgb(196,181,253)";
    const channels = peaks.data.slice(0, 2);
    const visibleChannels = Math.max(1, channels.length);
    const channelHeight = size.height / visibleChannels;
    const scale = Math.max(0.35, Math.min(6, amplitudeScale));
    const divisor = peakDivisor(peaks.bits);

    context.lineWidth = 1;
    context.strokeStyle = inherited;
    context.globalAlpha = 0.94;

    channels.forEach((channel, channelIndex) => {
      const pairCount = Math.max(1, Math.floor(channel.length / 2));
      const top = channelIndex * channelHeight;
      const center = top + channelHeight / 2;
      const amplitude = channelHeight * 0.46 * scale;

      context.save();
      context.beginPath();
      context.rect(0, top, size.width, channelHeight);
      context.clip();

      // Línea de cero como referencia, igual que en un editor de audio.
      context.globalAlpha = 0.2;
      context.beginPath();
      context.moveTo(0, Math.round(center) + 0.5);
      context.lineTo(size.width, Math.round(center) + 0.5);
      context.stroke();

      context.globalAlpha = 0.94;
      context.beginPath();
      for (let x = 0; x < size.width; x += 1) {
        const pair = Math.min(pairCount - 1, Math.floor((x / Math.max(1, size.width - 1)) * pairCount));
        const min = Number(channel[pair * 2] || 0) / divisor;
        const max = Number(channel[pair * 2 + 1] || 0) / divisor;
        const yTop = center - max * amplitude;
        const yBottom = center - min * amplitude;
        context.moveTo(x + 0.5, yTop);
        context.lineTo(x + 0.5, yBottom);
      }
      context.stroke();
      context.restore();

      if (visibleChannels > 1) {
        context.globalAlpha = 0.45;
        context.font = "8px ui-sans-serif, system-ui, sans-serif";
        context.fillStyle = inherited;
        context.fillText(channelIndex === 0 ? "L" : "R", 5, top + 10);
      }
    });

    if (visibleChannels > 1) {
      context.globalAlpha = 0.22;
      context.beginPath();
      context.moveTo(0, channelHeight);
      context.lineTo(size.width, channelHeight);
      context.stroke();
    }
  }, [amplitudeScale, peaks, size.height, size.width]);

  return (
    <div ref={hostRef} className={`pointer-events-none absolute inset-x-3 inset-y-1 overflow-hidden ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {!peaks && !error ? <div className="absolute inset-0 animate-pulse bg-current opacity-[0.04]" /> : null}
      {error ? <div className="absolute inset-0 flex items-center justify-center text-[8px] opacity-45">onda no disponible</div> : null}
    </div>
  );
}
