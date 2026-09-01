import type { MediaAsset, MultimediaProject, TimelineClip } from "./types";
import { audioFadeFactor, interpolateClip, projectDuration, transitionFactor } from "./types";

export type ExportFormat = "mp4" | "webm";

type ExportOptions = {
  format?: ExportFormat;
  onProgress?: (value: number) => void;
};

type ClipMedia = {
  clip: TimelineClip;
  asset: MediaAsset;
  element: HTMLAudioElement | HTMLVideoElement;
  gain?: GainNode;
};

export function supportedVideoFormats() {
  if (typeof window === "undefined" || !window.MediaRecorder) return { mp4: false, webm: false };
  return {
    mp4: ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"].some((mime) => MediaRecorder.isTypeSupported(mime)),
    webm: ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].some((mime) => MediaRecorder.isTypeSupported(mime)),
  };
}

function recorderMime(format: ExportFormat) {
  const mp4 = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"];
  const webm = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const candidates = format === "mp4" ? [...mp4, ...webm] : webm;
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "video/webm";
}

function seek(element: HTMLMediaElement, time: number) {
  const max = Number.isFinite(element.duration) ? Math.max(0, element.duration - 0.03) : time;
  const safe = Math.max(0, Math.min(time, max));
  if (Math.abs(element.currentTime - safe) > 0.12) element.currentTime = safe;
}

function waitForMedia(element: HTMLMediaElement) {
  if (element.readyState >= 1) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("No se pudo cargar un recurso multimedia para exportar.")); };
    const cleanup = () => {
      element.removeEventListener("loadedmetadata", done);
      element.removeEventListener("error", fail);
    };
    element.addEventListener("loadedmetadata", done, { once: true });
    element.addEventListener("error", fail, { once: true });
  });
}

function waitForImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("No se pudo cargar una imagen para exportar."));
  });
}

function active(clip: TimelineClip, time: number) {
  return time >= clip.start && time < clip.start + clip.duration;
}

