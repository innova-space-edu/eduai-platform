"use client";

import Link from "next/link";
import {
  ArrowLeft,
  AudioLines,
  Captions,
  Copy,
  Download,
  Film,
  FolderOpen,
  ImageIcon,
  KeyRound,
  Music2,
  Pause,
  Play,
  Plus,
  Save,
  Scissors,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Volume2,
} from "lucide-react";
import { toPng } from "html-to-image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildWaveform, exportProjectWav } from "@/lib/multimedia/audio";
import { downloadBlob, exportProjectVideo, supportedVideoFormats, type ExportFormat } from "@/lib/multimedia/export-media";
import {
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

type Tab = "files" | "gallery" | "music" | "text" | "project";

const TRACK_ACCENTS: Record<string, string> = {
  video: "bg-cyan-500/20 border-cyan-400/40 text-cyan-100",
  overlay: "bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-100",
  text: "bg-amber-500/20 border-amber-400/40 text-amber-100",
  audio: "bg-violet-500/20 border-violet-400/40 text-violet-100",
  music: "bg-emerald-500/20 border-emerald-400/40 text-emerald-100",
};

const TRANSITIONS: { value: TransitionKind; label: string }[] = [
  { value: "none", label: "Sin transición" },
  { value: "fade", label: "Fundido" },
  { value: "slide-left", label: "Deslizar izquierda" },
  { value: "slide-right", label: "Deslizar derecha" },
];

function id(prefix: string) {
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
      if (!text || end <= start) return null;
      return { start, duration: end - start, text };
    })
    .filter((item): item is { start: number; duration: number; text: string } => Boolean(item));
}

async function probeDuration(url: string, kind: "video" | "audio") {
  const element = document.createElement(kind);
  element.preload = "metadata";
  element.src = url;
  return new Promise<number>((resolve) => {
    const finish = () => {
      const duration = Number.isFinite(element.duration) ? element.duration : 10;
      element.removeAttribute("src");
      element.load();
      resolve(Math.max(0.5, duration));
    };
    element.onloadedmetadata = finish;
    element.onerror = () => resolve(10);
  });
}

