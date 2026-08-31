"use client";

import { resolveClipFrame } from "./keyframes";
import type { MediaStudioProject, TimelineClip } from "./types";

type Prepared = { clip: TimelineClip; element: HTMLImageElement | HTMLVideoElement | HTMLAudioElement; gain?: GainNode };

export function downloadMediaBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function safeName(name: string) {
  return name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "eduai-media";
}

function canvasSize(project: MediaStudioProject) {
  const max = 1280;
  const scale = Math.min(1, max / Math.max(project.width, project.height));
  return { width: Math.max(2, Math.round(project.width * scale)), height: Math.max(2, Math.round(project.height * scale)), scale };
}

async function loadImage(clip: TimelineClip) {
  if (!clip.sourceUrl) return null;
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = clip.sourceUrl;
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error(`No se pudo cargar ${clip.name}`)); });
  return image;
}

async function loadVideo(clip: TimelineClip) {
  if (!clip.sourceUrl) return null;
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.playsInline = true;
  video.muted = true;
  video.src = clip.sourceUrl;
  await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error(`No se pudo cargar ${clip.name}`)); });
  return video;
}

async function loadAudio(clip: TimelineClip) {
  if (!clip.sourceUrl) return null;
  const audio = document.createElement("audio");
  audio.crossOrigin = "anonymous";
  audio.preload = "auto";
  audio.src = clip.sourceUrl;
  await new Promise<void>((resolve, reject) => { audio.onloadedmetadata = () => resolve(); audio.onerror = () => reject(new Error(`No se pudo cargar ${clip.name}`)); });
  return audio;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}

function drawClip(ctx: CanvasRenderingContext2D, clip: TimelineClip, source: CanvasImageSource | null, canvas: HTMLCanvasElement, scale: number, playhead: number) {
  const frame = resolveClipFrame(clip, playhead);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, frame.transform.opacity));
  ctx.translate(canvas.width / 2 + frame.transform.x * scale, canvas.height / 2 + frame.transform.y * scale);
  ctx.rotate((frame.transform.rotation * Math.PI) / 180);
  ctx.scale(frame.transform.scale, frame.transform.scale);
  ctx.filter = `brightness(${frame.style.brightness}) contrast(${frame.style.contrast}) saturate(${frame.style.saturation}) blur(${frame.style.blur * scale}px)`;

  if (source) {
    const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : canvas.width;
    const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : canvas.height;
    if (sourceWidth > 0 && sourceHeight > 0) {
      const fit = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
      const width = sourceWidth * fit;
      const height = sourceHeight * fit;
      if (frame.style.borderRadius > 0) {
        roundedRect(ctx, -width / 2, -height / 2, width, height, frame.style.borderRadius * scale);
        ctx.clip();
      }
      ctx.drawImage(source, -width / 2, -height / 2, width, height);
    }
  } else if (clip.type === "text") {
    const fontSize = Math.max(12, (clip.fontSize || 56) * scale);
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = clip.text || clip.name;
    const metrics = ctx.measureText(text);
    const pad = 14 * scale;
    if (clip.backgroundColor && clip.backgroundColor !== "transparent") {
      ctx.fillStyle = clip.backgroundColor;
      roundedRect(ctx, -metrics.width / 2 - pad, -fontSize / 1.25, metrics.width + pad * 2, fontSize * 1.6, frame.style.borderRadius * scale);
      ctx.fill();
    }
    ctx.fillStyle = clip.textColor || "#ffffff";
    ctx.fillText(text, 0, 0, canvas.width * 0.9);
  }
  ctx.restore();
}

async function prepareVisuals(project: MediaStudioProject) {
  const clips = project.tracks.flatMap((track) => track.hidden ? [] : track.clips).filter((clip) => clip.type === "image" || clip.type === "video");
  const prepared: Prepared[] = [];
  for (const clip of clips) {
    try {
      const element = clip.type === "image" ? await loadImage(clip) : await loadVideo(clip);
      if (element) prepared.push({ clip, element });
    } catch {
      // Recursos externos no guardados pueden fallar por CORS; la biblioteca los internaliza antes de editar.
    }
  }
  return prepared;
}

export async function exportProjectJson(project: MediaStudioProject) {
  downloadMediaBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), `${safeName(project.name)}.eduai-media.json`);
}

