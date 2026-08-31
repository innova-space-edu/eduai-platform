"use client";

import Link from "next/link";
import {
  ArrowLeft,
  AudioLines,
  Copy,
  Download,
  Film,
  FolderOpen,
  ImageIcon,
  Music2,
  Pause,
  Play,
  Plus,
  Save,
  Scissors,
  Search,
  Trash2,
  Upload,
  Video,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { downloadBlob, exportProjectWebM } from "@/lib/multimedia/export-webm";
import {
  makeProject,
  parseClock,
  projectDuration,
  type MediaAsset,
  type MultimediaProject,
  type TimelineClip,
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

const TRACK_ACCENTS: Record<string, string> = {
  video: "bg-cyan-500/20 border-cyan-400/40 text-cyan-100",
  overlay: "bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-100",
  audio: "bg-violet-500/20 border-violet-400/40 text-violet-100",
  music: "bg-emerald-500/20 border-emerald-400/40 text-emerald-100",
};

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

function downloadJson(project: MultimediaProject, assets: MediaAsset[]) {
  const payload = {
    project: { ...project, updatedAt: new Date().toISOString() },
    assets: assets.map((asset) => ({
      ...asset,
      url: asset.local ? "" : asset.url,
      needsRelink: Boolean(asset.local),
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${project.title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "proyecto"}.eduai-media.json`);
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

export default function MultimediaStudioClient() {
  const [project, setProject] = useState<MultimediaProject>(() => makeProject());
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<"files" | "music" | "project">("files");
  const [musicQuery, setMusicQuery] = useState("música instrumental para estudiar");
  const [musicResults, setMusicResults] = useState<MusicResult[]>([]);
  const [searchingMusic, setSearchingMusic] = useState(false);
  const [notice, setNotice] = useState("Carga archivos o busca música y agrégalos a la línea de tiempo.");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewAudio = useRef<Map<string, HTMLAudioElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const playbackAnchor = useRef({ playhead: 0, time: 0 });
  const assetsRef = useRef<MediaAsset[]>([]);

  const duration = useMemo(() => projectDuration(project), [project]);
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const clips = useMemo(() => project.tracks.flatMap((track) => track.clips), [project]);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || null;
  const selectedAsset = selectedClip ? assetMap.get(selectedClip.assetId) : undefined;

  const activeVideoClip = useMemo(() => {
    const track = project.tracks.find((item) => item.kind === "video");
    return [...(track?.clips || [])].reverse().find((clip) => playhead >= clip.start && playhead < clip.start + clip.duration);
  }, [playhead, project]);
  const activeVideoAsset = activeVideoClip ? assetMap.get(activeVideoClip.assetId) : undefined;

  const activeOverlayClip = useMemo(() => {
    const track = project.tracks.find((item) => item.kind === "overlay");
    return [...(track?.clips || [])].reverse().find((clip) => playhead >= clip.start && playhead < clip.start + clip.duration);
  }, [playhead, project]);
  const activeOverlayAsset = activeOverlayClip ? assetMap.get(activeOverlayClip.assetId) : undefined;

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    return () => {
      assetsRef.current.forEach((asset) => {
        if (asset.local && asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
      });
      previewAudio.current.forEach((audio) => audio.pause());
    };
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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoClip || !activeVideoAsset?.url) return;
    const wanted = activeVideoClip.offset + playhead - activeVideoClip.start;
    if (Math.abs(video.currentTime - wanted) > 0.18) video.currentTime = Math.max(0, wanted);
    video.volume = clamp(activeVideoClip.volume, 0, 1);
    video.muted = activeVideoClip.muted;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [activeVideoAsset?.url, activeVideoClip, playhead, playing]);

  useEffect(() => {
    const activeIds = new Set<string>();
    for (const track of project.tracks.filter((item) => item.kind === "audio" || item.kind === "music")) {
      for (const clip of track.clips) {
        const isActive = playhead >= clip.start && playhead < clip.start + clip.duration;
        const asset = assetMap.get(clip.assetId);
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
        audio.volume = clip.muted ? 0 : clamp(clip.volume, 0, 1);
        if (playing) void audio.play().catch(() => undefined);
        else audio.pause();
      }
    }
    previewAudio.current.forEach((audio, clipId) => {
      if (!activeIds.has(clipId)) audio.pause();
    });
  }, [assetMap, playhead, playing, project]);

  function updateClip(clipId: string, patch: Partial<TimelineClip>) {
    setProject((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      tracks: current.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip)),
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
      setNotice("Este resultado solo permite vista previa externa y no puede agregarse como pista editable.");
      return;
    }
    const trackId = targetTrackId(asset);
    const clip: TimelineClip = {
      id: id("clip"),
      assetId: asset.id,
      trackId,
      start: playhead,
      duration: asset.kind === "image" ? 5 : Math.max(0.5, asset.duration || 10),
      offset: 0,
      volume: 1,
      opacity: 1,
      muted: false,
    };
    setProject((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      tracks: current.tracks.map((track) => track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track),
    }));
    setSelectedClipId(clip.id);
    setNotice(`${asset.name} agregado en ${fmt(playhead)}.`);
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const incoming: MediaAsset[] = [];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const kind: MediaAsset["kind"] = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image";
      const mediaDuration = kind === "image" ? 5 : await probeDuration(url, kind);
      incoming.push({
        id: id("asset"),
        name: file.name,
        kind,
        url,
        duration: mediaDuration,
        source: "local",
        exportable: true,
        local: true,
      });
    }
    setAssets((current) => [...current, ...incoming]);
    setNotice(`${incoming.length} recurso(s) cargado(s). Presiona + para agregarlos a la línea de tiempo.`);
    event.target.value = "";
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
      setNotice(`${(data.tracks || []).length} resultados encontrados. YouTube queda como vista previa externa; no se descarga.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo buscar música.");
    } finally {
      setSearchingMusic(false);
    }
  }

  function importMusic(result: MusicResult) {
    if (!result.src) {
      if (result.externalUrl) window.open(result.externalUrl, "_blank", "noopener,noreferrer");
      setNotice("YouTube se mantiene como vista previa oficial externa y no se descarga al editor.");
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
  }

  function removeClip() {
    if (!selectedClipId) return;
    setProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({ ...track, clips: track.clips.filter((clip) => clip.id !== selectedClipId) })),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedClipId(null);
  }

  function duplicateClip() {
    if (!selectedClip) return;
    const clone = { ...selectedClip, id: id("clip"), start: selectedClip.start + 0.5 };
    setProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === clone.trackId ? { ...track, clips: [...track.clips, clone] } : track),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedClipId(clone.id);
  }

  function splitClip() {
    if (!selectedClip) return;
    const local = playhead - selectedClip.start;
    if (local <= 0.1 || local >= selectedClip.duration - 0.1) {
      setNotice("Ubica el cabezal dentro del clip para dividirlo.");
      return;
    }
    const left = { ...selectedClip, duration: local };
    const right: TimelineClip = {
      ...selectedClip,
      id: id("clip"),
      start: playhead,
      duration: selectedClip.duration - local,
      offset: selectedClip.offset + local,
    };
    setProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === selectedClip.trackId ? {
        ...track,
        clips: track.clips.flatMap((clip) => clip.id === selectedClip.id ? [left, right] : [clip]),
      } : track),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedClipId(right.id);
  }

  async function exportWebM() {
    if (!clips.length) {
      setNotice("Agrega al menos un clip antes de exportar.");
      return;
    }
    setExporting(true);
    setExportProgress(0);
    setPlaying(false);
    setNotice("Exportando WebM en tiempo real dentro del navegador…");
    try {
      const blob = await exportProjectWebM(project, assets, { onProgress: setExportProgress });
      downloadBlob(blob, `${project.title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "eduai-video"}.webm`);
      setNotice("Exportación WebM terminada. Los recursos remotos incompatibles con CORS pueden quedar solo en vista previa.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo exportar WebM.");
    } finally {
      setExporting(false);
    }
  }

  const timelineWidth = Math.max(960, duration * 64);

  return (
    <main className="min-h-[100dvh] bg-[#050816] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07101f]/95 backdrop-blur-xl">
        <div className="flex min-h-16 items-center gap-3 px-4 lg:px-6">
          <Link href="/agentes" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10" title="Volver a Agentes"><ArrowLeft size={18} /></Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">EDUAI · Creativo</p>
            <input value={project.title} onChange={(event) => setProject((current) => ({ ...current, title: event.target.value, updatedAt: new Date().toISOString() }))} className="w-full max-w-xl bg-transparent text-lg font-bold outline-none placeholder:text-slate-500" aria-label="Nombre del proyecto" />
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/video-studio" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">Generar video</Link>
            <Link href="/audio-lab" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">Audio Lab</Link>
            <Link href="/galeria" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">Galería</Link>
          </div>
          <button onClick={() => downloadJson(project, assets)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"><Save size={15} /> Guardar</button>
          <button onClick={exportWebM} disabled={exporting} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"><Download size={15} /> {exporting ? `${Math.round(exportProgress * 100)}%` : "Exportar WebM"}</button>
        </div>
      </header>

      <div className="grid min-h-[calc(100dvh-64px)] grid-cols-1 xl:grid-cols-[310px_minmax(0,1fr)_280px]">
        <aside className="border-r border-white/10 bg-[#07101f] p-3">
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">
            {([[
              "files", "Archivos", FolderOpen,
            ], ["music", "Música", Music2], ["project", "Proyecto", Film]] as const).map(([value, label, Icon]) => (
              <button key={value} onClick={() => setTab(value)} className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold ${tab === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}><Icon size={14} /> {label}</button>
            ))}
          </div>

          {tab === "files" && (
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-400/40 bg-cyan-500/5 px-4 py-5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10"><Upload size={18} /> Cargar audio, video o imagen<input type="file" multiple accept="video/*,audio/*,image/*" className="hidden" onChange={handleFiles} /></label>
              <div className="space-y-2">
                {assets.filter((asset) => asset.source === "local").map((asset) => (
                  <div key={asset.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">{asset.kind === "video" ? <Video size={17} /> : asset.kind === "audio" ? <AudioLines size={17} /> : <ImageIcon size={17} />}</div>
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{asset.name}</p><p className="text-[10px] text-slate-500">{asset.kind} · {fmt(asset.duration)}</p></div>
                      <button onClick={() => addAssetToTimeline(asset)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 text-slate-950" title="Agregar al cabezal"><Plus size={15} /></button>
                    </div>
                  </div>
                ))}
                {!assets.some((asset) => asset.source === "local") && <p className="py-8 text-center text-xs text-slate-500">Aún no hay archivos locales.</p>}
              </div>
            </div>
          )}

          {tab === "music" && (
            <div className="space-y-3">
              <div className="flex gap-2"><input value={musicQuery} onChange={(event) => setMusicQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchMusic()} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-emerald-400/50" placeholder="Buscar canción, ambiente…" /><button onClick={searchMusic} disabled={searchingMusic} className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 disabled:opacity-50"><Search size={16} /></button></div>
              <p className="text-[10px] leading-relaxed text-slate-500">Busca en las fuentes ya conectadas a EduAI. YouTube se abre mediante su experiencia oficial y no se descarga.</p>
              <div className="space-y-2">
                {musicResults.map((result) => (
                  <div key={result.id} className="flex gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-emerald-500/10">{result.artworkUrl ? <img src={result.artworkUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Music2 size={16} /></div>}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold">{result.title}</p><p className="truncate text-[10px] text-slate-500">{result.artist} · {result.source}</p></div>
                    <button onClick={() => importMusic(result)} className="flex h-8 w-8 items-center justify-center self-center rounded-lg bg-emerald-500 text-slate-950" title={result.src ? "Agregar a música" : "Abrir vista previa"}>{result.src ? <Plus size={14} /> : <Play size={14} />}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "project" && (
            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="font-semibold">Composición</p><div className="mt-2 grid grid-cols-2 gap-2 text-slate-400"><span>{project.width} × {project.height}</span><span>{project.fps} fps</span><span>{clips.length} clips</span><span>{fmt(duration)}</span></div></div>
              <button onClick={() => downloadJson(project, assets)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-semibold hover:bg-white/10"><Save size={15} /> Guardar proyecto JSON</button>
              <p className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-[10px] leading-relaxed text-amber-100/70">Los archivos locales no se incrustan dentro del JSON. Al reabrir el proyecto deberán volver a vincularse. La exportación WebM sí procesa los archivos disponibles en la sesión actual.</p>
            </div>
          )}
        </aside>

        <section className="flex min-w-0 flex-col bg-[#050816]">
          <div className="flex min-h-[430px] flex-1 items-center justify-center p-4 lg:p-6">
            <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-cyan-950/20">
              {!activeVideoAsset && !activeOverlayAsset && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600"><Film size={50} strokeWidth={1.2} /><div className="text-center"><p className="text-sm font-semibold text-slate-400">Previsualización</p><p className="mt-1 text-xs">Agrega un video o imagen a la línea de tiempo.</p></div></div>}
              {activeVideoAsset?.url && <video key={activeVideoAsset.id} ref={videoRef} src={activeVideoAsset.url} className="absolute inset-0 h-full w-full object-cover" playsInline />}
              {activeOverlayAsset?.url && <img src={activeOverlayAsset.url} alt="Overlay" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: activeOverlayClip?.opacity ?? 1 }} />}
            </div>
          </div>

          <div className="border-t border-white/10 bg-[#07101f]">
            <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2"><button onClick={() => { if (playhead >= duration) setPlayhead(0); setPlaying((value) => !value); }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500 text-slate-950">{playing ? <Pause size={16} /> : <Play size={16} />}</button><span className="w-24 font-mono text-xs text-cyan-200">{fmt(playhead)}</span><input type="range" min={0} max={duration} step={0.05} value={Math.min(playhead, duration)} onChange={(event) => { setPlaying(false); setPlayhead(Number(event.target.value)); }} className="min-w-0 flex-1 accent-cyan-400" /><span className="font-mono text-xs text-slate-500">{fmt(duration)}</span></div>
            <div className="max-h-[330px] overflow-auto">
              <div style={{ width: timelineWidth + 118 }} className="min-w-full p-2">
                <div className="relative ml-[110px] mb-1 h-5 border-b border-white/10 text-[9px] text-slate-600" style={{ width: timelineWidth }}>{Array.from({ length: Math.ceil(duration / 5) + 1 }, (_, index) => <span key={index} className="absolute bottom-0" style={{ left: Math.min(timelineWidth - 20, index * 5 * 64) }}>{index * 5}s</span>)}</div>
                {project.tracks.map((track) => (
                  <div key={track.id} className="mb-1 flex h-14">
                    <div className="flex w-[110px] shrink-0 items-center gap-2 border-r border-white/10 px-2 text-[10px] font-semibold text-slate-400">{track.kind === "video" ? <Video size={14} /> : track.kind === "overlay" ? <ImageIcon size={14} /> : track.kind === "music" ? <Music2 size={14} /> : <AudioLines size={14} />}<span className="truncate">{track.name}</span></div>
                    <div className="relative h-full bg-black/20" style={{ width: timelineWidth }} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; setPlaying(false); setPlayhead(clamp((x / timelineWidth) * duration, 0, duration)); }}>
                      {track.clips.map((clip) => { const asset = assetMap.get(clip.assetId); return <button key={clip.id} onClick={(event) => { event.stopPropagation(); setSelectedClipId(clip.id); }} className={`absolute top-1 h-12 overflow-hidden rounded-lg border px-2 text-left text-[10px] ${TRACK_ACCENTS[track.kind]} ${selectedClipId === clip.id ? "ring-2 ring-white/70" : ""}`} style={{ left: (clip.start / duration) * timelineWidth, width: Math.max(24, (clip.duration / duration) * timelineWidth) }} title={`${asset?.name || "Clip"} · ${fmt(clip.start)}–${fmt(clip.start + clip.duration)}`}><span className="block truncate font-semibold">{asset?.name || "Clip"}</span><span className="block opacity-60">{fmt(clip.duration)}</span></button>; })}
                      <div className="pointer-events-none absolute inset-y-0 w-px bg-red-400" style={{ left: (playhead / duration) * timelineWidth }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="border-l border-white/10 bg-[#07101f] p-3">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Inspector</p>
          {selectedClip && selectedAsset ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="truncate text-sm font-semibold">{selectedAsset.name}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{selectedAsset.kind} · {selectedAsset.source || "local"}</p></div>
              <div className="grid grid-cols-2 gap-2"><button onClick={splitClip} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[11px] hover:bg-white/10"><Scissors size={14} /> Dividir</button><button onClick={duplicateClip} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[11px] hover:bg-white/10"><Copy size={14} /> Duplicar</button></div>
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <label className="block text-[10px] text-slate-400">Inicio (s)<input type="number" min={0} step={0.1} value={selectedClip.start} onChange={(event) => updateClip(selectedClip.id, { start: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-white outline-none" /></label>
                <div className="grid grid-cols-2 gap-2"><label className="block text-[10px] text-slate-400">Duración<input type="number" min={0.2} step={0.1} value={selectedClip.duration} onChange={(event) => updateClip(selectedClip.id, { duration: Math.max(0.2, Number(event.target.value) || 0.2) })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-white outline-none" /></label><label className="block text-[10px] text-slate-400">Recorte inicio<input type="number" min={0} step={0.1} value={selectedClip.offset} onChange={(event) => updateClip(selectedClip.id, { offset: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-white outline-none" /></label></div>
                <div><div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span className="flex items-center gap-1"><Volume2 size={12} /> Volumen</span><span>{Math.round(selectedClip.volume * 100)}%</span></div><input type="range" min={0} max={1} step={0.01} value={selectedClip.volume} onChange={(event) => updateClip(selectedClip.id, { volume: Number(event.target.value) })} className="w-full accent-violet-400" /></div>
                {(selectedAsset.kind === "video" || selectedAsset.kind === "image") && <div><div className="mb-1 flex justify-between text-[10px] text-slate-400"><span>Opacidad</span><span>{Math.round(selectedClip.opacity * 100)}%</span></div><input type="range" min={0} max={1} step={0.01} value={selectedClip.opacity} onChange={(event) => updateClip(selectedClip.id, { opacity: Number(event.target.value) })} className="w-full accent-fuchsia-400" /></div>}
                <label className="flex items-center justify-between text-[11px] text-slate-300"><span>Silenciar clip</span><input type="checkbox" checked={selectedClip.muted} onChange={(event) => updateClip(selectedClip.id, { muted: event.target.checked })} /></label>
              </div>
              <div className="grid grid-cols-2 gap-2"><button onClick={() => updateClip(selectedClip.id, { start: Math.max(0, selectedClip.start - 0.5) })} className="rounded-xl border border-white/10 py-2 text-xs hover:bg-white/5">← 0,5 s</button><button onClick={() => updateClip(selectedClip.id, { start: selectedClip.start + 0.5 })} className="rounded-xl border border-white/10 py-2 text-xs hover:bg-white/5">0,5 s →</button></div>
              <button onClick={removeClip} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-200 hover:bg-red-500/20"><Trash2 size={15} /> Eliminar clip</button>
            </div>
          ) : <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs leading-relaxed text-slate-500">Selecciona un clip para editar su posición, recorte, duración, volumen y opacidad.</div>}
          <div className="mt-5 rounded-xl border border-cyan-400/15 bg-cyan-500/5 p-3 text-[10px] leading-relaxed text-cyan-100/60"><p className="font-semibold text-cyan-200">Estado del editor</p><p className="mt-1">{notice}</p></div>
        </aside>
      </div>
    </main>
  );
}