function downloadJson(project: MultimediaProject, assets: MediaAsset[]) {
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

function clipVisualStyle(clip: TimelineClip, playhead: number, width: number) {
  const local = Math.max(0, playhead - clip.start);
  const animated = interpolateClip(clip, local);
  const transition = transitionFactor(clip, local);
  const slideX = transition.slide * width;
  return {
    opacity: clamp(animated.opacity * transition.opacity, 0, 1),
    transform: `translate(${animated.transform.x + slideX}px, ${animated.transform.y}px) scale(${animated.transform.scale}) rotate(${animated.transform.rotation}deg)`,
    filter: `brightness(${clip.filter.brightness}) contrast(${clip.filter.contrast}) saturate(${clip.filter.saturation}) blur(${clip.filter.blur}px) grayscale(${clip.filter.grayscale}) sepia(${clip.filter.sepia})`,
  };
}

export default function MultimediaStudioClient() {
  const [project, setProject] = useState<MultimediaProject>(() => makeProject());
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>("files");
  const [musicQuery, setMusicQuery] = useState("música instrumental para estudiar");
  const [musicResults, setMusicResults] = useState<MusicResult[]>([]);
  const [searchingMusic, setSearchingMusic] = useState(false);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const [notice, setNotice] = useState("Carga archivos, usa Galería o busca música y agrégalos a la línea de tiempo.");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("mp4");
  const [draggingClip, setDraggingClip] = useState<string | null>(null);
  const videoRefMap = useRef<Map<string, HTMLVideoElement>>(new Map());
  const previewAudio = useRef<Map<string, HTMLAudioElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const playbackAnchor = useRef({ playhead: 0, time: 0 });
  const assetsRef = useRef<MediaAsset[]>([]);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const duration = useMemo(() => projectDuration(project), [project]);
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const clips = useMemo(() => project.tracks.flatMap((track) => track.clips), [project]);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || null;
  const selectedAsset = selectedClip?.assetId ? assetMap.get(selectedClip.assetId) : undefined;
  const formatSupport = useMemo(() => supportedVideoFormats(), []);

  useEffect(() => { assetsRef.current = assets; }, [assets]);

  useEffect(() => {
    const saved = window.localStorage.getItem("eduai.multimedia.draft.v2");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setProject(normalizeProject(parsed.project));
      const safeAssets = Array.isArray(parsed.assets)
        ? parsed.assets.map((asset: MediaAsset) => asset.local ? { ...asset, url: "", missing: true } : asset)
        : [];
      setAssets(safeAssets);
      if (safeAssets.some((asset: MediaAsset) => asset.missing)) setNotice("Se recuperó el borrador. Vuelve a cargar los archivos locales marcados como faltantes.");
      else setNotice("Se recuperó automáticamente el último borrador local.");
    } catch {
      window.localStorage.removeItem("eduai.multimedia.draft.v2");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const safeAssets = assets.map((asset) => asset.local ? { ...asset, url: "", missing: true } : asset);
      window.localStorage.setItem("eduai.multimedia.draft.v2", JSON.stringify({ project, assets: safeAssets }));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [assets, project]);

  useEffect(() => () => {
    assetsRef.current.forEach((asset) => {
      if (asset.local && asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
    });
    previewAudio.current.forEach((audio) => audio.pause());
  }, []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    playbackAnchor.current = { playhead, time: performance.now() };
    const tick = () => {
      const elapsed = (performance.now() - playbackAnchor.current.time) / 1000;
      const next = playbackAnchor.current.playhead + elapsed;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);

  useEffect(() => {
    for (const clip of clips.filter((item) => item.clipType === "media" && item.assetId)) {
      const asset = assetMap.get(clip.assetId!);
      if (!asset?.url || asset.kind !== "video") continue;
      const video = videoRefMap.current.get(clip.id);
      if (!video) continue;
      const active = playhead >= clip.start && playhead < clip.start + clip.duration;
      if (!active) { video.pause(); continue; }
      const wanted = clip.offset + playhead - clip.start;
      if (Math.abs(video.currentTime - wanted) > 0.22) video.currentTime = Math.max(0, wanted);
      const animated = interpolateClip(clip, playhead - clip.start);
      video.volume = clip.muted ? 0 : clamp(animated.volume, 0, 1);
      video.muted = clip.muted;
      if (playing) void video.play().catch(() => undefined);
      else video.pause();
    }
  }, [assetMap, clips, playhead, playing]);

  useEffect(() => {
    const activeIds = new Set<string>();
    for (const track of project.tracks.filter((item) => item.kind === "audio" || item.kind === "music")) {
      for (const clip of track.clips) {
        const isActive = playhead >= clip.start && playhead < clip.start + clip.duration;
        const asset = clip.assetId ? assetMap.get(clip.assetId) : undefined;
        if (!isActive || !asset?.url) continue;
        activeIds.add(clip.id);
        let audio = previewAudio.current.get(clip.id);
        if (!audio) {
          audio = new Audio(asset.url);
          audio.preload = "auto";
          if (asset.url.startsWith("http")) audio.crossOrigin = "anonymous";
          previewAudio.current.set(clip.id, audio);
        }
        const wanted = clip.offset + playhead - clip.start;
        if (Math.abs(audio.currentTime - wanted) > 0.25) audio.currentTime = Math.max(0, wanted);
        const animated = interpolateClip(clip, playhead - clip.start);
        const transition = transitionFactor(clip, playhead - clip.start);
        audio.volume = clip.muted ? 0 : clamp(animated.volume * transition.opacity, 0, 1);
        if (playing) void audio.play().catch(() => undefined);
        else audio.pause();
      }
    }
    previewAudio.current.forEach((audio, clipId) => { if (!activeIds.has(clipId)) audio.pause(); });
  }, [assetMap, playhead, playing, project]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;
      if (event.code === "Space") { event.preventDefault(); setPlaying((value) => !value); }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedClipId) removeClip();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedClip) { event.preventDefault(); duplicateClip(); }
      if (event.key.toLowerCase() === "s" && selectedClip && !event.ctrlKey && !event.metaKey) splitClip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    if (tab !== "gallery" || gallery.length || galleryLoading) return;
    void loadGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function mutateProject(updater: (current: MultimediaProject) => MultimediaProject) {
    setProject((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }));
  }

  function updateClip(clipId: string, patch: Partial<TimelineClip>) {
    mutateProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => clip.id === clipId ? { ...clip, ...patch } : clip),
      })),
    }));
  }

  function targetTrackId(asset: MediaAsset) {
    if (asset.kind === "video") return "video-main";
    if (asset.kind === "image") return "overlay-main";
    if (asset.kind === "music") return "music-main";
    return "audio-main";
  }

  function addAssetToTimeline(asset: MediaAsset) {
    if (!asset.url) {
      setNotice("Este recurso no está disponible localmente. Vuelve a cargarlo o usa una fuente accesible.");
      return;
    }
    const trackId = targetTrackId(asset);
    const clip = createMediaClip(asset, trackId, playhead);
    mutateProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track),
    }));
    setSelectedClipId(clip.id);
    setNotice(`${asset.name} agregado en ${fmt(playhead)}.`);
  }

  async function createAssetsFromFiles(files: File[]) {
    const incoming: MediaAsset[] = [];
    for (const file of files) {
      if (!file.type.startsWith("video/") && !file.type.startsWith("audio/") && !file.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(file);
      const kind: MediaAsset["kind"] = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image";
      const mediaDuration = kind === "image" ? 5 : await probeDuration(url, kind);
      const previousMissing = assets.find((asset) => asset.missing && asset.name === file.name && asset.kind === kind);
      if (previousMissing) {
        setAssets((current) => current.map((asset) => asset.id === previousMissing.id ? { ...asset, url, duration: mediaDuration, missing: false, local: true } : asset));
        continue;
      }
      incoming.push({ id: id("asset"), name: file.name, kind, url, duration: mediaDuration, source: "local", exportable: true, local: true });
    }
    if (incoming.length) setAssets((current) => [...current, ...incoming]);
    const waveformTargets = incoming.filter((asset) => asset.kind === "audio");
    waveformTargets.forEach((asset) => void generateWaveform(asset));
    setNotice(`${files.length} archivo(s) procesado(s). Usa + para agregarlos a la línea de tiempo.`);
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []) as File[];
    if (files.length) await createAssetsFromFiles(files);
    event.target.value = "";
  }

  async function handleDropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []) as File[];
    if (files.length) await createAssetsFromFiles(files);
  }

  async function generateWaveform(asset: MediaAsset) {
    if (!asset.url || waveforms[asset.id]) return;
    try {
      const peaks = await buildWaveform(asset.url, 100);
      setWaveforms((current) => ({ ...current, [asset.id]: peaks }));
    } catch {
      // CORS o formato no decodificable: el clip sigue siendo usable sin waveform.
    }
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

  function importGalleryImage(image: GalleryImage) {
    const asset: MediaAsset = {
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

  async function searchMusic() {
    if (!musicQuery.trim()) return;
    setSearchingMusic(true);
    setNotice("Buscando en las fuentes musicales disponibles…");
    try {
      const response = await fetch(`/api/music/search?query=${encodeURIComponent(musicQuery.trim())}&limit=18`);
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || "No se pudo buscar música");
      setMusicResults(data.tracks || []);
      setNotice(`${(data.tracks || []).length} resultados encontrados. YouTube permanece como vista previa oficial y no se descarga.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo buscar música.");
    } finally {
      setSearchingMusic(false);
    }
  }

  function importMusic(result: MusicResult) {
    if (!result.src) {
      if (result.externalUrl) window.open(result.externalUrl, "_blank", "noopener,noreferrer");
      setNotice("Este resultado solo admite reproducción externa y no puede convertirse en archivo desde EDUAI.");
      return;
    }
    const asset: MediaAsset = {
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
    void generateWaveform(asset);
  }

  function addText() {
    const clip = createTextClip(playhead, "Escribe aquí");
    mutateProject((current) => ({
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
    mutateProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === "text-main" ? { ...track, clips: [...track.clips, ...newClips] } : track),
    }));
    setNotice(`${newClips.length} subtítulos importados desde ${file.name}.`);
  }

  function removeClip() {
    if (!selectedClipId) return;
    mutateProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({ ...track, clips: track.clips.filter((clip) => clip.id !== selectedClipId) })),
    }));
    setSelectedClipId(null);
  }

  function duplicateClip() {
    if (!selectedClip) return;
    const clone = { ...selectedClip, id: id("clip"), start: selectedClip.start + 0.5, keyframes: selectedClip.keyframes.map((frame) => ({ ...frame, id: id("kf") })) };
    mutateProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === clone.trackId ? { ...track, clips: [...track.clips, clone] } : track),
    }));
    setSelectedClipId(clone.id);
  }

  function splitClip() {
    if (!selectedClip) return;
    const local = playhead - selectedClip.start;
    if (local <= 0.1 || local >= selectedClip.duration - 0.1) { setNotice("Ubica el cabezal dentro del clip para dividirlo."); return; }
    const left = { ...selectedClip, duration: local, keyframes: selectedClip.keyframes.filter((frame) => frame.time <= local) };
    const right: TimelineClip = {
      ...selectedClip,
      id: id("clip"),
      start: playhead,
      duration: selectedClip.duration - local,
      offset: selectedClip.offset + (selectedClip.clipType === "media" ? local : 0),
      keyframes: selectedClip.keyframes.filter((frame) => frame.time >= local).map((frame) => ({ ...frame, id: id("kf"), time: frame.time - local })),
    };
    mutateProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === selectedClip.trackId ? {
        ...track,
        clips: track.clips.flatMap((clip) => clip.id === selectedClip.id ? [left, right] : [clip]),
      } : track),
    }));
    setSelectedClipId(right.id);
  }

  function moveClipFromDrop(event: DragEvent<HTMLDivElement>, trackId: string) {
    event.preventDefault();
    const clipId = event.dataTransfer.getData("text/eduai-clip") || draggingClip;
    if (!clipId) return;
    const clip = clips.find((item) => item.id === clipId);
    if (!clip || clip.trackId !== trackId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const start = clamp(((event.clientX - rect.left) / rect.width) * duration, 0, Math.max(0, duration - clip.duration));
    updateClip(clip.id, { start });
    setDraggingClip(null);
  }

  function beginTrim(event: ReactPointerEvent<HTMLButtonElement>, clip: TimelineClip, side: "left" | "right") {
    event.stopPropagation();
    event.preventDefault();
    const startX = event.clientX;
    const initial = { start: clip.start, duration: clip.duration, offset: clip.offset };
    const trackElement = event.currentTarget.closest("[data-timeline-track]") as HTMLElement | null;
    const width = trackElement?.getBoundingClientRect().width || 800;
    const secondsPerPixel = duration / Math.max(1, width);
    const move = (pointer: PointerEvent) => {
      const delta = (pointer.clientX - startX) * secondsPerPixel;
      if (side === "left") {
        const maxDelta = initial.duration - 0.25;
        const applied = clamp(delta, -initial.start, maxDelta);
        updateClip(clip.id, {
          start: initial.start + applied,
          duration: initial.duration - applied,
          offset: clip.clipType === "media" ? Math.max(0, initial.offset + applied) : initial.offset,
        });
      } else {
        updateClip(clip.id, { duration: Math.max(0.25, initial.duration + delta) });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  function addKeyframe() {
    if (!selectedClip) return;
    const local = clamp(playhead - selectedClip.start, 0, selectedClip.duration);
    const frame = {
      id: id("kf"),
      time: local,
      opacity: selectedClip.opacity,
      volume: selectedClip.volume,
      transform: { ...selectedClip.transform },
    };
    updateClip(selectedClip.id, { keyframes: [...selectedClip.keyframes.filter((item) => Math.abs(item.time - local) > 0.05), frame].sort((a, b) => a.time - b.time) });
    setNotice(`Keyframe agregado en ${fmt(local)} dentro del clip.`);
  }

  async function loadProjectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const nextProject = normalizeProject(parsed.project || parsed);
      const nextAssets = Array.isArray(parsed.assets)
        ? parsed.assets.map((asset: MediaAsset) => asset.local || !asset.url ? { ...asset, url: "", missing: true } : asset)
        : [];
      setProject(nextProject);
      setAssets(nextAssets);
      setSelectedClipId(null);
      setPlayhead(0);
      setNotice("Proyecto cargado. Los archivos locales deben volver a enlazarse por nombre.");
    } catch {
      setNotice("El archivo no es un proyecto EDUAI Multimedia válido.");
    }
  }

  async function exportVideo() {
    if (!clips.length) { setNotice("Agrega al menos un clip antes de exportar."); return; }
    setExporting(true);
    setExportProgress(0);
    setPlaying(false);
    setNotice(`Exportando ${exportFormat.toUpperCase()} en tiempo real dentro del navegador…`);
    try {
      const result = await exportProjectVideo(project, assets, { format: exportFormat, onProgress: setExportProgress });
      downloadBlob(result.blob, `${safeFilename(project.title)}.${result.format}`);
      const fallback = result.format !== exportFormat ? ` ${exportFormat.toUpperCase()} no está disponible en este navegador; se exportó ${result.format.toUpperCase()}.` : "";
      const warnings = result.warnings.length ? ` Advertencias: ${result.warnings.slice(0, 2).join(" ")}` : "";
      setNotice(`Video exportado correctamente.${fallback}${warnings}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo exportar el video.");
    } finally {
      setExporting(false);
    }
  }

  async function exportWav() {
    setExporting(true);
    setNotice("Mezclando pistas de audio a WAV…");
    try {
      const blob = await exportProjectWav(project, assets);
      downloadBlob(blob, `${safeFilename(project.title)}.wav`);
      setNotice("Mezcla WAV exportada correctamente.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo exportar WAV. Algunas fuentes remotas pueden bloquear CORS.");
    } finally {
      setExporting(false);
    }
  }

  async function exportFramePng() {
    if (!previewRef.current) return;
    try {
      const dataUrl = await toPng(previewRef.current, { cacheBust: true, pixelRatio: 2 });
      const response = await fetch(dataUrl);
      downloadBlob(await response.blob(), `${safeFilename(project.title)}-${Math.round(playhead * 10)}.png`);
      setNotice("Fotograma PNG exportado.");
    } catch {
      setNotice("No se pudo exportar el fotograma. Una imagen remota puede estar bloqueando CORS.");
    }
  }

  const visualTracks = project.tracks.filter((track) => track.kind === "video" || track.kind === "overlay" || track.kind === "text");
  const activeVisualClips = visualTracks.flatMap((track) => track.clips).filter((clip) => playhead >= clip.start && playhead < clip.start + clip.duration);

  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b18]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-2 px-3 py-2 lg:px-5">
          <Link href="/agentes" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"><ArrowLeft size={17} /></Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600"><Film size={18} /></div>
          <div className="min-w-[180px] flex-1">
            <input value={project.title} onChange={(event) => setProject((current) => ({ ...current, title: event.target.value }))} className="w-full bg-transparent text-sm font-semibold outline-none" />
            <p className="text-[10px] text-slate-400">Editor Multimedia · {project.width}×{project.height} · {project.fps} fps · {fmt(duration)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => downloadJson(project, assets)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"><Save size={14} className="mr-1 inline" />Proyecto</button>
            <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)} className="rounded-xl border border-white/10 bg-[#0b1020] px-2 py-2 text-xs">
              <option value="mp4">MP4{formatSupport.mp4 ? "" : " (fallback WebM)"}</option>
              <option value="webm">WebM</option>
            </select>
            <button disabled={exporting} onClick={exportVideo} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold hover:bg-cyan-500 disabled:opacity-50"><Download size={14} className="mr-1 inline" />{exporting ? `${Math.round(exportProgress * 100)}%` : "Exportar video"}</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1800px] gap-3 p-3 xl:grid-cols-[310px_minmax(0,1fr)_300px]">
        <aside className="min-h-[520px] rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="mb-3 grid grid-cols-5 gap-1 rounded-xl bg-black/20 p-1">
            {([
              ["files", FolderOpen, "Archivos"],
              ["gallery", ImageIcon, "Galería"],
              ["music", Music2, "Música"],
              ["text", Captions, "Texto"],
              ["project", Save, "Proyecto"],
            ] as const).map(([value, Icon, label]) => (
              <button key={value} title={label} onClick={() => setTab(value)} className={`rounded-lg p-2 ${tab === value ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:bg-white/5"}`}><Icon size={16} className="mx-auto" /></button>
            ))}
          </div>

          {tab === "files" && (
            <div className="space-y-3">
              <label onDragOver={(event) => event.preventDefault()} onDrop={handleDropFiles} className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-500/5 p-5 text-center hover:bg-cyan-500/10">
                <Upload size={22} className="text-cyan-300" />
                <span className="text-xs font-semibold">Cargar o arrastrar archivos</span>
                <span className="text-[10px] text-slate-400">Video, audio e imágenes</span>
                <input type="file" multiple accept="video/*,audio/*,image/*" className="hidden" onChange={handleFiles} />
              </label>
              <div className="space-y-2">
                {assets.filter((asset) => asset.source === "local" || asset.missing).map((asset) => (
                  <div key={asset.id} className={`flex items-center gap-2 rounded-xl border p-2 ${asset.missing ? "border-amber-500/30 bg-amber-500/5" : "border-white/10 bg-black/20"}`}>
                    {asset.kind === "video" ? <Video size={15} /> : asset.kind === "audio" ? <AudioLines size={15} /> : <ImageIcon size={15} />}
                    <div className="min-w-0 flex-1"><p className="truncate text-[11px]">{asset.name}</p><p className="text-[9px] text-slate-500">{asset.missing ? "Falta volver a enlazar" : `${asset.kind} · ${fmt(asset.duration)}`}</p></div>
                    {!asset.missing && <button onClick={() => addAssetToTimeline(asset)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><Plus size={13} /></button>}
                  </div>
                ))}
                {!assets.some((asset) => asset.source === "local" || asset.missing) && <p className="py-8 text-center text-xs text-slate-500">Aún no hay archivos locales.</p>}
              </div>
            </div>
          )}

          {tab === "gallery" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold">Galería EduAI</p><button onClick={loadGallery} className="text-[10px] text-cyan-300">Actualizar</button></div>
              {galleryLoading ? <p className="py-8 text-center text-xs text-slate-500">Cargando…</p> : (
                <div className="grid grid-cols-2 gap-2">
                  {gallery.map((image) => (
                    <button key={image.id} onClick={() => importGalleryImage(image)} className="group overflow-hidden rounded-xl border border-white/10 bg-black/20 text-left">
                      <img src={image.image_url} alt={image.prompt} className="aspect-video w-full object-cover" />
                      <p className="line-clamp-2 p-2 text-[9px] text-slate-300 group-hover:text-white">{image.prompt}</p>
                    </button>
                  ))}
                </div>
              )}
              {!galleryLoading && !gallery.length && <p className="py-6 text-center text-xs text-slate-500">No hay imágenes guardadas.</p>}
              <Link href="/image-studio" className="block rounded-xl border border-white/10 bg-white/5 p-2 text-center text-xs hover:bg-white/10">Abrir Image Studio</Link>
            </div>
          )}

          {tab === "music" && (
            <div className="space-y-3">
              <div className="flex gap-2"><input value={musicQuery} onChange={(event) => setMusicQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchMusic(); }} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-cyan-500/50" /><button onClick={searchMusic} disabled={searchingMusic} className="rounded-xl bg-emerald-600 p-2 hover:bg-emerald-500"><Search size={15} /></button></div>
              <div className="space-y-2">
                {musicResults.map((result) => (
                  <div key={result.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
                    {result.artworkUrl ? <img src={result.artworkUrl} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15"><Music2 size={14} /></div>}
                    <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium">{result.title}</p><p className="truncate text-[9px] text-slate-500">{result.artist} · {result.source}</p></div>
                    <button onClick={() => importMusic(result)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><Plus size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "text" && (
            <div className="space-y-3">
              <button onClick={addText} className="w-full rounded-xl bg-amber-500/15 p-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"><Plus size={14} className="mr-1 inline" />Añadir texto</button>
              <label className="block cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 text-center text-xs hover:bg-white/10">Importar subtítulos SRT<input type="file" accept=".srt,text/plain" className="hidden" onChange={importSrt} /></label>
              <div className="space-y-2">
                {project.tracks.find((track) => track.kind === "text")?.clips.map((clip) => (
                  <button key={clip.id} onClick={() => { setSelectedClipId(clip.id); setPlayhead(clip.start); }} className={`w-full rounded-xl border p-2 text-left ${selectedClipId === clip.id ? "border-amber-400/50 bg-amber-500/10" : "border-white/10 bg-black/20"}`}>
                    <p className="line-clamp-2 text-[10px]">{clip.textStyle?.text}</p><p className="mt-1 text-[9px] text-slate-500">{fmt(clip.start)} · {fmt(clip.duration)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "project" && (
            <div className="space-y-3 text-xs">
              <label className="block">Resolución<select value={`${project.width}x${project.height}`} onChange={(event) => { const [width, height] = event.target.value.split("x").map(Number); setProject((current) => ({ ...current, width, height })); }} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2"><option value="1280x720">1280×720 · HD</option><option value="1920x1080">1920×1080 · Full HD</option><option value="1080x1920">1080×1920 · Vertical</option><option value="1080x1080">1080×1080 · Cuadrado</option></select></label>
              <label className="block">FPS<select value={project.fps} onChange={(event) => setProject((current) => ({ ...current, fps: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2"><option value={24}>24 fps</option><option value={30}>30 fps</option><option value={60}>60 fps</option></select></label>
              <button onClick={() => downloadJson(project, assets)} className="w-full rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"><Save size={14} className="mr-1 inline" />Guardar proyecto JSON</button>
              <label className="block cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 text-center hover:bg-white/10">Cargar proyecto JSON<input type="file" accept=".json,application/json" className="hidden" onChange={loadProjectFile} /></label>
              <button disabled={exporting} onClick={exportWav} className="w-full rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 text-violet-200 hover:bg-violet-500/15"><Volume2 size={14} className="mr-1 inline" />Exportar mezcla WAV</button>
              <button onClick={exportFramePng} className="w-full rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3 text-fuchsia-200 hover:bg-fuchsia-500/15"><ImageIcon size={14} className="mr-1 inline" />Exportar fotograma PNG</button>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[10px] leading-5 text-slate-400"><p className="font-semibold text-slate-200">Atajos</p><p>Espacio: reproducir/pausar</p><p>S: dividir clip</p><p>Ctrl/Cmd + D: duplicar</p><p>Supr: eliminar</p></div>
            </div>
          )}
        </aside>

        <main className="min-w-0 space-y-3">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-xs font-semibold">Monitor</p><p className="text-[10px] text-slate-500">{fmt(playhead)} / {fmt(duration)}</p></div><div className="flex gap-2"><Link href="/video-studio" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] hover:bg-white/10">Video Studio</Link><Link href="/audio-lab" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] hover:bg-white/10">Audio Lab</Link></div></div>
            <div className="flex justify-center rounded-2xl bg-black/50 p-2">
              <div ref={previewRef} className="relative aspect-video w-full max-w-[960px] overflow-hidden rounded-xl bg-[#050816]" style={{ aspectRatio: `${project.width}/${project.height}` }}>
                {activeVisualClips.map((clip) => {
                  const asset = clip.assetId ? assetMap.get(clip.assetId) : undefined;
                  const style = clipVisualStyle(clip, playhead, previewRef.current?.clientWidth || 800);
                  if (clip.clipType === "text" && clip.textStyle) {
                    return <div key={clip.id} className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ opacity: style.opacity }}><div style={{ transform: style.transform, color: clip.textStyle.color, background: clip.textStyle.backgroundColor, fontSize: `${Math.max(12, clip.textStyle.fontSize * 0.55)}px`, fontFamily: clip.textStyle.fontFamily, fontWeight: clip.textStyle.fontWeight, textAlign: clip.textStyle.align, WebkitTextStroke: clip.textStyle.strokeWidth ? `${clip.textStyle.strokeWidth}px ${clip.textStyle.strokeColor}` : undefined, maxWidth: "82%", whiteSpace: "pre-wrap", padding: "8px 14px" }}>{clip.textStyle.text}</div></div>;
                  }
                  if (!asset?.url) return null;
                  if (asset.kind === "video") {
                    return <video key={clip.id} ref={(node) => { if (node) videoRefMap.current.set(clip.id, node); else videoRefMap.current.delete(clip.id); }} src={asset.url} playsInline preload="auto" className="absolute inset-0 h-full w-full object-cover" style={{ ...style, transformOrigin: "center" }} />;
                  }
                  if (asset.kind === "image") return <img key={clip.id} src={asset.url} alt={asset.name} className="absolute inset-0 h-full w-full object-contain" style={{ ...style, transformOrigin: "center" }} />;
                  return null;
                })}
                {!activeVisualClips.length && <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600"><Film size={44} /><p className="mt-3 text-xs">Agrega video, imágenes o texto</p></div>}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3"><button onClick={() => setPlaying((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 hover:bg-cyan-500">{playing ? <Pause size={16} /> : <Play size={16} />}</button><input type="range" min={0} max={duration} step={0.01} value={playhead} onChange={(event) => { setPlaying(false); setPlayhead(Number(event.target.value)); }} className="flex-1 accent-cyan-500" /><span className="w-20 text-right text-[10px] text-slate-400">{fmt(playhead)}</span></div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2"><p className="mr-auto text-xs font-semibold">Línea de tiempo</p><button onClick={splitClip} disabled={!selectedClip} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] disabled:opacity-30"><Scissors size={12} className="mr-1 inline" />Dividir</button><button onClick={duplicateClip} disabled={!selectedClip} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] disabled:opacity-30"><Copy size={12} className="mr-1 inline" />Duplicar</button><button onClick={removeClip} disabled={!selectedClip} className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200 disabled:opacity-30"><Trash2 size={12} className="mr-1 inline" />Eliminar</button></div>
            <div className="relative overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-2">
              <div className="min-w-[760px]">
                <div className="mb-1 ml-[118px] flex h-5 items-end border-b border-white/10 text-[8px] text-slate-500">{Array.from({ length: 9 }).map((_, index) => <div key={index} className="flex-1 border-l border-white/10 pl-1">{fmt((duration * index) / 8)}</div>)}</div>
                <div className="relative">
                  <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-rose-400" style={{ left: `calc(118px + (100% - 118px) * ${playhead / duration})` }} />
                  {project.tracks.map((track) => (
                    <div key={track.id} className="mb-1 grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                      <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 text-[10px] text-slate-300">{track.kind === "video" ? <Video size={12} /> : track.kind === "overlay" ? <ImageIcon size={12} /> : track.kind === "text" ? <Captions size={12} /> : track.kind === "music" ? <Music2 size={12} /> : <AudioLines size={12} />}<span className="truncate">{track.name}</span></div>
                      <div data-timeline-track onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveClipFromDrop(event, track.id)} onDoubleClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setPlayhead(clamp(((event.clientX - rect.left) / rect.width) * duration, 0, duration)); }} className="relative h-14 overflow-hidden rounded-lg border border-white/5 bg-white/[0.025]">
                        {track.clips.map((clip) => {
                          const asset = clip.assetId ? assetMap.get(clip.assetId) : undefined;
                          const peaks = asset ? waveforms[asset.id] : undefined;
                          return <div key={clip.id} draggable onDragStart={(event) => { setDraggingClip(clip.id); event.dataTransfer.setData("text/eduai-clip", clip.id); }} onDragEnd={() => setDraggingClip(null)} onClick={(event) => { event.stopPropagation(); setSelectedClipId(clip.id); }} className={`group absolute top-1 h-12 cursor-grab overflow-hidden rounded-lg border ${TRACK_ACCENTS[track.kind]} ${selectedClipId === clip.id ? "ring-2 ring-white/70" : ""}`} style={{ left: `${(clip.start / duration) * 100}%`, width: `${Math.max(0.8, (clip.duration / duration) * 100)}%` }}>
                            <button onPointerDown={(event) => beginTrim(event, clip, "left")} className="absolute bottom-0 left-0 top-0 z-10 w-2 cursor-ew-resize bg-white/0 group-hover:bg-white/25" />
                            <button onPointerDown={(event) => beginTrim(event, clip, "right")} className="absolute bottom-0 right-0 top-0 z-10 w-2 cursor-ew-resize bg-white/0 group-hover:bg-white/25" />
                            {peaks && (track.kind === "audio" || track.kind === "music") ? <div className="absolute inset-0 flex items-center gap-px px-2 opacity-60">{peaks.map((peak, index) => <span key={index} className="min-w-[1px] flex-1 rounded-full bg-current" style={{ height: `${Math.max(8, peak * 88)}%` }} />)}</div> : null}
                            <div className="relative z-[1] flex h-full items-center gap-1 px-3"><span className="truncate text-[9px] font-medium">{clip.clipType === "text" ? clip.textStyle?.text : asset?.name || "Recurso faltante"}</span>{clip.keyframes.length > 0 && <span title={`${clip.keyframes.length} keyframes`} className="ml-auto rounded bg-black/30 px-1 text-[8px]">◆{clip.keyframes.length}</span>}</div>
                          </div>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] text-slate-400">{notice}</div>
        </main>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="mb-3 flex items-center gap-2"><Sparkles size={15} className="text-cyan-300" /><p className="text-xs font-semibold">Inspector</p></div>
          {!selectedClip ? <div className="py-16 text-center text-xs text-slate-500">Selecciona un clip para editar sus propiedades.</div> : (
            <div className="space-y-4 text-[10px]">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="truncate font-semibold text-slate-200">{selectedClip.clipType === "text" ? selectedClip.textStyle?.text : selectedAsset?.name || "Recurso"}</p><p className="mt-1 text-slate-500">{selectedClip.clipType} · {selectedClip.trackId}</p></div>
              <div className="grid grid-cols-2 gap-2">
                <label>Inicio<input type="number" step="0.1" min={0} value={selectedClip.start.toFixed(2)} onChange={(event) => updateClip(selectedClip.id, { start: Math.max(0, Number(event.target.value)) })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5" /></label>
                <label>Duración<input type="number" step="0.1" min={0.25} value={selectedClip.duration.toFixed(2)} onChange={(event) => updateClip(selectedClip.id, { duration: Math.max(0.25, Number(event.target.value)) })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5" /></label>
              </div>
              {selectedClip.clipType === "media" && <label>Offset / recorte inicial<input type="range" min={0} max={Math.max(0, (selectedAsset?.duration || selectedClip.duration) - 0.25)} step={0.01} value={selectedClip.offset} onChange={(event) => updateClip(selectedClip.id, { offset: Number(event.target.value) })} className="mt-1 w-full accent-cyan-500" /></label>}
              {(selectedClip.trackId === "audio-main" || selectedClip.trackId === "music-main" || selectedClip.trackId === "video-main") && <label>Volumen · {Math.round(selectedClip.volume * 100)}%<input type="range" min={0} max={1} step={0.01} value={selectedClip.volume} onChange={(event) => updateClip(selectedClip.id, { volume: Number(event.target.value) })} className="mt-1 w-full accent-violet-500" /><button onClick={() => updateClip(selectedClip.id, { muted: !selectedClip.muted })} className={`mt-1 rounded-lg px-2 py-1 ${selectedClip.muted ? "bg-rose-500/20 text-rose-200" : "bg-white/5"}`}>{selectedClip.muted ? "Silenciado" : "Audio activo"}</button></label>}

              {selectedClip.clipType === "text" && selectedClip.textStyle && <div className="space-y-2 rounded-xl border border-amber-400/15 bg-amber-500/5 p-3"><p className="font-semibold text-amber-200">Texto</p><textarea value={selectedClip.textStyle.text} onChange={(event) => updateClip(selectedClip.id, { textStyle: { ...selectedClip.textStyle!, text: event.target.value } })} rows={3} className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" /><div className="grid grid-cols-2 gap-2"><label>Tamaño<input type="number" min={10} max={240} value={selectedClip.textStyle.fontSize} onChange={(event) => updateClip(selectedClip.id, { textStyle: { ...selectedClip.textStyle!, fontSize: Number(event.target.value) } })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1" /></label><label>Color<input type="color" value={selectedClip.textStyle.color} onChange={(event) => updateClip(selectedClip.id, { textStyle: { ...selectedClip.textStyle!, color: event.target.value } })} className="mt-1 h-7 w-full rounded bg-transparent" /></label></div><label>Fuente<select value={selectedClip.textStyle.fontFamily} onChange={(event) => updateClip(selectedClip.id, { textStyle: { ...selectedClip.textStyle!, fontFamily: event.target.value } })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-1"><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Trebuchet MS</option><option>Courier New</option></select></label></div>}

              <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3"><p className="font-semibold">Transformación</p><div className="grid grid-cols-2 gap-2"><label>X<input type="number" value={selectedClip.transform.x} onChange={(event) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, x: Number(event.target.value) } })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-1" /></label><label>Y<input type="number" value={selectedClip.transform.y} onChange={(event) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, y: Number(event.target.value) } })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-1" /></label></div><label>Escala · {selectedClip.transform.scale.toFixed(2)}×<input type="range" min={0.2} max={3} step={0.01} value={selectedClip.transform.scale} onChange={(event) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, scale: Number(event.target.value) } })} className="w-full accent-cyan-500" /></label><label>Rotación · {selectedClip.transform.rotation.toFixed(0)}°<input type="range" min={-180} max={180} step={1} value={selectedClip.transform.rotation} onChange={(event) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, rotation: Number(event.target.value) } })} className="w-full accent-cyan-500" /></label><label>Opacidad · {Math.round(selectedClip.opacity * 100)}%<input type="range" min={0} max={1} step={0.01} value={selectedClip.opacity} onChange={(event) => updateClip(selectedClip.id, { opacity: Number(event.target.value) })} className="w-full accent-cyan-500" /></label></div>

              {selectedClip.clipType === "media" && (selectedAsset?.kind === "video" || selectedAsset?.kind === "image") && <div className="space-y-2 rounded-xl border border-fuchsia-400/15 bg-fuchsia-500/5 p-3"><p className="font-semibold text-fuchsia-200">Filtros</p>{([
                ["brightness", "Brillo", 0, 2, 0.01], ["contrast", "Contraste", 0, 2, 0.01], ["saturation", "Saturación", 0, 2, 0.01], ["blur", "Desenfoque", 0, 16, 0.1], ["grayscale", "B/N", 0, 1, 0.01], ["sepia", "Sepia", 0, 1, 0.01],
              ] as const).map(([key, label, min, max, step]) => <label key={key}>{label}<input type="range" min={min} max={max} step={step} value={selectedClip.filter[key]} onChange={(event) => updateClip(selectedClip.id, { filter: { ...selectedClip.filter, [key]: Number(event.target.value) } })} className="w-full accent-fuchsia-500" /></label>)}</div>}

              <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3"><p className="font-semibold">Transiciones</p><div className="grid grid-cols-2 gap-2"><label>Entrada<select value={selectedClip.transitionIn} onChange={(event) => updateClip(selectedClip.id, { transitionIn: event.target.value as TransitionKind })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-1 py-1">{TRANSITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Salida<select value={selectedClip.transitionOut} onChange={(event) => updateClip(selectedClip.id, { transitionOut: event.target.value as TransitionKind })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-1 py-1">{TRANSITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div><label>Duración · {selectedClip.transitionDuration.toFixed(2)} s<input type="range" min={0.05} max={Math.max(0.1, selectedClip.duration / 2)} step={0.05} value={selectedClip.transitionDuration} onChange={(event) => updateClip(selectedClip.id, { transitionDuration: Number(event.target.value) })} className="w-full accent-amber-500" /></label></div>

              <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/5 p-3"><div className="flex items-center justify-between"><p className="font-semibold text-cyan-200"><KeyRound size={12} className="mr-1 inline" />Keyframes</p><button onClick={addKeyframe} className="rounded-lg bg-cyan-500/15 px-2 py-1 text-cyan-200">+ actual</button></div><p className="mt-2 text-[9px] text-slate-500">Anima posición, escala, rotación, opacidad y volumen. Coloca el cabezal y guarda el estado actual.</p><div className="mt-2 flex flex-wrap gap-1">{selectedClip.keyframes.map((frame) => <button key={frame.id} onClick={() => setPlayhead(selectedClip.start + frame.time)} onDoubleClick={() => updateClip(selectedClip.id, { keyframes: selectedClip.keyframes.filter((item) => item.id !== frame.id) })} className="rounded bg-white/5 px-2 py-1 text-[9px] hover:bg-white/10">◆ {fmt(frame.time)}</button>)}</div></div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
