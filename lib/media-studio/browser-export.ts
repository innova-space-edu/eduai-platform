"use client";

import type { MediaStudioProject, TimelineClip } from "./types";

type Prepared = { clip: TimelineClip; element: HTMLImageElement | HTMLVideoElement | HTMLAudioElement; gain?: GainNode };

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
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
  video.crossOrigin = "anonymous"; video.preload = "auto"; video.playsInline = true; video.muted = true; video.src = clip.sourceUrl;
  await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error(`No se pudo cargar ${clip.name}`)); });
  return video;
}

async function loadAudio(clip: TimelineClip) {
  if (!clip.sourceUrl) return null;
  const audio = document.createElement("audio");
  audio.crossOrigin = "anonymous"; audio.preload = "auto"; audio.src = clip.sourceUrl;
  await new Promise<void>((resolve, reject) => { audio.onloadedmetadata = () => resolve(); audio.onerror = () => reject(new Error(`No se pudo cargar ${clip.name}`)); });
  return audio;
}

function drawClip(ctx: CanvasRenderingContext2D, clip: TimelineClip, source: CanvasImageSource | null, canvas: HTMLCanvasElement, scale: number) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, clip.transform.opacity));
  ctx.translate(canvas.width / 2 + clip.transform.x * scale, canvas.height / 2 + clip.transform.y * scale);
  ctx.rotate((clip.transform.rotation * Math.PI) / 180);
  ctx.scale(clip.transform.scale, clip.transform.scale);
  ctx.filter = `brightness(${clip.style.brightness}) contrast(${clip.style.contrast}) saturate(${clip.style.saturation}) blur(${clip.style.blur * scale}px)`;

  if (source) {
    const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : canvas.width;
    const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : canvas.height;
    if (sourceWidth > 0 && sourceHeight > 0) {
      const fit = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
      const width = sourceWidth * fit; const height = sourceHeight * fit;
      ctx.drawImage(source, -width / 2, -height / 2, width, height);
    }
  } else if (clip.type === "text") {
    const fontSize = Math.max(12, (clip.fontSize || 56) * scale);
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const text = clip.text || clip.name;
    const metrics = ctx.measureText(text);
    const pad = 14 * scale;
    if (clip.backgroundColor && clip.backgroundColor !== "transparent") {
      ctx.fillStyle = clip.backgroundColor;
      ctx.fillRect(-metrics.width / 2 - pad, -fontSize / 1.25, metrics.width + pad * 2, fontSize * 1.6);
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
    } catch { /* un recurso CORS no debe abortar toda la exportación */ }
  }
  return prepared;
}

export async function exportProjectJson(project: MediaStudioProject) {
  downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), `${safeName(project.name)}.eduai-media.json`);
}