function filterCss(clip: TimelineClip) {
  const filter = clip.filter;
  return [
    `brightness(${filter.brightness})`,
    `contrast(${filter.contrast})`,
    `saturate(${filter.saturation})`,
    `blur(${filter.blur}px)`,
    `grayscale(${filter.grayscale})`,
    `sepia(${filter.sepia})`,
  ].join(" ");
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  clip: TimelineClip,
  localTime: number,
) {
  if (!sourceWidth || !sourceHeight) return;
  const animated = interpolateClip(clip, localTime);
  const transition = transitionFactor(clip, localTime);
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const slideX = transition.slide * width;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, animated.opacity * transition.opacity));
  ctx.filter = filterCss(clip);
  ctx.translate(width / 2 + animated.transform.x + slideX, height / 2 + animated.transform.y);
  ctx.rotate((animated.transform.rotation * Math.PI) / 180);
  ctx.scale(animated.transform.scale, animated.transform.scale);
  ctx.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const output: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { output.push(""); continue; }
    let line = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`;
      if (ctx.measureText(candidate).width > maxWidth) {
        output.push(line);
        line = word;
      } else line = candidate;
    }
    output.push(line);
  }
  return output;
}

function drawText(ctx: CanvasRenderingContext2D, clip: TimelineClip, width: number, height: number, localTime: number) {
  const style = clip.textStyle;
  if (!style) return;
  const animated = interpolateClip(clip, localTime);
  const transition = transitionFactor(clip, localTime);
  const slideX = transition.slide * width;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, animated.opacity * transition.opacity));
  ctx.translate(width / 2 + animated.transform.x + slideX, height / 2 + animated.transform.y);
  ctx.rotate((animated.transform.rotation * Math.PI) / 180);
  ctx.scale(animated.transform.scale, animated.transform.scale);
  ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
  ctx.textAlign = style.align;
  ctx.textBaseline = "middle";
  const maxWidth = width * 0.82;
  const lines = wrapLines(ctx, style.text || "Texto", maxWidth);
  const lineHeight = style.fontSize * 1.16;
  const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
  const boxWidth = Math.min(maxWidth, Math.max(...lines.map((line) => ctx.measureText(line).width), 40) + style.fontSize * 0.7);
  if (style.backgroundColor && style.backgroundColor !== "transparent" && !/rgba\([^)]*,\s*0\s*\)/.test(style.backgroundColor)) {
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(-boxWidth / 2, -totalHeight / 2 - 8, boxWidth, totalHeight + 16);
  }
  const alignX = style.align === "left" ? -boxWidth / 2 + 12 : style.align === "right" ? boxWidth / 2 - 12 : 0;
  lines.forEach((line, index) => {
    const y = (index - (lines.length - 1) / 2) * lineHeight;
    if (style.strokeWidth > 0) {
      ctx.lineWidth = style.strokeWidth * 2;
      ctx.strokeStyle = style.strokeColor;
      ctx.strokeText(line, alignX, y, maxWidth);
    }
    ctx.fillStyle = style.color;
    ctx.fillText(line, alignX, y, maxWidth);
  });
  ctx.restore();
}

export async function exportProjectVideo(project: MultimediaProject, assets: MediaAsset[], options: ExportOptions = {}) {
  if (typeof window === "undefined") throw new Error("La exportación necesita un navegador.");
  if (!window.MediaRecorder) throw new Error("Este navegador no admite exportación de video con MediaRecorder.");
  const duration = projectDuration(project);
  const canvas = document.createElement("canvas");
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el lienzo de exportación.");

  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const clips = project.tracks.flatMap((track) => track.clips);
  const mediaEntries: ClipMedia[] = [];
  const images = new Map<string, HTMLImageElement>();
  const audioContext = new AudioContext();
  const audioDestination = audioContext.createMediaStreamDestination();
  const warnings: string[] = [];

  for (const clip of clips) {
    if (clip.clipType !== "media" || !clip.assetId) continue;
    const asset = assetMap.get(clip.assetId);
    if (!asset?.url || asset.exportable === false) continue;
    if (asset.kind === "image") {
      if (!images.has(asset.id)) {
        const image = new Image();
        if (/^https?:/i.test(asset.url)) image.crossOrigin = "anonymous";
        image.src = asset.url;
        try { await waitForImage(image); images.set(asset.id, image); }
        catch { warnings.push(`No se pudo exportar la imagen ${asset.name}.`); }
      }
      continue;
    }
    const element = asset.kind === "video" ? document.createElement("video") : document.createElement("audio");
    if (/^https?:/i.test(asset.url)) element.crossOrigin = "anonymous";
    element.preload = "auto";
    element.src = asset.url;
    if (element instanceof HTMLVideoElement) element.playsInline = true;
    try { await waitForMedia(element); }
    catch { warnings.push(`No se pudo exportar ${asset.name}.`); continue; }

    let gain: GainNode | undefined;
    try {
      const source = audioContext.createMediaElementSource(element);
      gain = audioContext.createGain();
      source.connect(gain);
      gain.connect(audioDestination);
    } catch {
      warnings.push(`El audio de ${asset.name} no admite mezcla por CORS.`);
    }
    mediaEntries.push({ clip, asset, element, gain });
  }

  const videoStream = canvas.captureStream(project.fps || 30);
  const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()]);
  const requested = options.format || "mp4";
  const mimeType = recorderMime(requested);
  const actualFormat: ExportFormat = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
  const chunks: BlobPart[] = [];
  let recorder: MediaRecorder;
  try { recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 8_000_000 }); }
  catch { recorder = new MediaRecorder(combined); }
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Falló la grabación del video."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
  });

  await audioContext.resume();
  recorder.start(1000);
  const startedAt = performance.now();

  await new Promise<void>((resolve) => {
    const frame = () => {
      const elapsed = Math.min(duration, (performance.now() - startedAt) / 1000);
      options.onProgress?.(duration ? elapsed / duration : 1);
      ctx.fillStyle = "#050816";
      ctx.fillRect(0, 0, project.width, project.height);

      for (const track of project.tracks.filter((item) => item.kind === "video" || item.kind === "overlay")) {
        for (const clip of track.clips.filter((item) => active(item, elapsed))) {
          if (clip.clipType !== "media" || !clip.assetId) continue;
          const asset = assetMap.get(clip.assetId);
          if (!asset) continue;
          const local = elapsed - clip.start;
          try {
            if (asset.kind === "image") {
              const image = images.get(asset.id);
              if (image) drawCover(ctx, image, image.naturalWidth, image.naturalHeight, project.width, project.height, clip, local);
            } else if (asset.kind === "video") {
              const media = mediaEntries.find((entry) => entry.clip.id === clip.id && entry.element instanceof HTMLVideoElement);
              if (media) {
                const video = media.element as HTMLVideoElement;
                seek(video, clip.offset + local);
                if (video.paused) void video.play().catch(() => undefined);
                if (video.readyState >= 2) drawCover(ctx, video, video.videoWidth, video.videoHeight, project.width, project.height, clip, local);
              }
            }
          } catch {
            if (!warnings.includes(`No se pudo dibujar ${asset.name} por restricciones CORS.`)) warnings.push(`No se pudo dibujar ${asset.name} por restricciones CORS.`);
          }
        }
      }

      for (const track of project.tracks.filter((item) => item.kind === "text")) {
        for (const clip of track.clips.filter((item) => active(item, elapsed))) drawText(ctx, clip, project.width, project.height, elapsed - clip.start);
      }

      for (const entry of mediaEntries) {
        const isActive = active(entry.clip, elapsed);
        const local = elapsed - entry.clip.start;
        const animated = interpolateClip(entry.clip, Math.max(0, local));
        const transition = transitionFactor(entry.clip, Math.max(0, local));
        if (entry.gain) entry.gain.gain.value = isActive && !entry.clip.muted ? Math.max(0, animated.volume * transition.opacity * audioFadeFactor(entry.clip, Math.max(0, local))) : 0;
        if (isActive) {
          seek(entry.element, entry.clip.offset + local);
          if (entry.element.paused) void entry.element.play().catch(() => undefined);
        } else if (!entry.element.paused) entry.element.pause();
      }

      if (elapsed >= duration) { resolve(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  recorder.stop();
  const blob = await finished;
  mediaEntries.forEach((entry) => entry.element.pause());
  videoStream.getTracks().forEach((track) => track.stop());
  audioDestination.stream.getTracks().forEach((track) => track.stop());
  await audioContext.close();
  options.onProgress?.(1);
  return { blob, format: actualFormat, mimeType: blob.type || mimeType, warnings };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
