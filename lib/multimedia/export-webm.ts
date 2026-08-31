import type { MediaAsset, MultimediaProject, TimelineClip } from "./types";
import { projectDuration } from "./types";

type ExportOptions = {
  onProgress?: (value: number) => void;
};

type ClipMedia = {
  clip: TimelineClip;
  asset: MediaAsset;
  element: HTMLAudioElement | HTMLVideoElement;
  gain?: GainNode;
};

function recorderMime() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "video/webm";
}

function seek(element: HTMLMediaElement, time: number) {
  const safe = Math.max(0, Math.min(time, Number.isFinite(element.duration) ? Math.max(0, element.duration - 0.03) : time));
  if (Math.abs(element.currentTime - safe) > 0.12) element.currentTime = safe;
}

function waitForMedia(element: HTMLMediaElement) {
  if (element.readyState >= 1) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("No se pudo cargar un recurso multimedia para exportar."));
    };
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

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  opacity = 1,
) {
  if (!sourceWidth || !sourceHeight) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(source, x, y, drawWidth, drawHeight);
  ctx.restore();
}

function active(clip: TimelineClip, time: number) {
  return time >= clip.start && time < clip.start + clip.duration;
}

export async function exportProjectWebM(
  project: MultimediaProject,
  assets: MediaAsset[],
  options: ExportOptions = {},
) {
  if (typeof window === "undefined") throw new Error("La exportación necesita un navegador.");
  if (!window.MediaRecorder) throw new Error("Este navegador no admite MediaRecorder/WebM.");

  const duration = projectDuration(project);
  const canvas = document.createElement("canvas");
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el lienzo de exportación.");

  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const clips = project.tracks.flatMap((track) => track.clips);
  const exportableClips = clips
    .map((clip) => ({ clip, asset: assetMap.get(clip.assetId) }))
    .filter((entry): entry is { clip: TimelineClip; asset: MediaAsset } => Boolean(entry.asset?.url && entry.asset.exportable !== false));

  const audioContext = new AudioContext();
  const audioDestination = audioContext.createMediaStreamDestination();
  const mediaEntries: ClipMedia[] = [];
  const images = new Map<string, HTMLImageElement>();

  for (const { clip, asset } of exportableClips) {
    if (asset.kind === "image") {
      if (!images.has(asset.id)) {
        const image = new Image();
        if (/^https?:/i.test(asset.url)) image.crossOrigin = "anonymous";
        image.src = asset.url;
        await waitForImage(image);
        images.set(asset.id, image);
      }
      continue;
    }

    const element = asset.kind === "video" ? document.createElement("video") : document.createElement("audio");
    if (/^https?:/i.test(asset.url)) element.crossOrigin = "anonymous";
    element.preload = "auto";
    element.src = asset.url;
    element.playsInline = true;
    await waitForMedia(element);

    let gain: GainNode | undefined;
    try {
      const source = audioContext.createMediaElementSource(element);
      gain = audioContext.createGain();
      source.connect(gain);
      gain.connect(audioDestination);
    } catch {
      // Algunos hosts remotos no permiten CORS para mezcla. El video aún puede renderizarse.
    }
    mediaEntries.push({ clip, asset, element, gain });
  }

  const videoStream = canvas.captureStream(project.fps || 30);
  const combined = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDestination.stream.getAudioTracks(),
  ]);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(combined, { mimeType: recorderMime() });
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Falló la grabación WebM."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });

  await audioContext.resume();
  recorder.start(1000);
  const startedAt = performance.now();

  await new Promise<void>((resolve) => {
    const frame = () => {
      const elapsed = Math.min(duration, (performance.now() - startedAt) / 1000);
      options.onProgress?.(elapsed / duration);

      ctx.fillStyle = "#050816";
      ctx.fillRect(0, 0, project.width, project.height);

      const videoTrack = project.tracks.find((track) => track.kind === "video");
      const visualVideoClip = [...(videoTrack?.clips || [])].reverse().find((clip) => active(clip, elapsed));
      if (visualVideoClip) {
        const media = mediaEntries.find((entry) => entry.clip.id === visualVideoClip.id && entry.element instanceof HTMLVideoElement);
        if (media) {
          const video = media.element as HTMLVideoElement;
          seek(video, visualVideoClip.offset + elapsed - visualVideoClip.start);
          if (video.paused) void video.play().catch(() => undefined);
          if (video.readyState >= 2) {
            drawCover(ctx, video, video.videoWidth, video.videoHeight, project.width, project.height, visualVideoClip.opacity);
          }
        }
      }

      const overlayTrack = project.tracks.find((track) => track.kind === "overlay");
      for (const clip of overlayTrack?.clips || []) {
        if (!active(clip, elapsed)) continue;
        const asset = assetMap.get(clip.assetId);
        const image = asset ? images.get(asset.id) : undefined;
        if (image) drawCover(ctx, image, image.naturalWidth, image.naturalHeight, project.width, project.height, clip.opacity);
      }

      for (const entry of mediaEntries) {
        const isActive = active(entry.clip, elapsed);
        if (entry.gain) entry.gain.gain.value = isActive && !entry.clip.muted ? entry.clip.volume : 0;
        if (isActive) {
          seek(entry.element, entry.clip.offset + elapsed - entry.clip.start);
          if (entry.element.paused) void entry.element.play().catch(() => undefined);
        } else if (!entry.element.paused) {
          entry.element.pause();
        }
      }

      if (elapsed >= duration) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  recorder.stop();
  const blob = await finished;
  mediaEntries.forEach((entry) => entry.element.pause());
  videoStream.getTracks().forEach((track) => track.stop());
  await audioContext.close();
  options.onProgress?.(1);
  return blob;
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
