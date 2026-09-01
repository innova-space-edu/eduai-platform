import type { MediaKind } from "./types";

export type EditableMediaKind = Exclude<MediaKind, "music">;
export type MediaCompatibility = "native" | "compatible" | "conversion-required" | "unsupported";

export type MediaInspection = {
  kind: EditableMediaKind | "unknown";
  extension: string;
  mime: string;
  playable: boolean;
  duration: number;
  compatibility: MediaCompatibility;
  normalizedMime: boolean;
  message: string;
};

type FormatDefinition = {
  kind: EditableMediaKind;
  mime: string;
  native?: boolean;
};

const FORMATS: Record<string, FormatDefinition> = {
  mp4: { kind: "video", mime: "video/mp4", native: true },
  webm: { kind: "video", mime: "video/webm", native: true },
  mov: { kind: "video", mime: "video/quicktime" },
  m4v: { kind: "video", mime: "video/x-m4v" },
  mkv: { kind: "video", mime: "video/x-matroska" },
  avi: { kind: "video", mime: "video/x-msvideo" },
  mpg: { kind: "video", mime: "video/mpeg" },
  mpeg: { kind: "video", mime: "video/mpeg" },
  ogv: { kind: "video", mime: "video/ogg" },
  "3gp": { kind: "video", mime: "video/3gpp" },
  "3g2": { kind: "video", mime: "video/3gpp2" },
  mp3: { kind: "audio", mime: "audio/mpeg", native: true },
  wav: { kind: "audio", mime: "audio/wav", native: true },
  m4a: { kind: "audio", mime: "audio/mp4", native: true },
  aac: { kind: "audio", mime: "audio/aac" },
  ogg: { kind: "audio", mime: "audio/ogg", native: true },
  oga: { kind: "audio", mime: "audio/ogg" },
  opus: { kind: "audio", mime: "audio/ogg;codecs=opus", native: true },
  flac: { kind: "audio", mime: "audio/flac" },
  weba: { kind: "audio", mime: "audio/webm", native: true },
  aiff: { kind: "audio", mime: "audio/aiff" },
  aif: { kind: "audio", mime: "audio/aiff" },
  png: { kind: "image", mime: "image/png", native: true },
  jpg: { kind: "image", mime: "image/jpeg", native: true },
  jpeg: { kind: "image", mime: "image/jpeg", native: true },
  webp: { kind: "image", mime: "image/webp", native: true },
  gif: { kind: "image", mime: "image/gif", native: true },
  avif: { kind: "image", mime: "image/avif", native: true },
  bmp: { kind: "image", mime: "image/bmp" },
  svg: { kind: "image", mime: "image/svg+xml", native: true },
};

export const MEDIA_ACCEPT = [
  "video/*",
  "audio/*",
  "image/*",
  ...Object.keys(FORMATS).map((extension) => `.${extension}`),
].join(",");

