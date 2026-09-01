"use client";

import Link from "next/link";
import {
  ArrowLeft,
  AudioLines,
  Captions,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Film,
  FolderOpen,
  ImageIcon,
  Magnet,
  Music2,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Scissors,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Video,
  Volume2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toPng } from "html-to-image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { exportProjectWav } from "@/lib/multimedia/audio";
import { convertAudioBlobToMp3, extractAudioFromMedia } from "@/lib/multimedia/media-convert";
import {
  deleteMultimediaProject,
  listSavedMultimediaProjects,
  loadMultimediaProject,
  saveMultimediaProject,
  type SavedProjectSummary,
} from "@/lib/multimedia/project-store";
import AudioWaveformCanvas from "@/components/multimedia/AudioWaveformCanvas";
import { downloadBlob, exportProjectVideo, supportedVideoFormats, type ExportFormat } from "@/lib/multimedia/export-media";
import {
  MEDIA_ACCEPT,
  inspectMediaFile,
  normalizeMediaFile,
  supportedMediaSummary,
  type MediaCompatibility,
} from "@/lib/multimedia/media-formats";
import {
  audioFadeFactor,
  createMediaClip,
  createTextClip,
  interpolateClip,
  makeProject,
  normalizeProject,
  parseClock,
  projectDuration,
  transitionFactor,
  type MediaAsset,
  type MultimediaProject,
  type TimelineClip,
  type TransitionKind,
} from "@/lib/multimedia/types";

type Tab = "files" | "videos" | "gallery" | "music" | "text" | "project";

type StudioAsset = MediaAsset & {
  mime?: string;
  extension?: string;
  compatibility?: MediaCompatibility;
  normalizedMime?: boolean;
  downloadUrl?: string;
  width?: number;
  height?: number;
};

type MusicResult = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  src: string;
  source: string;
  artworkUrl?: string;
  externalUrl?: string;
};

type GalleryImage = {
  id: string;
  prompt: string;
  image_url: string;
  provider?: string;
};

type EditableVideo = {
  id: string;
  title: string;
  author: string;
  duration: number;
  src: string;
  downloadUrl: string;
  thumbnail: string;
  externalUrl: string;
  source: "pexels" | "pixabay";
  width: number;
  height: number;
};

type PointerAction =
  | { mode: "move"; clipId: string; pointerId: number; startX: number; originalStart: number }
  | { mode: "trim-left"; clipId: string; pointerId: number; startX: number; originalStart: number; originalDuration: number; originalOffset: number }
  | { mode: "trim-right"; clipId: string; pointerId: number; startX: number; originalDuration: number }
  | { mode: "fade-in"; clipId: string; pointerId: number; startX: number; originalFade: number }
  | { mode: "fade-out"; clipId: string; pointerId: number; startX: number; originalFade: number };

const TRACK_STYLES: Record<string, string> = {
  video: "border-cyan-400/45 bg-cyan-500/20 text-cyan-100",
  overlay: "border-fuchsia-400/45 bg-fuchsia-500/20 text-fuchsia-100",
  text: "border-amber-400/45 bg-amber-500/20 text-amber-100",
  audio: "border-violet-400/45 bg-violet-500/20 text-violet-100",
  music: "border-emerald-400/45 bg-emerald-500/20 text-emerald-100",
};

const TRANSITIONS: { value: TransitionKind; label: string }[] = [
  { value: "none", label: "Sin transición" },
  { value: "fade", label: "Fundido" },
  { value: "slide-left", label: "Deslizar izquierda" },
  { value: "slide-right", label: "Deslizar derecha" },
];

const MAX_HISTORY = 60;

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fmt(value: number) {
  const safe = Math.max(0, value || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "eduai-media";
}

function cloneProject(project: MultimediaProject) {
  return structuredClone(project);
}

function parseSrtTime(value: string) {
  const match = value.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function parseSrt(content: string) {
  return content
    .replace(/\r/g, "")
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split("\n").filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex < 0) return null;
      const [from, to] = lines[timingIndex].split("-->").map((value) => value.trim());
      const start = parseSrtTime(from);
      const end = parseSrtTime(to);
      const text = lines.slice(timingIndex + 1).join("\n").trim();
      return text && end > start ? { start, duration: end - start, text } : null;
    })
    .filter((item): item is { start: number; duration: number; text: string } => Boolean(item));
}

