export type MediaAssetType = "video" | "audio" | "image" | "music" | "sfx" | "text";
export type TrackKind = "video" | "audio" | "overlay" | "text";
export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export type MediaAsset = {
  id: string;
  type: MediaAssetType;
  name: string;
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  source: "upload" | "eduai" | "pexels" | "pixabay" | "freesound" | "jamendo" | "generated";
  provider?: string;
  license?: string;
  attribution?: string;
  externalUrl?: string;
};

export type ClipTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
};

export type ClipStyle = {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  borderRadius: number;
};

export type TimelineClip = {
  id: string;
  assetId?: string;
  trackId: string;
  type: MediaAssetType;
  name: string;
  sourceUrl?: string;
  start: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  transform: ClipTransform;
  style: ClipStyle;
  text?: string;
  textColor?: string;
  fontSize?: number;
  backgroundColor?: string;
};

export type TimelineTrack = {
  id: string;
  name: string;
  kind: TrackKind;
  locked: boolean;
  hidden: boolean;
  muted: boolean;
  clips: TimelineClip[];
};

export type MediaStudioProject = {
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  fps: number;
  duration: number;
  tracks: TimelineTrack[];
  createdAt: string;
  updatedAt: string;
};

export type MediaAICommand = {
  action:
    | "add_text"
    | "set_volume"
    | "mute_clip"
    | "change_speed"
    | "move_clip"
    | "resize_clip"
    | "delete_clip"
    | "split_clip"
    | "set_aspect_ratio"
    | "suggest_media";
  clipId?: string;
  value?: number | string | boolean;
  at?: number;
  text?: string;
  query?: string;
};

export type MediaAIPlan = {
  summary: string;
  commands: MediaAICommand[];
};
