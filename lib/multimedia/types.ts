export type MediaKind = "video" | "audio" | "image" | "music";
export type TrackKind = "video" | "overlay" | "audio" | "music";

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
};

export type TimelineClip = {
  id: string;
  assetId: string;
  trackId: string;
  start: number;
  duration: number;
  offset: number;
  volume: number;
  opacity: number;
  muted: boolean;
};

export type TimelineTrack = {
  id: string;
  name: string;
  kind: TrackKind;
  clips: TimelineClip[];
};

export type MultimediaProject = {
  version: 1;
  id: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  createdAt: string;
  updatedAt: string;
  tracks: TimelineTrack[];
};

export const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: "video-main", name: "Video principal", kind: "video", clips: [] },
  { id: "overlay-main", name: "Imágenes / overlay", kind: "overlay", clips: [] },
  { id: "audio-main", name: "Audio", kind: "audio", clips: [] },
  { id: "music-main", name: "Música", kind: "music", clips: [] },
];

export function makeProject(): MultimediaProject {
  const now = new Date().toISOString();
  return {
    version: 1,
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