function downloadProject(project: MultimediaProject, assets: StudioAsset[]) {
  const payload = {
    project: { ...project, updatedAt: new Date().toISOString() },
    assets: assets.map((asset) => ({
      ...asset,
      url: asset.local ? "" : asset.url,
      missing: Boolean(asset.local),
    })),
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${safeFilename(project.title)}.eduai-media.json`);
}

function clipStyle(clip: TimelineClip, playhead: number, width: number) {
  const local = Math.max(0, playhead - clip.start);
  const animated = interpolateClip(clip, local);
  const transition = transitionFactor(clip, local);
  return {
    opacity: clamp(animated.opacity * transition.opacity, 0, 1),
    transform: `translate(${animated.transform.x + transition.slide * width}px, ${animated.transform.y}px) scale(${animated.transform.scale}) rotate(${animated.transform.rotation}deg)`,
    filter: `brightness(${clip.filter.brightness}) contrast(${clip.filter.contrast}) saturate(${clip.filter.saturation}) blur(${clip.filter.blur}px) grayscale(${clip.filter.grayscale}) sepia(${clip.filter.sepia})`,
  };
}

function trackIcon(kind: string) {
  if (kind === "video") return <Video size={13} />;
  if (kind === "overlay") return <ImageIcon size={13} />;
  if (kind === "text") return <Captions size={13} />;
  if (kind === "music") return <Music2 size={13} />;
  return <AudioLines size={13} />;
}

export default function MultimediaStudioV3Client() {
  const [project, setProject] = useState<MultimediaProject>(() => makeProject());
  const projectRef = useRef(project);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const assetsRef = useRef(assets);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>("files");
  const [notice, setNotice] = useState("Selecciona un clip y usa la línea de tiempo para mover, recortar o dividir.");
  const [undoStack, setUndoStack] = useState<MultimediaProject[]>([]);
  const [redoStack, setRedoStack] = useState<MultimediaProject[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [timelineTail, setTimelineTail] = useState(10);
  const [waveformScale, setWaveformScale] = useState(1);
  const [musicQuery, setMusicQuery] = useState("música instrumental para estudiar");
  const [musicResults, setMusicResults] = useState<MusicResult[]>([]);
  const [searchingMusic, setSearchingMusic] = useState(false);
  const [videoQuery, setVideoQuery] = useState("música abstracta");
  const [videoResults, setVideoResults] = useState<EditableVideo[]>([]);
  const [searchingVideos, setSearchingVideos] = useState(false);
  const [videoLibraryMessage, setVideoLibraryMessage] = useState("");
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("mp4");
  const [savedProjects, setSavedProjects] = useState<SavedProjectSummary[]>([]);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [extractingAudio, setExtractingAudio] = useState(false);
  const [pointerAction, setPointerAction] = useState<PointerAction | null>(null);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const playbackAnchor = useRef({ playhead: 0, time: 0 });
  const supabase = useMemo(() => createClient(), []);

  const clips = useMemo(() => project.tracks.flatMap((track) => track.clips), [project]);
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || null;
  const selectedAsset = selectedClip?.assetId ? assetMap.get(selectedClip.assetId) : undefined;
  const selectedTrack = selectedClip ? project.tracks.find((track) => track.id === selectedClip.trackId) : undefined;
  const duration = useMemo(() => projectDuration(project), [project]);
  const timelineSpan = Math.max(15, duration + timelineTail, playhead + 5);
  const pixelsPerSecond = 68 * zoom;
  const timelineWidth = Math.max(920, timelineSpan * pixelsPerSecond);
  const formatSupport = useMemo(() => supportedVideoFormats(), []);

  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => { void refreshSavedProjects(); }, []);

  const commitProject = useCallback((updater: (current: MultimediaProject) => MultimediaProject, recordHistory = true) => {
    const current = projectRef.current;
    if (recordHistory) {
      setUndoStack((stack) => [...stack.slice(-(MAX_HISTORY - 1)), cloneProject(current)]);
      setRedoStack([]);
    }
    const next = { ...updater(current), updatedAt: new Date().toISOString() };
    projectRef.current = next;
    setProject(next);
  }, []);

  const updateClip = useCallback((clipId: string, patch: Partial<TimelineClip>, recordHistory = true) => {
    commitProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => clip.id === clipId ? { ...clip, ...patch } : clip),
      })),
    }), recordHistory);
  }, [commitProject]);

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack.slice(-(MAX_HISTORY - 1)), cloneProject(projectRef.current)]);
    const next = cloneProject(previous);
    projectRef.current = next;
    setProject(next);
    setNotice("Deshacer aplicado.");
  }

  function redo() {
    const nextProject = redoStack.at(-1);
    if (!nextProject) return;
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack.slice(-(MAX_HISTORY - 1)), cloneProject(projectRef.current)]);
    const next = cloneProject(nextProject);
    projectRef.current = next;
    setProject(next);
    setNotice("Rehacer aplicado.");
  }

  useEffect(() => {
    const saved = window.localStorage.getItem("eduai.multimedia.draft.v3");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      const nextProject = normalizeProject(parsed.project);
      const nextAssets: StudioAsset[] = Array.isArray(parsed.assets)
        ? parsed.assets.map((asset: StudioAsset) => asset.local ? { ...asset, url: "", missing: true } : asset)
        : [];
      projectRef.current = nextProject;
      setProject(nextProject);
      setAssets(nextAssets);
      setNotice(nextAssets.some((asset) => asset.missing)
        ? "Borrador recuperado. Vuelve a enlazar los archivos locales por nombre."
        : "Borrador recuperado automáticamente.");
    } catch {
      window.localStorage.removeItem("eduai.multimedia.draft.v3");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const safeAssets = assets.map((asset) => asset.local ? { ...asset, url: "", missing: true } : asset);
      window.localStorage.setItem("eduai.multimedia.draft.v3", JSON.stringify({ project, assets: safeAssets }));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [assets, project]);

  useEffect(() => () => {
    assetsRef.current.forEach((asset) => {
      if (asset.local && asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
    });
    audioRefs.current.forEach((audio) => audio.pause());
  }, []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    playbackAnchor.current = { playhead, time: performance.now() };
    const tick = () => {
      const next = playbackAnchor.current.playhead + (performance.now() - playbackAnchor.current.time) / 1000;
      if (next >= duration) {
        setPlayhead(duration);
        setPlaying(false);
        return;
      }
      setPlayhead(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, duration]);

  useEffect(() => {
    for (const clip of clips.filter((item) => item.clipType === "media" && item.assetId)) {
      const asset = assetMap.get(clip.assetId!);
      if (!asset?.url || asset.kind !== "video") continue;
      const element = videoRefs.current.get(clip.id);
      if (!element) continue;
      const isActive = playhead >= clip.start && playhead < clip.start + clip.duration;
      if (!isActive) { element.pause(); continue; }
      const wanted = clip.offset + playhead - clip.start;
      if (Math.abs(element.currentTime - wanted) > 0.2) element.currentTime = Math.max(0, wanted);
      const animated = interpolateClip(clip, playhead - clip.start);
      const transition = transitionFactor(clip, playhead - clip.start);
      element.volume = clip.muted ? 0 : clamp(animated.volume * transition.opacity * audioFadeFactor(clip, playhead - clip.start), 0, 1);
      element.muted = clip.muted;
      if (playing) void element.play().catch(() => undefined);
      else element.pause();
    }
  }, [assetMap, clips, playhead, playing]);

  useEffect(() => {
    const active = new Set<string>();
    for (const track of project.tracks.filter((item) => item.kind === "audio" || item.kind === "music")) {
      for (const clip of track.clips) {
        const asset = clip.assetId ? assetMap.get(clip.assetId) : undefined;
        const isActive = playhead >= clip.start && playhead < clip.start + clip.duration;
        if (!asset?.url || !isActive) continue;
        active.add(clip.id);
        let element = audioRefs.current.get(clip.id);
        if (!element) {
          element = new Audio(asset.url);
          element.preload = "auto";
          if (/^https?:/i.test(asset.url)) element.crossOrigin = "anonymous";
          audioRefs.current.set(clip.id, element);
        }
        const wanted = clip.offset + playhead - clip.start;
        if (Math.abs(element.currentTime - wanted) > 0.22) element.currentTime = Math.max(0, wanted);
        const animated = interpolateClip(clip, playhead - clip.start);
        const transition = transitionFactor(clip, playhead - clip.start);
        element.volume = clip.muted ? 0 : clamp(animated.volume * transition.opacity * audioFadeFactor(clip, playhead - clip.start), 0, 1);
        if (playing) void element.play().catch(() => undefined);
        else element.pause();
      }
    }
    audioRefs.current.forEach((audio, clipId) => { if (!active.has(clipId)) audio.pause(); });
  }, [assetMap, playhead, playing, project]);

  useEffect(() => {
    function keyHandler(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true]")) return;
      if (event.code === "Space") { event.preventDefault(); setPlaying((value) => !value); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateClip(); return; }
      if (event.key.toLowerCase() === "s") { event.preventDefault(); splitClip(); return; }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeClip(); }
      if (event.key === "ArrowLeft") setPlayhead((value) => Math.max(0, value - (event.shiftKey ? 1 : 0.1)));
      if (event.key === "ArrowRight") setPlayhead((value) => Math.min(timelineSpan, value + (event.shiftKey ? 1 : 0.1)));
    }
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  });

  function trackHasSpace(track: MultimediaProject["tracks"][number], start: number, clipDuration: number) {
    const end = start + clipDuration;
    return track.clips.every((clip) => end <= clip.start + 0.001 || start >= clip.start + clip.duration - 0.001);
  }

  function makeAudioTrack(kind: "audio" | "music", current: MultimediaProject) {
    const matching = current.tracks.filter((track) => track.kind === kind);
    const number = matching.length + 1;
    return {
      id: `${kind}-${uid("track")}`,
      name: kind === "music" ? `Música ${number}` : `Audio ${number}`,
      kind,
      clips: [] as TimelineClip[],
    };
  }

  function resolveAudioTrack(current: MultimediaProject, kind: "audio" | "music", start: number, clipDuration: number) {
    const available = current.tracks.find((track) => track.kind === kind && trackHasSpace(track, start, clipDuration));
    if (available) return { trackId: available.id, newTrack: null };
    const newTrack = makeAudioTrack(kind, current);
    return { trackId: newTrack.id, newTrack };
  }

  function addAudioTrack(kind: "audio" | "music") {
    const track = makeAudioTrack(kind, projectRef.current);
    commitProject((current) => ({ ...current, tracks: [...current.tracks, track] }));
    setNotice(`${track.name} creada. Los clips de esta pista se editan y mezclan por separado.`);
  }

  function moveClipToTrack(clipId: string, targetTrackId: string) {
    const clip = projectRef.current.tracks.flatMap((track) => track.clips).find((item) => item.id === clipId);
    if (!clip || clip.trackId === targetTrackId) return;
    const target = projectRef.current.tracks.find((track) => track.id === targetTrackId);
    if (!target) return;
    commitProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => {
        const without = track.clips.filter((item) => item.id !== clipId);
        if (track.id === targetTrackId) return { ...track, clips: [...without, { ...clip, trackId: targetTrackId }] };
        return { ...track, clips: without };
      }),
    }));
    setNotice(`Clip movido a ${target.name}.`);
  }

  function addAssetToTimeline(asset: StudioAsset, at = playhead) {
    if (!asset.url) { setNotice("El recurso no está disponible. Vuelve a enlazarlo."); return; }
    const start = Math.max(0, at);
    let trackId = asset.kind === "video" ? "video-main" : asset.kind === "image" ? "overlay-main" : asset.kind === "music" ? "music-main" : "audio-main";
    let newTrack: MultimediaProject["tracks"][number] | null = null;

    if (asset.kind === "audio" || asset.kind === "music") {
      const resolved = resolveAudioTrack(projectRef.current, asset.kind, start, Math.max(0.5, asset.duration || 10));
      trackId = resolved.trackId;
      newTrack = resolved.newTrack;
    }

    const clip = createMediaClip(asset, trackId, start);
    commitProject((current) => {
      const tracks = newTrack ? [...current.tracks, newTrack] : current.tracks;
      return {
        ...current,
        tracks: tracks.map((track) => track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track),
      };
    });
    setSelectedClipId(clip.id);
    setPlayhead(clip.start);
    const trackName = (newTrack || projectRef.current.tracks.find((track) => track.id === trackId))?.name || trackId;
    setNotice(`${asset.name} agregado a ${trackName} en ${fmt(clip.start)}.`);
  }

  async function createAssetsFromFiles(files: File[]) {
    const incoming: StudioAsset[] = [];
    const rejected: string[] = [];
    let relinked = 0;

    for (const original of files) {
      const inspection = await inspectMediaFile(original);
      if (inspection.kind === "unknown" || !inspection.playable) {
        rejected.push(`${original.name}: ${inspection.message}`);
        continue;
      }
      const normalized = normalizeMediaFile(original, inspection);
      const url = URL.createObjectURL(normalized);
      const kind = inspection.kind;
      const previous = assetsRef.current.find((asset) => asset.missing && asset.name === original.name && asset.kind === kind);
      if (previous) {
        setAssets((current) => current.map((asset) => asset.id === previous.id ? {
          ...asset,
          url,
          duration: inspection.duration || asset.duration,
          mime: inspection.mime,
          extension: inspection.extension,
          compatibility: inspection.compatibility,
          normalizedMime: inspection.normalizedMime,
          missing: false,
          local: true,
          exportable: true,
        } : asset));
        relinked += 1;
        continue;
      }
      incoming.push({
        id: uid("asset"),
        name: original.name,
        kind,
        url,
        duration: kind === "image" ? 5 : Math.max(0.05, inspection.duration),
        source: "local",
        exportable: true,
        local: true,
        mime: inspection.mime,
        extension: inspection.extension,
        compatibility: inspection.compatibility,
        normalizedMime: inspection.normalizedMime,
      });
    }

    if (incoming.length) setAssets((current) => [...current, ...incoming]);
    const accepted = incoming.length + relinked;
    setNotice(rejected.length
      ? `${accepted} archivo(s) aceptados. ${rejected.length} requieren conversión: ${rejected.slice(0, 2).join(" · ")}`
      : `${accepted} archivo(s) listos para editar.`);
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length) await createAssetsFromFiles(files);
  }

  async function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length) await createAssetsFromFiles(files);
  }

  function removeClip() {
    if (!selectedClipId) return;
    commitProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({ ...track, clips: track.clips.filter((clip) => clip.id !== selectedClipId) })),
    }));
    setSelectedClipId(null);
    setNotice("Clip eliminado.");
  }

  function duplicateClip() {
    const clip = projectRef.current.tracks.flatMap((track) => track.clips).find((item) => item.id === selectedClipId);
    if (!clip) return;
    const clone: TimelineClip = {
      ...clip,
      id: uid("clip"),
      start: clip.start + Math.min(1, Math.max(0.25, clip.duration * 0.1)),
      keyframes: clip.keyframes.map((frame) => ({ ...frame, id: uid("kf") })),
    };
    commitProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === clone.trackId ? { ...track, clips: [...track.clips, clone] } : track),
    }));
    setSelectedClipId(clone.id);
    setPlayhead(clone.start);
    setNotice("Clip duplicado.");
  }

  function splitClip() {
    const clip = projectRef.current.tracks.flatMap((track) => track.clips).find((item) => item.id === selectedClipId);
    if (!clip) { setNotice("Selecciona un clip antes de dividir."); return; }
    const local = playhead - clip.start;
    if (local <= 0.04 || local >= clip.duration - 0.04) {
      setNotice("Haz clic dentro del clip para colocar el cabezal y luego pulsa Dividir (S).");
      return;
    }
    const left: TimelineClip = {
      ...clip,
      duration: local,
      keyframes: clip.keyframes.filter((frame) => frame.time <= local),
    };
    const right: TimelineClip = {
      ...clip,
      id: uid("clip"),
      start: playhead,
      duration: clip.duration - local,
      offset: clip.offset + (clip.clipType === "media" ? local : 0),
      keyframes: clip.keyframes.filter((frame) => frame.time >= local).map((frame) => ({ ...frame, id: uid("kf"), time: frame.time - local })),
    };
    commitProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === clip.trackId ? {
        ...track,
        clips: track.clips.flatMap((item) => item.id === clip.id ? [left, right] : [item]),
      } : track),
    }));
    setSelectedClipId(right.id);
    setNotice(`Clip dividido en ${fmt(playhead)}.`);
  }

  function trimStartToPlayhead() {
    const clip = selectedClip;
    if (!clip) return;
    const local = playhead - clip.start;
    if (local <= 0 || local >= clip.duration - 0.05) { setNotice("El cabezal debe estar dentro del clip."); return; }
    updateClip(clip.id, {
      start: playhead,
      duration: clip.duration - local,
      offset: clip.clipType === "media" ? clip.offset + local : clip.offset,
    });
    setNotice("Inicio recortado al cabezal.");
  }

  function trimEndToPlayhead() {
    const clip = selectedClip;
    if (!clip) return;
    const local = playhead - clip.start;
    if (local <= 0.05 || local >= clip.duration) { setNotice("El cabezal debe estar dentro del clip."); return; }
    updateClip(clip.id, { duration: local });
    setNotice("Fin recortado al cabezal.");
  }

  function sourceMaxDuration(clip: TimelineClip) {
    if (clip.clipType !== "media" || !clip.assetId) return Number.POSITIVE_INFINITY;
    const asset = assetMap.get(clip.assetId);
    if (!asset || asset.kind === "image") return Number.POSITIVE_INFINITY;
    return Math.max(0.05, asset.duration - clip.offset);
  }

  function snapTime(value: number, clipId: string, movingDuration = 0) {
    const raw = Math.max(0, value);
    if (!snapEnabled) return raw;
    const points = new Set<number>([0, playhead]);
    for (let second = 0; second <= timelineSpan; second += 1) points.add(second);
    for (const clip of projectRef.current.tracks.flatMap((track) => track.clips)) {
      if (clip.id === clipId) continue;
      points.add(clip.start);
      points.add(clip.start + clip.duration);
    }
    let best = raw;
    let distance = 0.12;
    for (const point of points) {
      const leftDistance = Math.abs(raw - point);
      if (leftDistance < distance) { distance = leftDistance; best = point; }
      if (movingDuration > 0) {
        const endStart = point - movingDuration;
        const endDistance = Math.abs(raw - endStart);
        if (endDistance < distance) { distance = endDistance; best = endStart; }
      }
    }
    return Math.max(0, best);
  }

  function beginPointerAction(event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>, action: PointerAction) {
    event.stopPropagation();
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    setSelectedClipId(action.clipId);
    setPlaying(false);
    setUndoStack((stack) => [...stack.slice(-(MAX_HISTORY - 1)), cloneProject(projectRef.current)]);
    setRedoStack([]);
    setPointerAction(action);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointerAction || pointerAction.pointerId !== event.pointerId) return;
    const dxSeconds = (event.clientX - pointerAction.startX) / pixelsPerSecond;
    const clip = projectRef.current.tracks.flatMap((track) => track.clips).find((item) => item.id === pointerAction.clipId);
    if (!clip) return;

    if (pointerAction.mode === "move") {
      const start = snapTime(pointerAction.originalStart + dxSeconds, clip.id, clip.duration);
      updateClip(clip.id, { start }, false);
      return;
    }

    if (pointerAction.mode === "trim-left") {
      const maxDelta = pointerAction.originalDuration - 0.05;
      const delta = clamp(dxSeconds, -pointerAction.originalStart, maxDelta);
      const proposedStart = pointerAction.originalStart + delta;
      const snappedStart = snapTime(proposedStart, clip.id);
      const applied = clamp(snappedStart - pointerAction.originalStart, -pointerAction.originalStart, maxDelta);
      updateClip(clip.id, {
        start: pointerAction.originalStart + applied,
        duration: pointerAction.originalDuration - applied,
        offset: clip.clipType === "media" ? Math.max(0, pointerAction.originalOffset + applied) : pointerAction.originalOffset,
      }, false);
      return;
    }

    if (pointerAction.mode === "fade-in") {
      const value = clamp(pointerAction.originalFade + dxSeconds, 0, clip.duration / 2);
      updateClip(clip.id, { audioFadeIn: value }, false);
      return;
    }

    if (pointerAction.mode === "fade-out") {
      const value = clamp(pointerAction.originalFade - dxSeconds, 0, clip.duration / 2);
      updateClip(clip.id, { audioFadeOut: value }, false);
      return;
    }

    const maxSource = sourceMaxDuration(clip);
    const wanted = Math.max(0.05, pointerAction.originalDuration + dxSeconds);
    const durationValue = Number.isFinite(maxSource) ? Math.min(wanted, maxSource) : wanted;
    updateClip(clip.id, { duration: durationValue }, false);
  }

  function endPointerAction(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointerAction || pointerAction.pointerId !== event.pointerId) return;
    setPointerAction(null);
    setNotice(pointerAction.mode === "move" ? "Clip movido." : pointerAction.mode === "fade-in" || pointerAction.mode === "fade-out" ? "Fade de audio ajustado." : "Recorte aplicado.");
  }

  function setPlayheadFromTimeline(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerAction) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const value = clamp((event.clientX - rect.left) / pixelsPerSecond, 0, timelineSpan);
    setPlaying(false);
    setPlayhead(value);
  }

  async function searchMusic() {
    if (!musicQuery.trim()) return;
    setSearchingMusic(true);
    setNotice("Buscando música…");
    try {
      const response = await fetch(`/api/music/search?query=${encodeURIComponent(musicQuery.trim())}&limit=24`);
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || "No se pudo buscar música.");
      setMusicResults(data.tracks || []);
      setNotice(`${(data.tracks || []).length} resultados. Los que tienen audio directo se pueden editar; YouTube queda como referencia externa.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo buscar música.");
    } finally {
      setSearchingMusic(false);
    }
  }

  function importMusic(result: MusicResult) {
    if (!result.src) {
      if (result.externalUrl) window.open(result.externalUrl, "_blank", "noopener,noreferrer");
      setNotice("YouTube es solo referencia/vista externa. Usa iTunes, Jamendo o Audius para editar audio directamente.");
      return;
    }
    const asset: StudioAsset = {
      id: `music-${result.id}`,
      name: `${result.title} — ${result.artist}`,
      kind: "music",
      url: result.src,
      duration: parseClock(result.duration),
      source: result.source,
      artworkUrl: result.artworkUrl,
      externalUrl: result.externalUrl,
      exportable: result.source !== "youtube",
      local: false,
    };
    setAssets((current) => current.some((item) => item.id === asset.id) ? current : [...current, asset]);
    addAssetToTimeline(asset);
  }

  async function searchEditableVideos() {
    if (!videoQuery.trim()) return;
    setSearchingVideos(true);
    setVideoLibraryMessage("");
    setNotice("Buscando videos editables…");
    try {
      const response = await fetch(`/api/media/videos/search?query=${encodeURIComponent(videoQuery.trim())}&limit=20`);
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || "No se pudieron buscar videos.");
      setVideoResults(data.videos || []);
      setVideoLibraryMessage(data.message || "");
      setNotice((data.videos || []).length
        ? `${data.videos.length} videos editables encontrados. Puedes agregarlos a la timeline o abrir su archivo.`
        : data.message || "No se encontraron videos editables.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudieron buscar videos.");
    } finally {
      setSearchingVideos(false);
    }
  }

  function importEditableVideo(video: EditableVideo) {
    const asset: StudioAsset = {
      id: video.id,
      name: `${video.title} — ${video.author}`,
      kind: "video",
      url: video.src,
      duration: video.duration,
      source: video.source,
      artworkUrl: video.thumbnail,
      externalUrl: video.externalUrl,
      downloadUrl: video.downloadUrl,
      exportable: true,
      local: false,
      width: video.width,
      height: video.height,
      mime: "video/mp4",
      extension: "mp4",
      compatibility: "compatible",
    };
    setAssets((current) => current.some((item) => item.id === asset.id) ? current : [...current, asset]);
    addAssetToTimeline(asset);
  }

  async function loadGallery() {
    setGalleryLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Inicia sesión para acceder a tu Galería.");
      const { data, error } = await supabase
        .from("generated_images")
        .select("id,prompt,image_url,provider")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      setGallery((data || []) as GalleryImage[]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo cargar la Galería.");
    } finally {
      setGalleryLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "gallery" && !gallery.length && !galleryLoading) void loadGallery();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  function importGalleryImage(image: GalleryImage) {
    const asset: StudioAsset = {
      id: `gallery-${image.id}`,
      name: image.prompt || "Imagen de Galería",
      kind: "image",
      url: image.image_url,
      duration: 5,
      source: `galeria:${image.provider || "eduai"}`,
      artworkUrl: image.image_url,
      exportable: true,
      local: false,
    };
    setAssets((current) => current.some((item) => item.id === asset.id) ? current : [...current, asset]);
    addAssetToTimeline(asset);
  }

  function addText() {
    const clip = createTextClip(playhead, "Escribe aquí");
    commitProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === "text-main" ? { ...track, clips: [...track.clips, clip] } : track),
    }));
    setSelectedClipId(clip.id);
    setTab("text");
  }

  async function importSrt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const items = parseSrt(await file.text());
    if (!items.length) { setNotice("No se detectaron subtítulos SRT válidos."); return; }
    const newClips = items.map((item) => ({ ...createTextClip(item.start, item.text), start: item.start, duration: item.duration }));
    commitProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === "text-main" ? { ...track, clips: [...track.clips, ...newClips] } : track),
    }));
    setNotice(`${newClips.length} subtítulos importados.`);
  }

  async function loadProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const nextProject = normalizeProject(parsed.project || parsed);
      const nextAssets: StudioAsset[] = Array.isArray(parsed.assets)
        ? parsed.assets.map((asset: StudioAsset) => asset.local || !asset.url ? { ...asset, url: "", missing: true } : asset)
        : [];
      setUndoStack((stack) => [...stack.slice(-(MAX_HISTORY - 1)), cloneProject(projectRef.current)]);
      setRedoStack([]);
      projectRef.current = nextProject;
      setProject(nextProject);
      setAssets(nextAssets);
      setSavedProjectId(null);
      setSelectedClipId(null);
      setPlayhead(0);
      setNotice("Proyecto cargado. Los archivos locales se pueden volver a enlazar por nombre.");
    } catch {
      setNotice("El archivo no es un proyecto EDUAI Multimedia válido.");
    }
  }

  async function exportVideo() {
    if (!clips.length) { setNotice("Agrega al menos un clip antes de exportar."); return; }
    setExporting(true);
    setExportProgress(0);
    setPlaying(false);
    setNotice(`Exportando ${exportFormat.toUpperCase()}…`);
    try {
      const result = await exportProjectVideo(project, assets, { format: exportFormat, onProgress: setExportProgress });
      downloadBlob(result.blob, `${safeFilename(project.title)}.${result.format}`);
      const fallback = result.format !== exportFormat ? ` ${exportFormat.toUpperCase()} no está disponible; se usó ${result.format.toUpperCase()}.` : "";
      const warning = result.warnings.length ? ` ${result.warnings.slice(0, 2).join(" ")}` : "";
      setNotice(`Exportación completada.${fallback}${warning}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo exportar el video.");
    } finally {
      setExporting(false);
    }
  }

  async function exportWav() {
    setExporting(true);
    setNotice("Mezclando audio…");
    try {
      const blob = await exportProjectWav(project, assets);
      downloadBlob(blob, `${safeFilename(project.title)}.wav`);
      setNotice("WAV exportado correctamente.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo exportar WAV.");
    } finally {
      setExporting(false);
    }
  }

  async function exportMp3() {
    setExporting(true);
    setNotice("Mezclando pistas y codificando MP3…");
    try {
      const wav = await exportProjectWav(projectRef.current, assetsRef.current);
      const mp3 = await convertAudioBlobToMp3(wav);
      downloadBlob(mp3, `${safeFilename(projectRef.current.title)}.mp3`);
      setNotice("MP3 exportado correctamente a 192 kbps.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo exportar MP3.");
    } finally {
      setExporting(false);
    }
  }

  async function refreshSavedProjects() {
    try {
      setSavedProjects(await listSavedMultimediaProjects());
    } catch {
      setSavedProjects([]);
    }
  }

  async function saveProjectHere() {
    setSavingProject(true);
    setNotice("Guardando proyecto y archivos multimedia en EDUAI…");
    try {
      const saved = await saveMultimediaProject(projectRef.current, assetsRef.current, savedProjectId);
      setSavedProjectId(saved.id);
      await refreshSavedProjects();
      setNotice("Proyecto guardado dentro de EDUAI. Puedes cerrarlo y abrirlo luego desde Mis proyectos.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar el proyecto en este navegador.");
    } finally {
      setSavingProject(false);
    }
  }

  async function openSavedProject(id: string) {
    setPlaying(false);
    try {
      const restored = await loadMultimediaProject(id);
      assetsRef.current.forEach((asset) => {
        if (asset.local && asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
      });
      const nextProject = normalizeProject(restored.project);
      const nextAssets = restored.assets as StudioAsset[];
      projectRef.current = nextProject;
      assetsRef.current = nextAssets;
      setProject(nextProject);
      setAssets(nextAssets);
      setSavedProjectId(restored.id);
      setSelectedClipId(null);
      setPlayhead(0);
      setUndoStack([]);
      setRedoStack([]);
      setNotice(nextAssets.some((asset) => asset.missing)
        ? "Proyecto abierto. Algún recurso remoto o local ya no está disponible."
        : "Proyecto abierto con sus archivos multimedia.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo abrir el proyecto guardado.");
    }
  }

  async function removeSavedProject(id: string) {
    try {
      await deleteMultimediaProject(id);
      if (savedProjectId === id) setSavedProjectId(null);
      await refreshSavedProjects();
      setNotice("Proyecto eliminado de Mis proyectos.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo eliminar el proyecto.");
    }
  }

  async function separateSelectedVideoAudio() {
    const clip = selectedClip;
    const asset = selectedAsset;
    if (!clip || !asset || asset.kind !== "video" || !asset.url) {
      setNotice("Selecciona un clip de video para separar su audio.");
      return;
    }

    setExtractingAudio(true);
    setPlaying(false);
    setNotice("Separando el audio del video…");
    try {
      const response = await fetch(asset.url);
      if (!response.ok) throw new Error("No se pudo leer el video. Una fuente remota puede estar bloqueando CORS.");
      const videoBlob = await response.blob();
      const wav = await extractAudioFromMedia(videoBlob, {
        start: clip.offset,
        end: clip.offset + clip.duration,
      });
      const baseName = asset.name.replace(/\.[^.]+$/, "") || "video";
      const audioAsset: StudioAsset = {
        id: uid("asset-audio"),
        name: `${baseName}-audio.wav`,
        kind: "audio",
        url: URL.createObjectURL(wav),
        duration: clip.duration,
        source: "separated-video",
        exportable: true,
        local: true,
        missing: false,
        mime: "audio/wav",
        extension: "wav",
        compatibility: "native",
      };

      const nextAssets = [...assetsRef.current, audioAsset];
      assetsRef.current = nextAssets;
      setAssets(nextAssets);

      let createdClipId = "";
      commitProject((current) => {
        const resolved = resolveAudioTrack(current, "audio", clip.start, clip.duration);
        const audioClip = createMediaClip(audioAsset, resolved.trackId, clip.start);
        audioClip.duration = clip.duration;
        audioClip.offset = 0;
        audioClip.volume = clip.volume;
        audioClip.muted = false;
        audioClip.audioFadeIn = clip.audioFadeIn || 0;
        audioClip.audioFadeOut = clip.audioFadeOut || 0;
        createdClipId = audioClip.id;

        let tracks = current.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((item) => item.id === clip.id ? { ...item, muted: true } : item),
        }));
        if (resolved.newTrack) tracks = [...tracks, resolved.newTrack];
        tracks = tracks.map((track) => track.id === resolved.trackId
          ? { ...track, clips: [...track.clips, audioClip] }
          : track);
        return { ...current, tracks };
      });

      if (createdClipId) setSelectedClipId(createdClipId);
      setNotice("Audio separado: el video original quedó silenciado y el audio está en una pista independiente.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo separar el audio de este video.");
    } finally {
      setExtractingAudio(false);
    }
  }

  async function exportFrame() {
    if (!previewRef.current) return;
    try {
      const dataUrl = await toPng(previewRef.current, { cacheBust: true, pixelRatio: 2 });
      const response = await fetch(dataUrl);
      downloadBlob(await response.blob(), `${safeFilename(project.title)}-${Math.round(playhead * 10)}.png`);
      setNotice("Fotograma PNG exportado.");
    } catch {
      setNotice("No se pudo exportar el fotograma; alguna fuente remota puede bloquear CORS.");
    }
  }

  function addKeyframe() {
    if (!selectedClip) return;
    const local = clamp(playhead - selectedClip.start, 0, selectedClip.duration);
    const frame = {
      id: uid("kf"),
      time: local,
      opacity: selectedClip.opacity,
      volume: selectedClip.volume,
      transform: { ...selectedClip.transform },
    };
    updateClip(selectedClip.id, {
      keyframes: [...selectedClip.keyframes.filter((item) => Math.abs(item.time - local) > 0.04), frame].sort((a, b) => a.time - b.time),
    });
    setNotice(`Keyframe agregado en ${fmt(local)}.`);
  }

  const visualTracks = project.tracks.filter((track) => track.kind === "video" || track.kind === "overlay" || track.kind === "text");
  const activeVisualClips = visualTracks.flatMap((track) => track.clips).filter((clip) => playhead >= clip.start && playhead < clip.start + clip.duration);

  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b18]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1900px] flex-wrap items-center gap-2 px-3 py-2 lg:px-5">
          <Link href="/agentes" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"><ArrowLeft size={17} /></Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600"><Film size={18} /></div>
          <div className="min-w-[220px] flex-1">
            <input value={project.title} onChange={(event) => setProject((current) => ({ ...current, title: event.target.value }))} className="w-full bg-transparent text-sm font-semibold outline-none" />
            <p className="text-[10px] text-slate-400">Editor Multimedia V3 · {project.width}×{project.height} · {project.fps} fps · contenido {fmt(duration)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={undo} disabled={!undoStack.length} title="Deshacer (Ctrl/Cmd+Z)" className="rounded-xl border border-white/10 bg-white/5 p-2 disabled:opacity-30"><Undo2 size={14} /></button>
            <button onClick={redo} disabled={!redoStack.length} title="Rehacer" className="rounded-xl border border-white/10 bg-white/5 p-2 disabled:opacity-30"><Redo2 size={14} /></button>
            <button onClick={() => downloadProject(project, assets)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"><Save size={14} className="mr-1 inline" />Proyecto</button>
            <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)} className="rounded-xl border border-white/10 bg-[#0b1020] px-2 py-2 text-xs">
              <option value="mp4">MP4{formatSupport.mp4 ? "" : " → WebM"}</option>
              <option value="webm">WebM</option>
            </select>
            <button disabled={exporting} onClick={exportVideo} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold hover:bg-cyan-500 disabled:opacity-50"><Download size={14} className="mr-1 inline" />{exporting ? `${Math.round(exportProgress * 100)}%` : "Exportar"}</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1900px] gap-3 p-3 2xl:grid-cols-[330px_minmax(0,1fr)_320px]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="mb-3 grid grid-cols-6 gap-1 rounded-xl bg-black/20 p-1">
            {([
              ["files", FolderOpen, "Archivos"],
              ["videos", Video, "Videos"],
              ["gallery", ImageIcon, "Galería"],
              ["music", Music2, "Música"],
              ["text", Captions, "Texto"],
              ["project", Save, "Proyecto"],
            ] as const).map(([value, Icon, label]) => (
              <button key={value} title={label} onClick={() => setTab(value)} className={`rounded-lg p-2 ${tab === value ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:bg-white/5"}`}><Icon size={16} className="mx-auto" /></button>
            ))}
          </div>

          {tab === "files" && <div className="space-y-3">
            <label onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-500/5 p-5 text-center hover:bg-cyan-500/10">
              <Upload size={22} className="text-cyan-300" />
              <span className="text-xs font-semibold">Cargar o arrastrar</span>
              <span className="text-[9px] leading-4 text-slate-400">{supportedMediaSummary()}</span>
              <input type="file" multiple accept={MEDIA_ACCEPT} className="hidden" onChange={handleFiles} />
            </label>
            <div className="space-y-2">
              {assets.filter((asset) => asset.source === "local" || asset.missing).map((asset) => (
                <div key={asset.id} className={`flex items-center gap-2 rounded-xl border p-2 ${asset.missing ? "border-amber-500/30 bg-amber-500/5" : "border-white/10 bg-black/20"}`}>
                  {asset.kind === "video" ? <Video size={15} /> : asset.kind === "audio" ? <AudioLines size={15} /> : <ImageIcon size={15} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px]">{asset.name}</p>
                    <p className="text-[9px] text-slate-500">{asset.missing ? "Falta volver a enlazar" : `${asset.extension?.toUpperCase() || asset.kind} · ${fmt(asset.duration)}${asset.normalizedMime ? " · MIME corregido" : ""}`}</p>
                  </div>
                  {!asset.missing && <button onClick={() => addAssetToTimeline(asset)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><Plus size={13} /></button>}
                </div>
              ))}
              {!assets.some((asset) => asset.source === "local" || asset.missing) && <p className="py-8 text-center text-xs text-slate-500">Aún no hay archivos locales.</p>}
            </div>
          </div>}

          {tab === "videos" && <div className="space-y-3">
            <div className="flex gap-2"><input value={videoQuery} onChange={(event) => setVideoQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchEditableVideos(); }} placeholder="Buscar videos editables" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none" /><button onClick={searchEditableVideos} disabled={searchingVideos} className="rounded-xl bg-cyan-600 p-2"><Search size={15} /></button></div>
            <p className="text-[9px] leading-4 text-slate-500">Biblioteca para edición: Pexels/Pixabay. YouTube se mantiene solo como referencia externa y no se descarga.</p>
            {videoLibraryMessage && <div className="rounded-xl border border-amber-400/15 bg-amber-500/5 p-2 text-[9px] text-amber-100">{videoLibraryMessage}</div>}
            <div className="space-y-2">
              {videoResults.map((video) => <div key={video.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                {video.thumbnail ? <img src={video.thumbnail} alt={video.title} className="aspect-video w-full object-cover" /> : null}
                <div className="p-2"><p className="truncate text-[10px] font-medium">{video.title}</p><p className="text-[9px] text-slate-500">{video.author} · {video.source} · {fmt(video.duration)}</p><div className="mt-2 flex gap-1"><button onClick={() => importEditableVideo(video)} className="flex-1 rounded-lg bg-cyan-600/20 px-2 py-1.5 text-[9px] text-cyan-100"><Plus size={11} className="mr-1 inline" />Editar</button><button onClick={() => window.open(video.downloadUrl, "_blank", "noopener,noreferrer")} className="rounded-lg bg-white/10 px-2 py-1.5 text-[9px]"><Download size={11} /></button></div></div>
              </div>)}
            </div>
          </div>}

          {tab === "gallery" && <div className="space-y-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold">Galería EduAI</p><button onClick={loadGallery} className="text-[10px] text-cyan-300">Actualizar</button></div>
            {galleryLoading ? <p className="py-8 text-center text-xs text-slate-500">Cargando…</p> : <div className="grid grid-cols-2 gap-2">{gallery.map((image) => <button key={image.id} onClick={() => importGalleryImage(image)} className="overflow-hidden rounded-xl border border-white/10 bg-black/20 text-left"><img src={image.image_url} alt={image.prompt} className="aspect-video w-full object-cover" /><p className="line-clamp-2 p-2 text-[9px]">{image.prompt}</p></button>)}</div>}
            <Link href="/image-studio" className="block rounded-xl border border-white/10 bg-white/5 p-2 text-center text-xs">Abrir Image Studio</Link>
          </div>}

          {tab === "music" && <div className="space-y-3">
            <div className="flex gap-2"><input value={musicQuery} onChange={(event) => setMusicQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchMusic(); }} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none" /><button onClick={searchMusic} disabled={searchingMusic} className="rounded-xl bg-emerald-600 p-2"><Search size={15} /></button></div>
            <p className="text-[9px] leading-4 text-slate-500">iTunes/Jamendo/Audius: audio editable. YouTube: referencia externa, sin descarga.</p>
            <div className="space-y-2">{musicResults.map((result) => <div key={result.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
              {result.artworkUrl ? <img src={result.artworkUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15"><Music2 size={14} /></div>}
              <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium">{result.title}</p><p className="truncate text-[9px] text-slate-500">{result.artist} · {result.source}{!result.src ? " · solo externo" : " · editable"}</p></div>
              <button onClick={() => importMusic(result)} className={`rounded-lg p-1.5 ${result.src ? "bg-emerald-500/15 text-emerald-100" : "bg-white/10"}`}>{result.src ? <Plus size={13} /> : <ChevronRight size={13} />}</button>
            </div>)}</div>
          </div>}

          {tab === "text" && <div className="space-y-3">
            <button onClick={addText} className="w-full rounded-xl bg-amber-500/15 p-3 text-xs font-semibold text-amber-200"><Plus size={14} className="mr-1 inline" />Añadir texto</button>
            <label className="block cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 text-center text-xs">Importar subtítulos SRT<input type="file" accept=".srt,text/plain" className="hidden" onChange={importSrt} /></label>
            {project.tracks.find((track) => track.kind === "text")?.clips.map((clip) => <button key={clip.id} onClick={() => { setSelectedClipId(clip.id); setPlayhead(clip.start); }} className={`w-full rounded-xl border p-2 text-left ${selectedClipId === clip.id ? "border-amber-400/50 bg-amber-500/10" : "border-white/10 bg-black/20"}`}><p className="line-clamp-2 text-[10px]">{clip.textStyle?.text}</p><p className="mt-1 text-[9px] text-slate-500">{fmt(clip.start)} · {fmt(clip.duration)}</p></button>)}
          </div>}

          {tab === "project" && <div className="space-y-3 text-xs">
            <label className="block">Resolución<select value={`${project.width}x${project.height}`} onChange={(event) => { const [width, height] = event.target.value.split("x").map(Number); commitProject((current) => ({ ...current, width, height })); }} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2"><option value="1280x720">1280×720 · HD</option><option value="1920x1080">1920×1080 · Full HD</option><option value="1080x1920">1080×1920 · Vertical</option><option value="1080x1080">1080×1080 · Cuadrado</option></select></label>
            <label className="block">FPS<select value={project.fps} onChange={(event) => commitProject((current) => ({ ...current, fps: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2"><option value={24}>24 fps</option><option value={30}>30 fps</option><option value={60}>60 fps</option></select></label>
            <button disabled={savingProject} onClick={saveProjectHere} className="w-full rounded-xl border border-cyan-400/25 bg-cyan-500/15 p-3 font-semibold text-cyan-100 disabled:opacity-50"><Save size={14} className="mr-1 inline" />{savingProject ? "Guardando…" : savedProjectId ? "Guardar cambios en EDUAI" : "Guardar en EDUAI"}</button>
            <p className="text-[9px] leading-4 text-slate-500">Mis proyectos se guardan en este navegador, incluyendo los archivos locales cuando hay espacio disponible.</p>
            {savedProjects.length > 0 && <div className="space-y-1 rounded-xl border border-white/10 bg-black/20 p-2"><div className="mb-1 flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-200">Mis proyectos</span><button onClick={() => void refreshSavedProjects()} className="text-[9px] text-cyan-300">Actualizar</button></div>{savedProjects.map((saved) => <div key={saved.id} className={`flex items-center gap-1 rounded-lg border p-1.5 ${savedProjectId === saved.id ? "border-cyan-400/35 bg-cyan-500/10" : "border-white/5 bg-white/[0.02]"}`}><button onClick={() => void openSavedProject(saved.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-[10px] text-slate-200">{saved.title}</span><span className="block text-[8px] text-slate-500">{new Date(saved.updatedAt).toLocaleString()} · {saved.assetCount} recursos</span></button><button title="Abrir proyecto" onClick={() => void openSavedProject(saved.id)} className="rounded p-1 text-cyan-300 hover:bg-white/10"><FolderOpen size={12} /></button><button title="Eliminar proyecto" onClick={() => void removeSavedProject(saved.id)} className="rounded p-1 text-rose-300 hover:bg-rose-500/10"><Trash2 size={12} /></button></div>)}</div>}
            <div className="grid grid-cols-2 gap-2"><button onClick={() => downloadProject(project, assets)} className="rounded-xl border border-white/10 bg-white/5 p-2.5"><Download size={13} className="mr-1 inline" />Proyecto JSON</button><label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-2.5 text-center">Cargar JSON<input type="file" accept=".json,application/json" className="hidden" onChange={loadProject} /></label></div>
            <div className="grid grid-cols-2 gap-2"><button disabled={exporting} onClick={exportWav} className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-2.5 text-violet-200 disabled:opacity-50"><Volume2 size={14} className="mr-1 inline" />WAV</button><button disabled={exporting} onClick={exportMp3} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-2.5 text-emerald-200 disabled:opacity-50"><Music2 size={14} className="mr-1 inline" />MP3</button></div>
            <button onClick={exportFrame} className="w-full rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3 text-fuchsia-200"><ImageIcon size={14} className="mr-1 inline" />Fotograma PNG</button>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[9px] leading-5 text-slate-400"><b className="text-slate-200">Atajos:</b><br />Espacio reproducir · S dividir · Ctrl/Cmd+D duplicar · Supr eliminar · Ctrl/Cmd+Z deshacer · Shift+flechas mover cabezal 1 s</div>
          </div>}
        </aside>

        <main className="min-w-0 space-y-3">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-xs font-semibold">Monitor</p><p className="text-[10px] text-slate-500">{fmt(playhead)} / {fmt(duration)}</p></div><div className="flex gap-2"><Link href="/video-studio" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px]">Video Studio</Link><Link href="/audio-lab" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px]">Audio Lab</Link></div></div>
            <div className="flex justify-center rounded-2xl bg-black/50 p-2">
              <div ref={previewRef} className="relative w-full max-w-[980px] overflow-hidden rounded-xl bg-[#050816]" style={{ aspectRatio: `${project.width}/${project.height}` }}>
                {activeVisualClips.map((clip) => {
                  const asset = clip.assetId ? assetMap.get(clip.assetId) : undefined;
                  const style = clipStyle(clip, playhead, previewRef.current?.clientWidth || 800);
                  if (clip.clipType === "text" && clip.textStyle) return <div key={clip.id} className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ opacity: style.opacity }}><div style={{ transform: style.transform, color: clip.textStyle.color, background: clip.textStyle.backgroundColor, fontSize: `${Math.max(12, clip.textStyle.fontSize * 0.55)}px`, fontFamily: clip.textStyle.fontFamily, fontWeight: clip.textStyle.fontWeight, textAlign: clip.textStyle.align, WebkitTextStroke: clip.textStyle.strokeWidth ? `${clip.textStyle.strokeWidth}px ${clip.textStyle.strokeColor}` : undefined, maxWidth: "82%", whiteSpace: "pre-wrap", padding: "8px 14px" }}>{clip.textStyle.text}</div></div>;
                  if (!asset?.url) return null;
                  if (asset.kind === "video") return <video key={clip.id} ref={(node) => { if (node) videoRefs.current.set(clip.id, node); else videoRefs.current.delete(clip.id); }} src={asset.url} playsInline preload="auto" className="absolute inset-0 h-full w-full object-cover" style={{ ...style, transformOrigin: "center" }} />;
                  if (asset.kind === "image") return <img key={clip.id} src={asset.url} alt={asset.name} className="absolute inset-0 h-full w-full object-contain" style={{ ...style, transformOrigin: "center" }} />;
                  return null;
                })}
                {!activeVisualClips.length && <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600"><Film size={44} /><p className="mt-3 text-xs">Agrega video, imágenes o texto</p></div>}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3"><button onClick={() => setPlaying((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600">{playing ? <Pause size={16} /> : <Play size={16} />}</button><input type="range" min={0} max={Math.max(duration, 0.01)} step={0.01} value={Math.min(playhead, duration)} onChange={(event) => { setPlaying(false); setPlayhead(Number(event.target.value)); }} className="flex-1 accent-cyan-500" /><span className="w-20 text-right text-[10px] text-slate-400">{fmt(playhead)}</span></div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <p className="mr-auto text-xs font-semibold">Línea de tiempo</p>
              <button onClick={splitClip} disabled={!selectedClip} title="Dividir en cabezal (S)" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] disabled:opacity-30"><Scissors size={12} className="mr-1 inline" />Dividir</button>
              <button onClick={trimStartToPlayhead} disabled={!selectedClip} title="Recortar inicio al cabezal" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] disabled:opacity-30"><SkipBack size={12} className="mr-1 inline" />Trim inicio</button>
              <button onClick={trimEndToPlayhead} disabled={!selectedClip} title="Recortar fin al cabezal" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] disabled:opacity-30"><SkipForward size={12} className="mr-1 inline" />Trim fin</button>
              <button onClick={duplicateClip} disabled={!selectedClip} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] disabled:opacity-30"><Copy size={12} /></button>
              <button onClick={removeClip} disabled={!selectedClip} className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200 disabled:opacity-30"><Trash2 size={12} /></button>
              <span className="mx-1 h-5 w-px bg-white/10" />
              <button onClick={() => setSnapEnabled((value) => !value)} title="Snapping" className={`rounded-lg border px-2 py-1 text-[10px] ${snapEnabled ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-200" : "border-white/10 bg-white/5"}`}><Magnet size={12} /></button>
              <button onClick={() => setZoom((value) => clamp(value / 1.25, 0.35, 4))} className="rounded-lg border border-white/10 bg-white/5 p-1.5"><ZoomOut size={12} /></button>
              <span className="w-10 text-center text-[9px] text-slate-400">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((value) => clamp(value * 1.25, 0.35, 4))} className="rounded-lg border border-white/10 bg-white/5 p-1.5"><ZoomIn size={12} /></button>
              <button onClick={() => addAudioTrack("audio")} title="Añadir pista de audio" className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[9px] text-violet-100">+ Audio</button>
              <button onClick={() => addAudioTrack("music")} title="Añadir pista de música" className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-100">+ Música</button>
              <label title="Escala vertical de la onda" className="flex items-center gap-1 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[9px] text-violet-100">Onda<select value={waveformScale} onChange={(event) => setWaveformScale(Number(event.target.value))} className="bg-transparent text-[9px] outline-none"><option className="bg-[#0b1020]" value={0.5}>0.5×</option><option className="bg-[#0b1020]" value={1}>1×</option><option className="bg-[#0b1020]" value={2}>2×</option><option className="bg-[#0b1020]" value={4}>4×</option></select></label>
              <button onClick={() => setTimelineTail((value) => Math.min(120, value + 10))} title="Añadir espacio al final" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px]">+10s</button>
            </div>
            <p className="mb-2 text-[9px] text-slate-500">Clic en la regla o pista = mover cabezal · Centro = mover · Bordes = recortar · Puntos turquesa = fade-in/fade-out · Onda = escala vertical · S = dividir.</p>

            <div ref={timelineScrollRef} className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
              <div className="relative" style={{ width: 118 + timelineWidth, minHeight: 40 + project.tracks.length * 58 }}>
                <div className="sticky left-0 z-30 h-8 w-[118px] border-r border-white/10 bg-[#090d19]" />
                <div className="absolute left-[118px] top-0 h-8 border-b border-white/10" style={{ width: timelineWidth }} onPointerDown={setPlayheadFromTimeline}>
                  {Array.from({ length: Math.ceil(timelineSpan) + 1 }).map((_, second) => <div key={second} className="absolute bottom-0 border-l border-white/10 pl-1 text-[8px] text-slate-500" style={{ left: second * pixelsPerSecond, height: second % 5 === 0 ? 22 : 10 }}>{second % 5 === 0 ? `${second}s` : ""}</div>)}
                </div>
                <div className="pointer-events-none absolute bottom-0 top-0 z-40 w-px bg-rose-400" style={{ left: 118 + playhead * pixelsPerSecond }} />

                <div className="absolute left-0 top-8">
                  {project.tracks.map((track, trackIndex) => <div key={track.id} className="relative h-[58px]" style={{ width: 118 + timelineWidth }}>
                    <div className="sticky left-0 z-30 flex h-[54px] w-[118px] items-center gap-2 border-r border-white/10 bg-[#090d19] px-2 text-[10px] text-slate-300">{trackIcon(track.kind)}<span className="truncate">{track.name}</span></div>
                    <div className="absolute left-[118px] top-0 h-[54px] border-b border-white/5 bg-white/[0.02]" style={{ width: timelineWidth }} onPointerDown={setPlayheadFromTimeline} onPointerMove={handlePointerMove} onPointerUp={endPointerAction} onPointerCancel={endPointerAction}>
                      {track.clips.map((clip) => {
                        const asset = clip.assetId ? assetMap.get(clip.assetId) : undefined;
                        return <div key={clip.id} onPointerDown={(event) => beginPointerAction(event, { mode: "move", clipId: clip.id, pointerId: event.pointerId, startX: event.clientX, originalStart: clip.start })} className={`group absolute top-1 h-[46px] touch-none select-none overflow-hidden rounded-lg border ${TRACK_STYLES[track.kind]} ${selectedClipId === clip.id ? "ring-2 ring-white/80" : ""} ${pointerAction?.clipId === clip.id && pointerAction.mode === "move" ? "cursor-grabbing" : "cursor-grab"}`} style={{ left: clip.start * pixelsPerSecond, width: Math.max(18, clip.duration * pixelsPerSecond) }}>
                          <button aria-label="Recortar inicio" onPointerDown={(event) => beginPointerAction(event, { mode: "trim-left", clipId: clip.id, pointerId: event.pointerId, startX: event.clientX, originalStart: clip.start, originalDuration: clip.duration, originalOffset: clip.offset })} className="absolute bottom-0 left-0 top-0 z-20 w-3 cursor-ew-resize touch-none border-r border-white/15 bg-white/5 opacity-60 hover:bg-white/30 hover:opacity-100" />
                          <button aria-label="Recortar fin" onPointerDown={(event) => beginPointerAction(event, { mode: "trim-right", clipId: clip.id, pointerId: event.pointerId, startX: event.clientX, originalDuration: clip.duration })} className="absolute bottom-0 right-0 top-0 z-20 w-3 cursor-ew-resize touch-none border-l border-white/15 bg-white/5 opacity-60 hover:bg-white/30 hover:opacity-100" />
                          {asset?.url && (track.kind === "audio" || track.kind === "music") ? <>
                            <AudioWaveformCanvas url={asset.url} offset={clip.offset} duration={clip.duration} amplitudeScale={waveformScale} />
                            <div className="pointer-events-none absolute bottom-0 left-0 top-0 bg-current opacity-10" style={{ width: `${Math.min(50, ((clip.audioFadeIn || 0) / Math.max(0.05, clip.duration)) * 100)}%`, clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }} />
                            <div className="pointer-events-none absolute bottom-0 right-0 top-0 bg-current opacity-10" style={{ width: `${Math.min(50, ((clip.audioFadeOut || 0) / Math.max(0.05, clip.duration)) * 100)}%`, clipPath: "polygon(0 0, 100% 100%, 0 100%)" }} />
                            <button aria-label="Fade de entrada" title={`Fade entrada ${fmt(clip.audioFadeIn || 0)}`} onPointerDown={(event) => beginPointerAction(event, { mode: "fade-in", clipId: clip.id, pointerId: event.pointerId, startX: event.clientX, originalFade: clip.audioFadeIn || 0 })} className="absolute top-1 z-30 h-3 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-[#07111f] bg-cyan-300 shadow" style={{ left: `clamp(8px, ${Math.min(50, ((clip.audioFadeIn || 0) / Math.max(0.05, clip.duration)) * 100)}%, calc(100% - 8px))` }} />
                            <button aria-label="Fade de salida" title={`Fade salida ${fmt(clip.audioFadeOut || 0)}`} onPointerDown={(event) => beginPointerAction(event, { mode: "fade-out", clipId: clip.id, pointerId: event.pointerId, startX: event.clientX, originalFade: clip.audioFadeOut || 0 })} className="absolute top-1 z-30 h-3 w-3 translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-[#07111f] bg-cyan-300 shadow" style={{ right: `clamp(8px, ${Math.min(50, ((clip.audioFadeOut || 0) / Math.max(0.05, clip.duration)) * 100)}%, calc(100% - 8px))` }} />
                          </> : null}
                          <div className="pointer-events-none relative z-10 flex h-full items-center gap-1 px-4"><span className="truncate text-[9px] font-medium">{clip.clipType === "text" ? clip.textStyle?.text : asset?.name || "Recurso faltante"}</span>{clip.keyframes.length > 0 && <span className="ml-auto rounded bg-black/30 px-1 text-[8px]">◆{clip.keyframes.length}</span>}</div>
                        </div>;
                      })}
                    </div>
                    {trackIndex === project.tracks.length - 1 ? null : null}
                  </div>)}
                </div>
              </div>
            </div>
          </section>

          <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] text-slate-300">{notice}</div>
        </main>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="mb-3 flex items-center gap-2"><Sparkles size={15} className="text-cyan-300" /><p className="text-xs font-semibold">Inspector</p></div>
          {!selectedClip ? <div className="py-16 text-center text-xs text-slate-500">Selecciona un clip. Luego puedes moverlo, recortarlo, dividirlo y editar sus propiedades.</div> : <div className="space-y-4 text-[10px]">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="truncate font-semibold text-slate-200">{selectedClip.clipType === "text" ? selectedClip.textStyle?.text : selectedAsset?.name || "Recurso"}</p><p className="mt-1 text-slate-500">{selectedClip.trackId} · {fmt(selectedClip.start)} → {fmt(selectedClip.start + selectedClip.duration)}</p></div>

            <div className="grid grid-cols-2 gap-2">
              <label>Inicio<input type="number" step="0.05" min={0} value={Number(selectedClip.start.toFixed(2))} onChange={(event) => updateClip(selectedClip.id, { start: Math.max(0, Number(event.target.value)) })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5" /></label>
              <label>Duración<input type="number" step="0.05" min={0.05} value={Number(selectedClip.duration.toFixed(2))} onChange={(event) => updateClip(selectedClip.id, { duration: Math.max(0.05, Math.min(Number(event.target.value), sourceMaxDuration(selectedClip))) })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5" /></label>
            </div>
            <div className="grid grid-cols-3 gap-1"><button onClick={trimStartToPlayhead} className="rounded-lg bg-white/5 px-2 py-1.5">Trim inicio</button><button onClick={splitClip} className="rounded-lg bg-cyan-500/15 px-2 py-1.5 text-cyan-100">Dividir</button><button onClick={trimEndToPlayhead} className="rounded-lg bg-white/5 px-2 py-1.5">Trim fin</button></div>

            {selectedClip.clipType === "media" && <label>Offset / recorte de fuente · {fmt(selectedClip.offset)}<input type="range" min={0} max={Math.max(0, (selectedAsset?.duration || selectedClip.duration) - 0.05)} step={0.01} value={Math.min(selectedClip.offset, Math.max(0, (selectedAsset?.duration || selectedClip.duration) - 0.05))} onChange={(event) => updateClip(selectedClip.id, { offset: Number(event.target.value) })} className="mt-1 w-full accent-cyan-500" /></label>}

            {selectedTrack && (selectedTrack.kind === "audio" || selectedTrack.kind === "music" || selectedTrack.kind === "video") && <div className="space-y-3 rounded-xl border border-violet-400/15 bg-violet-500/5 p-3">
              <label>Volumen · {Math.round(selectedClip.volume * 100)}%<input type="range" min={0} max={1} step={0.01} value={selectedClip.volume} onChange={(event) => updateClip(selectedClip.id, { volume: Number(event.target.value) })} className="w-full accent-violet-500" /></label>
              {(selectedTrack.kind === "audio" || selectedTrack.kind === "music") && <>
                <label className="block">Pista<select value={selectedClip.trackId} onChange={(event) => moveClipToTrack(selectedClip.id, event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-1.5">{project.tracks.filter((track) => track.kind === selectedTrack.kind).map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label>
                <div className="grid grid-cols-2 gap-2">
                  <label>Fade entrada · {fmt(selectedClip.audioFadeIn || 0)}<input type="range" min={0} max={Math.max(0.05, selectedClip.duration / 2)} step={0.05} value={selectedClip.audioFadeIn || 0} onChange={(event) => updateClip(selectedClip.id, { audioFadeIn: Number(event.target.value) })} className="w-full accent-cyan-400" /></label>
                  <label>Fade salida · {fmt(selectedClip.audioFadeOut || 0)}<input type="range" min={0} max={Math.max(0.05, selectedClip.duration / 2)} step={0.05} value={selectedClip.audioFadeOut || 0} onChange={(event) => updateClip(selectedClip.id, { audioFadeOut: Number(event.target.value) })} className="w-full accent-cyan-400" /></label>
                </div>
              </>}
              <div className="flex flex-wrap gap-2"><button onClick={() => updateClip(selectedClip.id, { muted: !selectedClip.muted })} className={`rounded-lg px-2 py-1 ${selectedClip.muted ? "bg-rose-500/20 text-rose-200" : "bg-white/5"}`}>{selectedClip.muted ? "Silenciado" : "Audio activo"}</button>{selectedAsset?.kind === "video" && <button disabled={extractingAudio} onClick={separateSelectedVideoAudio} className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-cyan-100 disabled:opacity-50"><AudioLines size={11} className="mr-1 inline" />{extractingAudio ? "Separando…" : "Separar audio"}</button>}</div>
            </div>}

            {selectedClip.clipType === "text" && selectedClip.textStyle && <div className="space-y-2 rounded-xl border border-amber-400/15 bg-amber-500/5 p-3"><p className="font-semibold text-amber-200">Texto</p><textarea value={selectedClip.textStyle.text} onChange={(event) => updateClip(selectedClip.id, { textStyle: { ...selectedClip.textStyle!, text: event.target.value } })} rows={3} className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" /><div className="grid grid-cols-2 gap-2"><label>Tamaño<input type="number" min={10} max={240} value={selectedClip.textStyle.fontSize} onChange={(event) => updateClip(selectedClip.id, { textStyle: { ...selectedClip.textStyle!, fontSize: Number(event.target.value) } })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1" /></label><label>Color<input type="color" value={selectedClip.textStyle.color} onChange={(event) => updateClip(selectedClip.id, { textStyle: { ...selectedClip.textStyle!, color: event.target.value } })} className="mt-1 h-7 w-full rounded bg-transparent" /></label></div></div>}

            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3"><p className="font-semibold">Transformación</p><div className="grid grid-cols-2 gap-2"><label>X<input type="number" value={selectedClip.transform.x} onChange={(event) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, x: Number(event.target.value) } })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-1" /></label><label>Y<input type="number" value={selectedClip.transform.y} onChange={(event) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, y: Number(event.target.value) } })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-1" /></label></div><label>Escala · {selectedClip.transform.scale.toFixed(2)}×<input type="range" min={0.2} max={3} step={0.01} value={selectedClip.transform.scale} onChange={(event) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, scale: Number(event.target.value) } })} className="w-full accent-cyan-500" /></label><label>Rotación · {selectedClip.transform.rotation.toFixed(0)}°<input type="range" min={-180} max={180} step={1} value={selectedClip.transform.rotation} onChange={(event) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, rotation: Number(event.target.value) } })} className="w-full accent-cyan-500" /></label><label>Opacidad · {Math.round(selectedClip.opacity * 100)}%<input type="range" min={0} max={1} step={0.01} value={selectedClip.opacity} onChange={(event) => updateClip(selectedClip.id, { opacity: Number(event.target.value) })} className="w-full accent-cyan-500" /></label></div>

            {selectedClip.clipType === "media" && (selectedAsset?.kind === "video" || selectedAsset?.kind === "image") && <div className="space-y-2 rounded-xl border border-fuchsia-400/15 bg-fuchsia-500/5 p-3"><p className="font-semibold text-fuchsia-200">Filtros</p>{([[
              "brightness", "Brillo", 0, 2, 0.01], ["contrast", "Contraste", 0, 2, 0.01], ["saturation", "Saturación", 0, 2, 0.01], ["blur", "Desenfoque", 0, 16, 0.1], ["grayscale", "B/N", 0, 1, 0.01], ["sepia", "Sepia", 0, 1, 0.01],
            ] as const).map(([key, label, min, max, step]) => <label key={key}>{label}<input type="range" min={min} max={max} step={step} value={selectedClip.filter[key]} onChange={(event) => updateClip(selectedClip.id, { filter: { ...selectedClip.filter, [key]: Number(event.target.value) } })} className="w-full accent-fuchsia-500" /></label>)}</div>}

            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3"><p className="font-semibold">Transiciones / fades</p><div className="grid grid-cols-2 gap-2"><label>Entrada<select value={selectedClip.transitionIn} onChange={(event) => updateClip(selectedClip.id, { transitionIn: event.target.value as TransitionKind })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-1 py-1">{TRANSITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Salida<select value={selectedClip.transitionOut} onChange={(event) => updateClip(selectedClip.id, { transitionOut: event.target.value as TransitionKind })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-1 py-1">{TRANSITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div><label>Duración · {selectedClip.transitionDuration.toFixed(2)} s<input type="range" min={0.05} max={Math.max(0.1, selectedClip.duration / 2)} step={0.05} value={selectedClip.transitionDuration} onChange={(event) => updateClip(selectedClip.id, { transitionDuration: Number(event.target.value) })} className="w-full accent-amber-500" /></label></div>

            <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/5 p-3"><div className="flex items-center justify-between"><p className="font-semibold text-cyan-200">Keyframes</p><button onClick={addKeyframe} className="rounded-lg bg-cyan-500/15 px-2 py-1">+ actual</button></div><div className="mt-2 flex flex-wrap gap-1">{selectedClip.keyframes.map((frame) => <button key={frame.id} onClick={() => setPlayhead(selectedClip.start + frame.time)} onDoubleClick={() => updateClip(selectedClip.id, { keyframes: selectedClip.keyframes.filter((item) => item.id !== frame.id) })} className="rounded bg-black/25 px-1.5 py-1 text-[8px]">◆ {fmt(frame.time)}</button>)}</div></div>

            {selectedAsset?.downloadUrl && <button onClick={() => window.open(selectedAsset.downloadUrl, "_blank", "noopener,noreferrer")} className="w-full rounded-xl border border-white/10 bg-white/5 p-2"><Download size={13} className="mr-1 inline" />Abrir/guardar archivo fuente</button>}
          </div>}
        </aside>
      </div>
    </div>
  );
}