function srtTime(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const s = Math.floor((ms % 60000) / 1000); const milli = ms % 1000;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(milli).padStart(3,"0")}`;
}

export async function exportSrt(project: MediaStudioProject) {
  const clips = project.tracks.flatMap((track) => track.clips).filter((clip) => clip.type === "text" && (clip.text || "").trim()).sort((a, b) => a.start - b.start);
  const body = clips.map((clip, index) => `${index + 1}\n${srtTime(clip.start)} --> ${srtTime(clip.start + clip.duration)}\n${clip.text}\n`).join("\n");
  downloadBlob(new Blob([body || ""], { type: "text/plain;charset=utf-8" }), `${safeName(project.name)}.srt`);
}

export async function exportFramePng(project: MediaStudioProject, playhead: number) {
  const { width, height, scale } = canvasSize(project);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height);
  const visuals = await prepareVisuals(project);
  const byId = new Map(visuals.map((item) => [item.clip.id, item.element]));
  const clips = project.tracks.flatMap((track) => track.hidden ? [] : track.clips).filter((clip) => ["image","video","text"].includes(clip.type) && playhead >= clip.start && playhead < clip.start + clip.duration);
  for (const clip of clips) {
    const source = byId.get(clip.id) || null;
    if (source instanceof HTMLVideoElement) {
      source.currentTime = Math.max(0, (playhead - clip.start) * clip.playbackRate + clip.trimStart);
      await new Promise<void>((resolve) => { const done = () => resolve(); source.onseeked = done; window.setTimeout(done, 600); });
    }
    drawClip(ctx, clip, source as CanvasImageSource | null, canvas, scale);
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("No se pudo crear PNG")), "image/png"));
  downloadBlob(blob, `${safeName(project.name)}-${Math.round(playhead * 10) / 10}s.png`);
}

export async function exportWebM(project: MediaStudioProject, onProgress?: (value: number) => void) {
  if (typeof MediaRecorder === "undefined") throw new Error("Este navegador no soporta exportación WebM");
  const { width, height, scale } = canvasSize(project);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas no disponible");
  const visuals = await prepareVisuals(project);
  const visualMap = new Map(visuals.map((item) => [item.clip.id, item.element]));

  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  const audioPrepared: Prepared[] = [];
  const audioClips = project.tracks.flatMap((track) => track.muted ? [] : track.clips).filter((clip) => ["audio","music","sfx"].includes(clip.type));
  for (const clip of audioClips) {
    try {
      const audio = await loadAudio(clip); if (!audio) continue;
      const source = audioContext.createMediaElementSource(audio); const gain = audioContext.createGain();
      gain.gain.value = clip.muted ? 0 : Math.max(0, Math.min(1, clip.volume)); source.connect(gain).connect(destination);
      audioPrepared.push({ clip, element: audio, gain });
    } catch { /* continúa sin esa pista */ }
  }

  const canvasStream = canvas.captureStream(project.fps || 30);
  const combined = new MediaStream([...canvasStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
  const preferred = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((mime) => MediaRecorder.isTypeSupported(mime)) || "video/webm";
  const recorder = new MediaRecorder(combined, { mimeType: preferred, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const stopped = new Promise<void>((resolve, reject) => { recorder.onstop = () => resolve(); recorder.onerror = () => reject(new Error("Falló MediaRecorder")); });

  await audioContext.resume(); recorder.start(1000);
  const start = performance.now();
  const duration = Math.max(0.1, project.duration);

  await new Promise<void>((resolve) => {
    const frame = () => {
      const t = Math.min(duration, (performance.now() - start) / 1000);
      ctx.filter = "none"; ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height);
      for (const track of project.tracks) {
        if (track.hidden) continue;
        for (const clip of track.clips) {
          const active = t >= clip.start && t < clip.start + clip.duration;
          if (!["image","video","text"].includes(clip.type) || !active) continue;
          const source = visualMap.get(clip.id) || null;
          if (source instanceof HTMLVideoElement) {
            const target = Math.max(0, (t - clip.start) * clip.playbackRate + clip.trimStart);
            if (Math.abs(source.currentTime - target) > 0.35) source.currentTime = target;
            source.playbackRate = clip.playbackRate; source.play().catch(() => undefined);
          }
          drawClip(ctx, clip, source as CanvasImageSource | null, canvas, scale);
        }
      }
      for (const { clip, element } of audioPrepared) {
        if (!(element instanceof HTMLAudioElement)) continue;
        const active = t >= clip.start && t < clip.start + clip.duration;
        if (active) {
          const target = Math.max(0, (t - clip.start) * clip.playbackRate + clip.trimStart);
          if (Math.abs(element.currentTime - target) > 0.4) element.currentTime = target;
          element.playbackRate = clip.playbackRate; element.play().catch(() => undefined);
        } else element.pause();
      }
      onProgress?.(Math.min(1, t / duration));
      if (t >= duration) { resolve(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  recorder.stop();
  visuals.forEach(({ element }) => element instanceof HTMLVideoElement && element.pause());
  audioPrepared.forEach(({ element }) => element instanceof HTMLAudioElement && element.pause());
  await stopped; await audioContext.close();
  const blob = new Blob(chunks, { type: preferred });
  downloadBlob(blob, `${safeName(project.name)}.webm`);
}
