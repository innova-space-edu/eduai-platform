export type MediaKind = "video" | "audio" | "image" | "music";
export type TrackKind = "video" | "overlay" | "text" | "audio" | "music";
export type TransitionKind = "none" | "fade" | "slide-left" | "slide-right";

export type MediaAsset = {
  id: string;
  name: string;
  kind: MediaKind;
  url: string;
  duration: number;
  source?: string;
  artworkUrl?: string;
  externalUrl?: string;
  exportable?: boolean;
  local?: boolean;
  missing?: boolean;
};

export type VisualFilter = {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
};

export type ClipTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type TextStyle = {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  align: "left" | "center" | "right";
  strokeColor: string;
  strokeWidth: number;
};

export type ClipKeyframe = {
  id: string;
  time: number;
  opacity: number;
  volume: number;
  transform: ClipTransform;
};

export type TimelineClip = {
  id: string;
  assetId?: string;
  clipType: "media" | "text";
  trackId: string;
  start: number;
  duration: number;
  offset: number;
  volume: number;
  opacity: number;
  muted: boolean;
  audioFadeIn: number;
  audioFadeOut: number;
  transform: ClipTransform;
  filter: VisualFilter;
  transitionIn: TransitionKind;
  transitionOut: TransitionKind;
  transitionDuration: number;
  textStyle?: TextStyle;
  keyframes: ClipKeyframe[];
};

export type TimelineTrack = {
  id: string;
  name: string;
  kind: TrackKind;
  clips: TimelineClip[];
};

export type MultimediaProject = {
  version: 2;
  id: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  createdAt: string;
  updatedAt: string;
  tracks: TimelineTrack[];
};

export const DEFAULT_FILTER: VisualFilter = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  blur: 0,
  grayscale: 0,
  sepia: 0,
};

export const DEFAULT_TRANSFORM: ClipTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  text: "Texto",
  fontSize: 64,
  fontFamily: "Arial",
  fontWeight: 700,
  color: "#ffffff",
  backgroundColor: "rgba(0,0,0,0)",
  align: "center",
  strokeColor: "#000000",
  strokeWidth: 0,
};

export const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: "video-main", name: "Video principal", kind: "video", clips: [] },
  { id: "overlay-main", name: "Imágenes / overlay", kind: "overlay", clips: [] },
  { id: "text-main", name: "Texto / subtítulos", kind: "text", clips: [] },
  { id: "audio-main", name: "Audio 1", kind: "audio", clips: [] },
  { id: "music-main", name: "Música 1", kind: "music", clips: [] },
];

export function makeProject(): MultimediaProject {
  const now = new Date().toISOString();
  return {
    version: 2,
    id: `media-${Date.now().toString(36)}`,
    title: "Proyecto multimedia",
    width: 1280,
    height: 720,
    fps: 30,
    createdAt: now,
    updatedAt: now,
    tracks: DEFAULT_TRACKS.map((track) => ({ ...track, clips: [] })),
  };
}

export function createMediaClip(asset: MediaAsset, trackId: string, start: number): TimelineClip {
  return {
    id: `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    assetId: asset.id,
    clipType: "media",
    trackId,
    start,
    duration: asset.kind === "image" ? 5 : Math.max(0.5, asset.duration || 10),
    offset: 0,
    volume: 1,
    opacity: 1,
    muted: false,
    audioFadeIn: 0,
    audioFadeOut: 0,
    transform: { ...DEFAULT_TRANSFORM },
    filter: { ...DEFAULT_FILTER },
    transitionIn: "none",
    transitionOut: "none",
    transitionDuration: 0.5,
    keyframes: [],
  };
}

export function createTextClip(start: number, text = "Texto"): TimelineClip {
  return {
    id: `text-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    clipType: "text",
    trackId: "text-main",
    start,
    duration: 4,
    offset: 0,
    volume: 0,
    opacity: 1,
    muted: true,
    audioFadeIn: 0,
    audioFadeOut: 0,
    transform: { ...DEFAULT_TRANSFORM },
    filter: { ...DEFAULT_FILTER },
    transitionIn: "fade",
    transitionOut: "fade",
    transitionDuration: 0.25,
    textStyle: { ...DEFAULT_TEXT_STYLE, text },
    keyframes: [],
  };
}

export function projectDuration(project: MultimediaProject) {
  return Math.max(
    10,
    ...project.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)),
  );
}

export function parseClock(value?: string) {
  if (!value) return 30;
  const parts = value.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 30;
  if (parts.length === 1) return Math.max(1, parts[0]);
  return Math.max(1, parts.slice(-2).reduce((acc, part, index) => acc + part * (index === 0 ? 60 : 1), 0));
}

