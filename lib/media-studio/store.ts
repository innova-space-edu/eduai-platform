"use client";

import { create } from "zustand";
import type { AspectRatio, MediaAsset, MediaStudioProject, TimelineClip, TimelineTrack } from "./types";

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;

const ratioSize: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

const makeTrack = (kind: TimelineTrack["kind"], name: string): TimelineTrack => ({
  id: uid("track"),
  name,
  kind,
  locked: false,
  hidden: false,
  muted: false,
  clips: [],
});

const initialProject = (): MediaStudioProject => ({
  id: uid("project"),
  name: "Proyecto sin título",
  aspectRatio: "16:9",
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 30,
  tracks: [
    makeTrack("overlay", "Video 2"),
    makeTrack("video", "Video 1"),
    makeTrack("text", "Texto"),
    makeTrack("audio", "Audio"),
  ],
  createdAt: now(),
  updatedAt: now(),
});

type Snapshot = { project: MediaStudioProject; selectedClipId: string | null };

type MediaStudioState = {
  project: MediaStudioProject;
  assets: MediaAsset[];
  selectedClipId: string | null;
  playhead: number;
  playing: boolean;
  zoom: number;
  history: Snapshot[];
  future: Snapshot[];
  setProjectName: (name: string) => void;
  setPlayhead: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  addAsset: (asset: MediaAsset) => void;
  addClipFromAsset: (asset: MediaAsset, trackId?: string, start?: number) => void;
  addTextClip: (text?: string, start?: number) => void;
  selectClip: (clipId: string | null) => void;
  updateClip: (clipId: string, patch: Partial<TimelineClip>) => void;
  splitClip: (clipId: string, at: number) => void;
  deleteClip: (clipId: string) => void;
  moveClip: (clipId: string, trackId: string, start: number) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackHidden: (trackId: string) => void;
  addTrack: (kind: TimelineTrack["kind"]) => void;
  undo: () => void;
  redo: () => void;
  loadProject: (project: MediaStudioProject) => void;
  reset: () => void;
};

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function withHistory(state: MediaStudioState, nextProject: MediaStudioProject, selectedClipId = state.selectedClipId) {
  return {
    project: { ...nextProject, updatedAt: now() },
    history: [...state.history.slice(-49), { project: deepClone(state.project), selectedClipId: state.selectedClipId }],
    future: [],
    selectedClipId,
  };
}

function recomputeDuration(project: MediaStudioProject) {
  const end = Math.max(
    10,
    ...project.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)),
  );
  project.duration = Math.ceil(end + 2);
  return project;
}