function srtTime(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(milli).padStart(3,"0")}`;
}

export async function exportSrt(project: MediaStudioProject) {
  const clips = project.tracks.flatMap((track) => track.clips).filter((clip) => clip.type === "text" && (clip.text || "").trim()).sort((a, b) => a.start - b.start);
  const body = clips.map((clip, index) => `${index + 1}\n${srtTime(clip.start)} --> ${srtTime(clip.start + clip.duration)}\n${clip.text}\n`).join("\n");
  downloadMediaBlob(new Blob([body || ""], { type: "text/plain;charset=utf-8" }), `${safeName(project.name)}.srt`);
}

export async function exportFramePng(project: MediaStudioProject, playhead: number) {
  const { width, height, scale } = canvasSize(project);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  const visuals = await prepareVisuals(project);
  const byId = new Map(visuals.map((item) => [item.clip.id, item.element]));
  const clips = project.tracks.flatMap((track) => track.hidden ? [] : track.clips).filter((clip) => ["image","video","text"].includes(clip.type) && playhead >= clip.start && playhead < clip.start + clip.duration);
  for (const clip of clips) {
    const source = byId.get(clip.id) || null;
    if (source instanceof HTMLVideoElement) {
      const frame = resolveClipFrame(clip, playhead);
      source.currentTime = Math.max(0, (playhead - clip.start) * frame.playbackRate + clip.trimStart);
      await new Promise<void>((resolve) => { const done = () => resolve(); source.onseeked = done; window.setTimeout(done, 600); });
    }
    drawClip(ctx, clip, source as CanvasImageSource | null, canvas, scale, playhead);
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("No se pudo crear PNG")), "image/png"));
  downloadMediaBlob(blob, `${safeName(project.name)}-${Math.round(playhead * 10) / 10}s.png`);
}

export async function renderWebMBlob(
  project: MediaStudioProject,
  onProgress?: (value: number) => void,
  mimeCandidates?: string[],
) {
  if (typeof MediaRecorder === "undefined") throw new Error("Este navegador no soporta MediaRecorder");
  const { width, height, scale } = canvasSize(project);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  const visuals = await prepareVisuals(project);
  const visualMap = new Map(visuals.map((item) => [item.clip.id, item.element]));

  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  const audioPrepared: Prepared[] = [];
  const audioClips = project.tracks.flatMap((track) => track.muted ? [] : track.clips).filter((clip) => ["audio","music","sfx"].includes(clip.type));
  for (const clip of audioClips) {
    try {
      const audio = await loadAudio(clip);
      if (!audio) continue;
      const source = audioContext.createMediaElementSource(audio);
      const gain = audioContext.createGain();
      source.connect(gain).connect(destination);
      audioPrepared.push({ clip, element: audio, gain });
    } catch {}
  }

  const canvasStream = canvas.captureStream(project.fps || 30);
  const combined = new MediaStream([...canvasStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
  const candidates = mimeCandidates?.length ? mimeCandidates : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const preferred = candidates.find((mime) => MediaRecorder.isTypeSupported(mime));
  if (!preferred) {
    await audioContext.close();
    throw new Error("El navegador no soporta el formato solicitado mediante MediaRecorder");
  }
  const recorder = new MediaRecorder(combined, { mimeType: preferred, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const stopped = new Promise<void>((resolve, reject) => { recorder.onstop = () => resolve(); recorder.onerror = () => reject(new Error("Falló MediaRecorder")); });

  await audioContext.resume();
  recorder.start(1000);
  const start = performance.now();
  const duration = Math.max(0.1, project.duration);

  await new Promise<void>((resolve) => {
    const frameLoop = () => {
      const t = Math.min(duration, (performance.now() - start) / 1000);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);

      for (const track of project.tracks) {
        if (track.hidden) continue;
        for (const clip of track.clips) {
          const active = t >= clip.start && t < clip.start + clip.duration;
          if (!["image","video","text"].includes(clip.type) || !active) continue;
          const resolved = resolveClipFrame(clip, t);
          const source = visualMap.get(clip.id) || null;
          if (source instanceof HTMLVideoElement) {
            const target = Math.max(0, (t - clip.start) * resolved.playbackRate + clip.trimStart);
            if (Math.abs(source.currentTime - target) > 0.35) source.currentTime = target;
            source.playbackRate = Math.max(0.25, Math.min(4, resolved.playbackRate));
            source.play().catch(() => undefined);
          }
          drawClip(ctx, clip, source as CanvasImageSource | null, canvas, scale, t);
        }
      }

      for (const { clip, element, gain } of audioPrepared) {
        if (!(element instanceof HTMLAudioElement) || !gain) continue;
        const active = t >= clip.start && t < clip.start + clip.duration;
        if (active) {
          const resolved = resolveClipFrame(clip, t);
          const target = Math.max(0, (t - clip.start) * resolved.playbackRate + clip.trimStart);
          if (Math.abs(element.currentTime - target) > 0.4) element.currentTime = target;
          element.playbackRate = Math.max(0.25, Math.min(4, resolved.playbackRate));
          gain.gain.setTargetAtTime(clip.muted ? 0 : Math.max(0, Math.min(1, resolved.volume)), audioContext.currentTime, 0.025);
          element.play().catch(() => undefined);
        } else {
          gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.02);
          element.pause();
        }
      }

      onProgress?.(Math.min(1, t / duration));
      if (t >= duration) { resolve(); return; }
      requestAnimationFrame(frameLoop);
    };
    requestAnimationFrame(frameLoop);
  });

  recorder.stop();
  visuals.forEach(({ element }) => element instanceof HTMLVideoElement && element.pause());
  audioPrepared.forEach(({ element }) => element instanceof HTMLAudioElement && element.pause());
  await stopped;
  await audioContext.close();
  return new Blob(chunks, { type: preferred });
}

export async function exportWebM(project: MediaStudioProject, onProgress?: (value: number) => void) {
  const blob = await renderWebMBlob(project, onProgress);
  downloadMediaBlob(blob, `${safeName(project.name)}.webm`);
  return blob;
}

export async function exportBrowserMp4(project: MediaStudioProject, onProgress?: (value: number) => void) {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
  ];
  if (typeof MediaRecorder === "undefined" || !candidates.some((mime) => MediaRecorder.isTypeSupported(mime))) return null;
  const blob = await renderWebMBlob(project, onProgress, candidates);
  downloadMediaBlob(blob, `${safeName(project.name)}.mp4`);
  return blob;
}