function normalizeClip(clip: any): TimelineClip {
  const duration = Math.max(0.05, Number(clip?.duration || 0.05));
  return {
    ...clip,
    clipType: clip?.clipType || "media",
    start: Math.max(0, Number(clip?.start || 0)),
    duration,
    offset: Math.max(0, Number(clip?.offset || 0)),
    volume: Number.isFinite(clip?.volume) ? clip.volume : 1,
    opacity: Number.isFinite(clip?.opacity) ? clip.opacity : 1,
    muted: Boolean(clip?.muted),
    audioFadeIn: Math.max(0, Math.min(duration / 2, Number(clip?.audioFadeIn || 0))),
    audioFadeOut: Math.max(0, Math.min(duration / 2, Number(clip?.audioFadeOut || 0))),
    transform: { ...DEFAULT_TRANSFORM, ...(clip?.transform || {}) },
    filter: { ...DEFAULT_FILTER, ...(clip?.filter || {}) },
    transitionIn: clip?.transitionIn || "none",
    transitionOut: clip?.transitionOut || "none",
    transitionDuration: Number.isFinite(clip?.transitionDuration) ? clip.transitionDuration : 0.5,
    keyframes: Array.isArray(clip?.keyframes) ? clip.keyframes : [],
    textStyle: clip?.clipType === "text" ? { ...DEFAULT_TEXT_STYLE, ...(clip?.textStyle || {}) } : clip?.textStyle,
  } as TimelineClip;
}

export function normalizeProject(input: any): MultimediaProject {
  const base = makeProject();
  if (!input || typeof input !== "object") return base;
  const project = input.project || input;
  const incomingTracks = Array.isArray(project.tracks) ? project.tracks : [];

  const defaultIds = new Set(DEFAULT_TRACKS.map((track) => track.id));
  const normalizedDefaults = DEFAULT_TRACKS.map((track) => {
    const found = incomingTracks.find((item: TimelineTrack) => item?.id === track.id);
    return {
      ...track,
      name: found?.name || track.name,
      clips: Array.isArray(found?.clips) ? found.clips.map(normalizeClip) : [],
    };
  });

  const extraTracks: TimelineTrack[] = incomingTracks
    .filter((track: TimelineTrack) => track?.id && !defaultIds.has(track.id))
    .map((track: TimelineTrack) => ({
      id: String(track.id),
      name: String(track.name || track.kind || "Pista"),
      kind: track.kind,
      clips: Array.isArray(track.clips) ? track.clips.map(normalizeClip) : [],
    }))
    .filter((track: TimelineTrack) => ["video", "overlay", "text", "audio", "music"].includes(track.kind));

  return {
    ...base,
    ...project,
    version: 2,
    tracks: [...normalizedDefaults, ...extraTracks],
  };
}

export function interpolateClip(clip: TimelineClip, localTime: number) {
  const frames = [...clip.keyframes].sort((a, b) => a.time - b.time);
  if (!frames.length) return { opacity: clip.opacity, volume: clip.volume, transform: clip.transform };
  const previous = [...frames].reverse().find((frame) => frame.time <= localTime) || frames[0];
  const next = frames.find((frame) => frame.time >= localTime) || frames[frames.length - 1];
  if (previous.id === next.id || next.time <= previous.time) {
    return { opacity: previous.opacity, volume: previous.volume, transform: previous.transform };
  }
  const amount = Math.min(1, Math.max(0, (localTime - previous.time) / (next.time - previous.time)));
  const lerp = (a: number, b: number) => a + (b - a) * amount;
  return {
    opacity: lerp(previous.opacity, next.opacity),
    volume: lerp(previous.volume, next.volume),
    transform: {
      x: lerp(previous.transform.x, next.transform.x),
      y: lerp(previous.transform.y, next.transform.y),
      scale: lerp(previous.transform.scale, next.transform.scale),
      rotation: lerp(previous.transform.rotation, next.transform.rotation),
    },
  };
}

export function transitionFactor(clip: TimelineClip, localTime: number) {
  const duration = Math.max(0.01, Math.min(clip.transitionDuration || 0.5, clip.duration / 2));
  let opacity = 1;
  let slide = 0;
  if (clip.transitionIn !== "none" && localTime < duration) {
    const t = Math.max(0, localTime / duration);
    opacity *= t;
    if (clip.transitionIn === "slide-left") slide = (1 - t) * -1;
    if (clip.transitionIn === "slide-right") slide = (1 - t);
  }
  const remain = clip.duration - localTime;
  if (clip.transitionOut !== "none" && remain < duration) {
    const t = Math.max(0, remain / duration);
    opacity *= t;
    if (clip.transitionOut === "slide-left") slide = (1 - t) * -1;
    if (clip.transitionOut === "slide-right") slide = (1 - t);
  }
  return { opacity, slide };
}

export function audioFadeFactor(clip: TimelineClip, localTime: number) {
  const time = Math.max(0, Math.min(clip.duration, localTime));
  const fadeIn = Math.max(0, Math.min(clip.duration / 2, clip.audioFadeIn || 0));
  const fadeOut = Math.max(0, Math.min(clip.duration / 2, clip.audioFadeOut || 0));
  let factor = 1;
  if (fadeIn > 0 && time < fadeIn) factor *= Math.max(0, Math.min(1, time / fadeIn));
  const remain = Math.max(0, clip.duration - time);
  if (fadeOut > 0 && remain < fadeOut) factor *= Math.max(0, Math.min(1, remain / fadeOut));
  return factor;
}