export const useMediaStudioStore = create<MediaStudioState>((set, get) => ({
  project: initialProject(),
  assets: [],
  selectedClipId: null,
  playhead: 0,
  playing: false,
  zoom: 48,
  history: [],
  future: [],

  setProjectName: (name) => set((state) => withHistory(state, { ...state.project, name })),
  setPlayhead: (playhead) => set({ playhead: Math.max(0, Math.min(playhead, get().project.duration)) }),
  setPlaying: (playing) => set({ playing }),
  setZoom: (zoom) => set({ zoom: Math.max(20, Math.min(140, zoom)) }),
  setAspectRatio: (aspectRatio) => set((state) => {
    const size = ratioSize[aspectRatio];
    return withHistory(state, { ...state.project, aspectRatio, ...size });
  }),
  addAsset: (asset) => set((state) => ({ assets: [asset, ...state.assets.filter((a) => a.id !== asset.id)] })),

  addClipFromAsset: (asset, preferredTrackId, start) => set((state) => {
    const project = deepClone(state.project);
    const targetKind = asset.type === "audio" || asset.type === "music" || asset.type === "sfx" ? "audio" : asset.type === "image" ? "overlay" : "video";
    const track = project.tracks.find((item) => item.id === preferredTrackId) || project.tracks.find((item) => item.kind === targetKind);
    if (!track) return state;
    const clip: TimelineClip = {
      id: uid("clip"), assetId: asset.id, trackId: track.id, type: asset.type, name: asset.name,
      sourceUrl: asset.url, storagePath: asset.storagePath, mimeType: asset.mimeType, start: Math.max(0, start ?? state.playhead), duration: Math.max(1, asset.duration || (asset.type === "image" ? 5 : 8)),
      trimStart: 0, trimEnd: 0, volume: 1, muted: false, playbackRate: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      style: { brightness: 1, contrast: 1, saturation: 1, blur: 0, borderRadius: 0 },
      keyframes: [], transitionIn: { kind: "none", duration: 0 }, transitionOut: { kind: "none", duration: 0 },
    };
    track.clips.push(clip);
    recomputeDuration(project);
    return withHistory(state, project, clip.id);
  }),

  addTextClip: (text = "Texto", start) => set((state) => {
    const project = deepClone(state.project);
    const track = project.tracks.find((item) => item.kind === "text") || project.tracks[0];
    const clip: TimelineClip = {
      id: uid("clip"), trackId: track.id, type: "text", name: text.slice(0, 30), start: Math.max(0, start ?? state.playhead), duration: 5,
      trimStart: 0, trimEnd: 0, volume: 1, muted: false, playbackRate: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      style: { brightness: 1, contrast: 1, saturation: 1, blur: 0, borderRadius: 8 },
      keyframes: [], transitionIn: { kind: "none", duration: 0 }, transitionOut: { kind: "none", duration: 0 },
      text, textColor: "#ffffff", fontSize: 56, backgroundColor: "rgba(0,0,0,.35)",
    };
    track.clips.push(clip);
    recomputeDuration(project);
    return withHistory(state, project, clip.id);
  }),

  selectClip: (selectedClipId) => set({ selectedClipId }),
  updateClip: (clipId, patch) => set((state) => {
    const project = deepClone(state.project);
    for (const track of project.tracks) {
      const index = track.clips.findIndex((clip) => clip.id === clipId);
      if (index >= 0) track.clips[index] = { ...track.clips[index], ...patch };
    }
    recomputeDuration(project);
    return withHistory(state, project, clipId);
  }),
  splitClip: (clipId, at) => set((state) => {
    const project = deepClone(state.project);
    for (const track of project.tracks) {
      const index = track.clips.findIndex((clip) => clip.id === clipId);
      if (index < 0) continue;
      const clip = track.clips[index];
      const local = at - clip.start;
      if (local <= 0.2 || local >= clip.duration - 0.2) return state;

      const originalKeyframes = deepClone(clip.keyframes || []);
      const originalTransitionOut = deepClone(clip.transitionOut);
      const right: TimelineClip = {
        ...deepClone(clip),
        id: uid("clip"),
        start: at,
        duration: clip.duration - local,
        trimStart: clip.trimStart + local * clip.playbackRate,
        keyframes: originalKeyframes.filter((item) => item.time >= local).map((item) => ({ ...item, id: uid("kf"), time: item.time - local })),
        transitionIn: { kind: "none", duration: 0 },
        transitionOut: originalTransitionOut,
      };
      clip.duration = local;
      clip.keyframes = originalKeyframes.filter((item) => item.time <= local);
      clip.transitionOut = { kind: "none", duration: 0 };
      track.clips.splice(index + 1, 0, right);
      recomputeDuration(project);
      return withHistory(state, project, right.id);
    }
    return state;
  }),
  deleteClip: (clipId) => set((state) => {
    const project = deepClone(state.project);
    project.tracks.forEach((track) => { track.clips = track.clips.filter((clip) => clip.id !== clipId); });
    recomputeDuration(project);
    return withHistory(state, project, state.selectedClipId === clipId ? null : state.selectedClipId);
  }),
  moveClip: (clipId, targetTrackId, start) => set((state) => {
    const project = deepClone(state.project);
    let moving: TimelineClip | undefined;
    project.tracks.forEach((track) => {
      const index = track.clips.findIndex((clip) => clip.id === clipId);
      if (index >= 0) moving = track.clips.splice(index, 1)[0];
    });
    const target = project.tracks.find((track) => track.id === targetTrackId);
    if (!moving || !target) return state;
    moving.trackId = target.id;
    moving.start = Math.max(0, start);
    target.clips.push(moving);
    recomputeDuration(project);
    return withHistory(state, project, clipId);
  }),
  toggleTrackMute: (trackId) => set((state) => {
    const project = deepClone(state.project);
    const track = project.tracks.find((item) => item.id === trackId); if (track) track.muted = !track.muted;
    return withHistory(state, project);
  }),
  toggleTrackHidden: (trackId) => set((state) => {
    const project = deepClone(state.project);
    const track = project.tracks.find((item) => item.id === trackId); if (track) track.hidden = !track.hidden;
    return withHistory(state, project);
  }),
  addTrack: (kind) => set((state) => {
    const project = deepClone(state.project);
    project.tracks.unshift(makeTrack(kind, `${kind === "audio" ? "Audio" : kind === "text" ? "Texto" : "Video"} ${project.tracks.length + 1}`));
    return withHistory(state, project);
  }),
  undo: () => set((state) => {
    const previous = state.history[state.history.length - 1]; if (!previous) return state;
    return { project: deepClone(previous.project), selectedClipId: previous.selectedClipId, history: state.history.slice(0, -1), future: [{ project: deepClone(state.project), selectedClipId: state.selectedClipId }, ...state.future].slice(0, 50) };
  }),
  redo: () => set((state) => {
    const next = state.future[0]; if (!next) return state;
    return { project: deepClone(next.project), selectedClipId: next.selectedClipId, history: [...state.history, { project: deepClone(state.project), selectedClipId: state.selectedClipId }].slice(-50), future: state.future.slice(1) };
  }),
  loadProject: (project) => set({ project, selectedClipId: null, playhead: 0, playing: false, history: [], future: [] }),
  reset: () => set({ project: initialProject(), assets: [], selectedClipId: null, playhead: 0, playing: false, history: [], future: [] }),
}));