export function mediaExtension(name: string) {
  const clean = name.split(/[?#]/)[0];
  const index = clean.lastIndexOf(".");
  return index >= 0 ? clean.slice(index + 1).toLowerCase() : "";
}

function kindFromMime(mime: string): EditableMediaKind | "unknown" {
  const value = mime.toLowerCase();
  if (value.startsWith("video/")) return "video";
  if (value.startsWith("audio/")) return "audio";
  if (value.startsWith("image/")) return "image";
  return "unknown";
}

export function inferMediaFile(file: Pick<File, "name" | "type">) {
  const extension = mediaExtension(file.name);
  const definition = FORMATS[extension];
  const mimeKind = kindFromMime(file.type || "");
  const kind: EditableMediaKind | "unknown" = definition ? definition.kind : mimeKind;
  const mime = definition?.mime || file.type || "application/octet-stream";
  return { extension, kind, mime, native: Boolean(definition?.native) };
}

export function normalizeMediaFile(file: File, inspection?: Pick<MediaInspection, "mime">) {
  const inferred = inferMediaFile(file);
  const targetMime = inspection?.mime || inferred.mime;
  const current = (file.type || "").toLowerCase();
  const shouldNormalize = Boolean(targetMime) && targetMime !== "application/octet-stream" && current !== targetMime.toLowerCase();
  if (!shouldNormalize) return file;
  return new File([file], file.name, { type: targetMime, lastModified: file.lastModified });
}

function cleanupMedia(element: HTMLMediaElement) {
  element.pause();
  element.removeAttribute("src");
  element.load();
}

async function inspectPlayableMedia(file: File, kind: "video" | "audio", mime: string) {
  const normalized = normalizeMediaFile(file, { mime });
  const url = URL.createObjectURL(normalized);
  const element = document.createElement(kind);
  element.preload = "metadata";
  const declaredSupport = mime && mime !== "application/octet-stream" ? element.canPlayType(mime) : "";

  try {
    const result = await new Promise<{ playable: boolean; duration: number }>((resolve) => {
      let settled = false;
      const finish = (playable: boolean) => {
        if (settled) return;
        settled = true;
        const duration = playable && Number.isFinite(element.duration) ? Math.max(0.05, element.duration) : 0;
        resolve({ playable, duration });
      };
      const timer = window.setTimeout(() => finish(false), 8000);
      element.onloadedmetadata = () => {
        window.clearTimeout(timer);
        finish(true);
      };
      element.onerror = () => {
        window.clearTimeout(timer);
        finish(false);
      };
      element.src = url;
      element.load();
    });
    return { ...result, declaredSupport };
  } finally {
    cleanupMedia(element);
    URL.revokeObjectURL(url);
  }
}

async function inspectImage(file: File, mime: string) {
  const normalized = normalizeMediaFile(file, { mime });
  const url = URL.createObjectURL(normalized);
  try {
    const playable = await new Promise<boolean>((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timer = window.setTimeout(() => finish(false), 8000);
      image.onload = () => {
        window.clearTimeout(timer);
        finish(true);
      };
      image.onerror = () => {
        window.clearTimeout(timer);
        finish(false);
      };
      image.src = url;
    });
    return playable;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function inspectMediaFile(file: File): Promise<MediaInspection> {
  const inferred = inferMediaFile(file);
  if (inferred.kind === "unknown") {
    return {
      kind: "unknown",
      extension: inferred.extension,
      mime: inferred.mime,
      playable: false,
      duration: 0,
      compatibility: "unsupported",
      normalizedMime: false,
      message: "El archivo no coincide con un formato de video, audio o imagen reconocido.",
    };
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      kind: inferred.kind,
      extension: inferred.extension,
      mime: inferred.mime,
      playable: false,
      duration: inferred.kind === "image" ? 5 : 0,
      compatibility: "unsupported",
      normalizedMime: false,
      message: "La compatibilidad multimedia debe comprobarse en el navegador.",
    };
  }

  const normalizedMime = Boolean(file.type && file.type.toLowerCase() !== inferred.mime.toLowerCase()) || !file.type;

  if (inferred.kind === "image") {
    const playable = await inspectImage(file, inferred.mime);
    return {
      kind: "image",
      extension: inferred.extension,
      mime: inferred.mime,
      playable,
      duration: 5,
      compatibility: playable ? (inferred.native ? "native" : "compatible") : "conversion-required",
      normalizedMime,
      message: playable
        ? normalizedMime ? "Formato reconocido y MIME normalizado automáticamente." : "Imagen compatible con el navegador."
        : "La imagen necesita conversión a PNG, JPEG, WebP o AVIF.",
    };
  }

  const result = await inspectPlayableMedia(file, inferred.kind, inferred.mime);
  const compatibility: MediaCompatibility = result.playable
    ? inferred.native && result.declaredSupport !== "" ? "native" : "compatible"
    : "conversion-required";

  return {
    kind: inferred.kind,
    extension: inferred.extension,
    mime: inferred.mime,
    playable: result.playable,
    duration: result.duration,
    compatibility,
    normalizedMime,
    message: result.playable
      ? normalizedMime
        ? "Formato reconocido por extensión; MIME normalizado automáticamente."
        : compatibility === "native"
          ? "Formato compatible de forma nativa."
          : "El navegador puede decodificar este formato y EDUAI lo usará directamente."
      : `El navegador no puede decodificar este ${inferred.kind === "video" ? "video" : "audio"}. Convierte el archivo a ${inferred.kind === "video" ? "MP4/WebM" : "WAV/MP3/M4A"} antes de editarlo.`,
  };
}

export function supportedMediaSummary() {
  return "Video: MP4, WebM, MOV, M4V, MKV, AVI, MPEG/MPG, OGV, 3GP · Audio: MP3, WAV, M4A, AAC, OGG, OPUS, FLAC, WebA, AIFF";
}
