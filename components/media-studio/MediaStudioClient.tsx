"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bot, Captions, ChevronDown, Download, Eye, EyeOff, Film, Image as ImageIcon,
  Layers3, Loader2, Mic2, Music2, Pause, Play, Plus, Redo2, Save, Scissors, Search,
  Sparkles, Trash2, Type, Undo2, Upload, Volume2, VolumeX, WandSparkles, ZoomIn, ZoomOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMediaStudioStore } from "@/lib/media-studio/store";
import type { AspectRatio, MediaAIPlan, MediaAsset, MediaAssetType, TimelineClip } from "@/lib/media-studio/types";

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
const LOCAL_KEY = "eduai-media-studio-v1";

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds || 0);
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 10);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${ms}`;
}

function assetTypeFromFile(file: File): MediaAssetType | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  return null;
}

async function mediaDuration(file: File) {
  if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) return 5;
  const url = URL.createObjectURL(file);
  try {
    const element = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
    element.preload = "metadata";
    element.src = url;
    return await new Promise<number>((resolve) => {
      const timer = window.setTimeout(() => resolve(8), 5000);
      element.onloadedmetadata = () => { window.clearTimeout(timer); resolve(Number.isFinite(element.duration) ? element.duration : 8); };
      element.onerror = () => { window.clearTimeout(timer); resolve(8); };
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function SyncedVideo({ clip, playhead, playing }: { clip: TimelineClip; playhead: number; playing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const localTime = Math.max(0, (playhead - clip.start) * clip.playbackRate + clip.trimStart);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (Math.abs(video.currentTime - localTime) > 0.2) video.currentTime = localTime;
    video.playbackRate = clip.playbackRate;
    video.volume = clip.muted ? 0 : Math.max(0, Math.min(1, clip.volume));
    if (playing) video.play().catch(() => undefined); else video.pause();
  }, [localTime, playing, clip.playbackRate, clip.volume, clip.muted]);
  return (
    <video
      ref={ref}
      src={clip.sourceUrl}
      playsInline
      muted={clip.muted}
      className="absolute left-1/2 top-1/2 max-h-full max-w-full object-contain"
      style={{
        transform: `translate(calc(-50% + ${clip.transform.x}px), calc(-50% + ${clip.transform.y}px)) scale(${clip.transform.scale}) rotate(${clip.transform.rotation}deg)`,
        opacity: clip.transform.opacity,
        filter: `brightness(${clip.style.brightness}) contrast(${clip.style.contrast}) saturate(${clip.style.saturation}) blur(${clip.style.blur}px)`,
        borderRadius: `${clip.style.borderRadius}px`,
      }}
    />
  );
}

function SyncedAudio({ clip, playhead, playing, trackMuted }: { clip: TimelineClip; playhead: number; playing: boolean; trackMuted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const localTime = Math.max(0, (playhead - clip.start) * clip.playbackRate + clip.trimStart);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - localTime) > 0.25) audio.currentTime = localTime;
    audio.playbackRate = clip.playbackRate;
    audio.volume = clip.muted || trackMuted ? 0 : Math.max(0, Math.min(1, clip.volume));
    if (playing) audio.play().catch(() => undefined); else audio.pause();
  }, [localTime, playing, clip.playbackRate, clip.volume, clip.muted, trackMuted]);
  return <audio ref={ref} src={clip.sourceUrl} preload="auto" />;
}

export default function MediaStudioClient() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"media" | "text" | "ai">("media");
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState<"all" | "pexels" | "pixabay" | "freesound" | "jamendo">("all");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MediaAsset[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");

  const store = useMediaStudioStore();
  const {
    project, assets, selectedClipId, playhead, playing, zoom, history, future,
    setProjectName, setPlayhead, setPlaying, setZoom, setAspectRatio, addAsset, addClipFromAsset,
    addTextClip, selectClip, updateClip, splitClip, deleteClip, moveClip, toggleTrackMute,
    toggleTrackHidden, addTrack, undo, redo, loadProject,
  } = store;

  const selectedClip = useMemo(() => project.tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId) || null, [project, selectedClipId]);
  const activeVisuals = useMemo(() => project.tracks.flatMap((track) => track.hidden ? [] : track.clips.filter((clip) => ["video", "image", "text"].includes(clip.type) && playhead >= clip.start && playhead < clip.start + clip.duration).map((clip) => ({ clip, track }))), [project, playhead]);
  const activeAudios = useMemo(() => project.tracks.flatMap((track) => track.clips.filter((clip) => ["audio", "music", "sfx"].includes(clip.type) && playhead >= clip.start && playhead < clip.start + clip.duration).map((clip) => ({ clip, track }))), [project, playhead]);

  useEffect(() => {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.project?.tracks) loadProject(parsed.project);
    } catch {}
  }, [loadProject]);

  useEffect(() => {
    const serializable = JSON.parse(JSON.stringify(project));
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ project: serializable }));
  }, [project]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;
      const next = useMediaStudioStore.getState().playhead + delta;
      if (next >= useMediaStudioStore.getState().project.duration) {
        useMediaStudioStore.getState().setPlayhead(0);
        useMediaStudioStore.getState().setPlaying(false);
        return;
      }
      useMediaStudioStore.getState().setPlayhead(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (event.code === "Space") { event.preventDefault(); setPlaying(!useMediaStudioStore.getState().playing); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      if ((event.key === "Delete" || event.key === "Backspace") && useMediaStudioStore.getState().selectedClipId) deleteClip(useMediaStudioStore.getState().selectedClipId!);
      if (event.key.toLowerCase() === "s" && !event.ctrlKey && !event.metaKey && useMediaStudioStore.getState().selectedClipId) splitClip(useMediaStudioStore.getState().selectedClipId!, useMediaStudioStore.getState().playhead);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setPlaying, undo, redo, deleteClip, splitClip]);

  async function importFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const type = assetTypeFromFile(file);
      if (!type) continue;
      const duration = await mediaDuration(file);
      const asset: MediaAsset = { id: uid("asset"), type, name: file.name, url: URL.createObjectURL(file), duration, mimeType: file.type, source: "upload", provider: "Local" };
      addAsset(asset);
      addClipFromAsset(asset);
    }
  }

  async function saveProject() {
    setSaveState("saving");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión");
      const { error } = await supabase.from("media_projects").upsert({
        id: project.id,
        user_id: user.id,
        name: project.name,
        aspect_ratio: project.aspectRatio,
        width: project.width,
        height: project.height,
        fps: project.fps,
        duration_seconds: project.duration,
        timeline_json: project,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 2200);
    }
  }

  function exportProject() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "media-studio"}.eduai-media.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function searchLibrary() {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: search.trim(), provider });
      const res = await fetch(`/api/media-studio/search?${params}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data.items) ? data.items : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function runMediaAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiResult("");
    try {
      const res = await fetch("/api/media-studio/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: aiPrompt, project, selectedClipId, playhead }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo procesar la instrucción");
      const plan: MediaAIPlan = data.plan;
      for (const command of plan.commands || []) {
        if (command.action === "add_text") addTextClip(command.text || String(command.value || "Texto"), command.at ?? playhead);
        if (command.action === "delete_clip" && command.clipId) deleteClip(command.clipId);
        if (command.action === "split_clip" && command.clipId) splitClip(command.clipId, command.at ?? playhead);
        if (command.action === "move_clip" && command.clipId && typeof command.value === "number") updateClip(command.clipId, { start: Math.max(0, command.value) });
        if (command.action === "change_speed" && command.clipId && typeof command.value === "number") updateClip(command.clipId, { playbackRate: Math.max(0.25, Math.min(4, command.value)) });
        if (command.action === "set_volume" && command.clipId && typeof command.value === "number") updateClip(command.clipId, { volume: Math.max(0, Math.min(1, command.value)) });
        if (command.action === "mute_clip" && command.clipId) updateClip(command.clipId, { muted: Boolean(command.value ?? true) });
        if (command.action === "set_aspect_ratio" && typeof command.value === "string" && ["16:9", "9:16", "1:1", "4:5"].includes(command.value)) setAspectRatio(command.value as AspectRatio);
        if (command.action === "suggest_media" && command.query) { setSearch(command.query); setTab("media"); }
      }
      setAiResult(plan.summary || "Cambios aplicados.");
    } catch (error) {
      setAiResult(error instanceof Error ? error.message : "No se pudo ejecutar Media AI");
    } finally {
      setAiLoading(false);
    }
  }

  const previewAspect = project.aspectRatio === "16:9" ? "aspect-video" : project.aspectRatio === "9:16" ? "aspect-[9/16]" : project.aspectRatio === "4:5" ? "aspect-[4/5]" : "aspect-square";

  return (
    <div className="flex h-screen min-h-[720px] flex-col overflow-hidden bg-[#080b12] text-slate-100">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#0d111b] px-3">
        <Link href="/agentes" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600"><Film className="h-4 w-4" /></div><div><p className="text-sm font-bold">Media Studio</p><p className="text-[10px] text-slate-500">Editor audiovisual EDUAI</p></div></div>
        <input value={project.name} onChange={(e) => setProjectName(e.target.value)} className="ml-3 w-56 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs outline-none focus:border-cyan-400/50" />
        <div className="ml-auto flex items-center gap-2">
          <button onClick={undo} disabled={!history.length} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Deshacer"><Undo2 className="h-4 w-4" /></button>
          <button onClick={redo} disabled={!future.length} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 disabled:opacity-30" title="Rehacer"><Redo2 className="h-4 w-4" /></button>
          <select value={project.aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="rounded-lg border border-white/10 bg-[#131a27] px-2 py-1.5 text-xs"><option>16:9</option><option>9:16</option><option>1:1</option><option>4:5</option></select>
          <button onClick={saveProject} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"><Save className="h-3.5 w-3.5" />{saveState === "saving" ? "Guardando" : saveState === "saved" ? "Guardado" : saveState === "error" ? "Local" : "Guardar"}</button>
          <button onClick={exportProject} className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"><Download className="h-3.5 w-3.5" />Exportar proyecto</button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_280px]">
        <aside className="min-h-0 border-r border-white/10 bg-[#0b0f18]">
          <div className="grid grid-cols-3 border-b border-white/10">
            <button onClick={() => setTab("media")} className={`flex flex-col items-center gap-1 py-3 text-[10px] ${tab === "media" ? "bg-cyan-400/10 text-cyan-300" : "text-slate-500"}`}><Layers3 className="h-4 w-4" />Medios</button>
            <button onClick={() => setTab("text")} className={`flex flex-col items-center gap-1 py-3 text-[10px] ${tab === "text" ? "bg-cyan-400/10 text-cyan-300" : "text-slate-500"}`}><Type className="h-4 w-4" />Texto</button>
            <button onClick={() => setTab("ai")} className={`flex flex-col items-center gap-1 py-3 text-[10px] ${tab === "ai" ? "bg-violet-400/10 text-violet-300" : "text-slate-500"}`}><Bot className="h-4 w-4" />Media AI</button>
          </div>
          <div className="h-full overflow-y-auto p-3 pb-24">
            {tab === "media" && <>
              <button onClick={() => fileRef.current?.click()} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-400/30 bg-cyan-400/5 py-3 text-xs text-cyan-200 hover:bg-cyan-400/10"><Upload className="h-4 w-4" />Subir video, audio o imagen</button>
              <input ref={fileRef} type="file" multiple accept="video/*,audio/*,image/*" className="hidden" onChange={(e) => e.target.files && importFiles(e.target.files)} />
              <div className="mb-3 flex gap-1"><div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchLibrary()} placeholder="Buscar stock, música, SFX..." className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-2 text-xs outline-none focus:border-cyan-400/40" /></div><button onClick={searchLibrary} className="rounded-lg bg-white/10 px-2.5 hover:bg-white/15">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></div>
              <select value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)} className="mb-4 w-full rounded-lg border border-white/10 bg-[#131a27] px-2 py-2 text-xs"><option value="all">Todas las fuentes</option><option value="pexels">Pexels</option><option value="pixabay">Pixabay</option><option value="freesound">Freesound</option><option value="jamendo">Jamendo</option></select>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Proyecto</p>
              <div className="grid grid-cols-2 gap-2">
                {assets.map((asset) => <button key={asset.id} onClick={() => addClipFromAsset(asset)} className="group overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left hover:border-cyan-400/30"><div className="flex aspect-video items-center justify-center bg-black/30">{asset.type === "image" ? <img src={asset.thumbnailUrl || asset.url} alt="" className="h-full w-full object-cover" /> : asset.type === "video" ? <Film className="h-7 w-7 text-cyan-300" /> : <Music2 className="h-7 w-7 text-violet-300" />}</div><div className="p-2"><p className="truncate text-[10px] font-medium">{asset.name}</p><p className="mt-0.5 text-[9px] text-slate-500">{asset.provider || asset.source} · {asset.duration ? formatTime(asset.duration) : asset.type}</p></div></button>)}
              </div>
              {!!searchResults.length && <><p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Resultados</p><div className="space-y-2">{searchResults.map((asset) => <div key={asset.id} className="flex gap-2 rounded-xl border border-white/10 bg-white/5 p-2"><div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/30">{asset.thumbnailUrl ? <img src={asset.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <Music2 className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold">{asset.name}</p><p className="text-[9px] text-slate-500">{asset.provider} · {asset.license || "Revisar licencia"}</p><button onClick={() => { addAsset(asset); addClipFromAsset(asset); }} className="mt-1 text-[10px] font-bold text-cyan-300">+ Timeline</button></div></div>)}</div></>}
            </>}
            {tab === "text" && <div className="space-y-3"><button onClick={() => addTextClip("Título principal")} className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left hover:border-cyan-400/30"><p className="text-xl font-black">Título</p><p className="mt-1 text-[10px] text-slate-500">Texto grande editable</p></button><button onClick={() => addTextClip("Subtítulo o explicación")} className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left hover:border-cyan-400/30"><p className="text-sm font-semibold">Subtítulo</p><p className="mt-1 text-[10px] text-slate-500">Texto secundario</p></button><Link href="/audio-lab" className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/5 p-3 text-xs text-violet-200"><Captions className="h-4 w-4" />Generar subtítulos desde Audio Lab</Link></div>}
            {tab === "ai" && <div><div className="mb-3 rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-3"><div className="mb-2 flex items-center gap-2"><WandSparkles className="h-4 w-4 text-violet-300" /><p className="text-xs font-bold">Media AI</p></div><p className="text-[10px] leading-4 text-slate-400">Describe cambios en lenguaje natural. El agente genera acciones reversibles sobre el timeline.</p></div><textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={6} placeholder="Ej: agrega un título al inicio, baja el volumen del clip seleccionado a 25% y cambia el formato a 9:16" className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-xs outline-none focus:border-violet-400/40" /><button onClick={runMediaAI} disabled={aiLoading || !aiPrompt.trim()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-2.5 text-xs font-bold hover:bg-violet-400 disabled:opacity-40">{aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Ejecutar</button>{aiResult && <p className="mt-3 rounded-xl bg-white/5 p-3 text-[10px] leading-4 text-slate-300">{aiResult}</p>}</div>}
          </div>
        </aside>

        <main className="flex min-w-0 flex-col bg-[#080b12]">
          <section className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-5">
            <div className={`${previewAspect} relative max-h-full max-w-full overflow-hidden rounded-sm bg-black shadow-2xl ring-1 ring-white/10`} style={{ width: project.aspectRatio === "9:16" ? "min(34vh, 360px)" : project.aspectRatio === "1:1" ? "min(58vh, 620px)" : "min(78vw, 900px)" }}>
              {activeVisuals.length === 0 && <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700"><Film className="mb-3 h-12 w-12" /><p className="text-sm font-bold">Arrastra contenido al timeline</p><p className="mt-1 text-[10px]">Video · audio · imágenes · texto</p></div>}
              {activeVisuals.map(({ clip }) => clip.type === "video" ? <SyncedVideo key={clip.id} clip={clip} playhead={playhead} playing={playing} /> : clip.type === "image" ? <img key={clip.id} src={clip.sourceUrl} alt="" className="absolute left-1/2 top-1/2 max-h-full max-w-full object-contain" style={{ transform: `translate(calc(-50% + ${clip.transform.x}px), calc(-50% + ${clip.transform.y}px)) scale(${clip.transform.scale}) rotate(${clip.transform.rotation}deg)`, opacity: clip.transform.opacity, filter: `brightness(${clip.style.brightness}) contrast(${clip.style.contrast}) saturate(${clip.style.saturation}) blur(${clip.style.blur}px)`, borderRadius: clip.style.borderRadius }} /> : <div key={clip.id} className="absolute left-1/2 top-1/2 max-w-[90%] whitespace-pre-wrap px-3 py-1.5 text-center font-bold" style={{ transform: `translate(calc(-50% + ${clip.transform.x}px), calc(-50% + ${clip.transform.y}px)) scale(${clip.transform.scale}) rotate(${clip.transform.rotation}deg)`, opacity: clip.transform.opacity, color: clip.textColor, fontSize: `${Math.max(10, (clip.fontSize || 56) * 0.55)}px`, background: clip.backgroundColor, borderRadius: clip.style.borderRadius }}>{clip.text}</div>)}
              {activeAudios.map(({ clip, track }) => <SyncedAudio key={clip.id} clip={clip} playhead={playhead} playing={playing} trackMuted={track.muted} />)}
            </div>
          </section>
          <div className="flex h-12 shrink-0 items-center justify-center gap-3 border-y border-white/10 bg-[#0d111b]">
            <button onClick={() => setPlayhead(Math.max(0, playhead - 1))} className="text-[10px] text-slate-500 hover:text-white">-1s</button>
            <button onClick={() => setPlaying(!playing)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-950">{playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 translate-x-px" fill="currentColor" />}</button>
            <button onClick={() => setPlayhead(Math.min(project.duration, playhead + 1))} className="text-[10px] text-slate-500 hover:text-white">+1s</button>
            <span className="ml-2 min-w-28 text-center font-mono text-xs text-slate-300">{formatTime(playhead)} / {formatTime(project.duration)}</span>
          </div>

          <section className="h-[310px] shrink-0 overflow-hidden bg-[#0b0f18]">
            <div className="flex h-10 items-center gap-2 border-b border-white/10 px-3"><button onClick={() => selectedClipId && splitClip(selectedClipId, playhead)} disabled={!selectedClipId} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-slate-400 hover:bg-white/10 disabled:opacity-30"><Scissors className="h-3.5 w-3.5" />Dividir (S)</button><button onClick={() => selectedClipId && deleteClip(selectedClipId)} disabled={!selectedClipId} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button><div className="ml-auto flex items-center gap-2"><button onClick={() => addTrack("video")} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-white"><Plus className="h-3 w-3" />Video</button><button onClick={() => addTrack("audio")} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-white"><Plus className="h-3 w-3" />Audio</button><ZoomOut className="h-3.5 w-3.5 text-slate-600" /><input type="range" min="20" max="140" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-24 accent-cyan-400" /><ZoomIn className="h-3.5 w-3.5 text-slate-600" /></div></div>
            <div className="flex h-[270px] overflow-auto">
              <div className="sticky left-0 z-20 w-32 shrink-0 border-r border-white/10 bg-[#0d111b] pt-6">{project.tracks.map((track) => <div key={track.id} className="flex h-12 items-center gap-1 border-b border-white/5 px-2"><span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-400">{track.name}</span><button onClick={() => toggleTrackHidden(track.id)} className="text-slate-600 hover:text-white">{track.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button><button onClick={() => toggleTrackMute(track.id)} className="text-slate-600 hover:text-white">{track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}</button></div>)}</div>
              <div className="relative pt-6" style={{ width: Math.max(900, project.duration * zoom) }}>
                <div className="absolute left-0 right-0 top-0 h-6 border-b border-white/10 bg-[#0c1019]">{Array.from({ length: Math.ceil(project.duration) + 1 }).map((_, second) => second % Math.max(1, Math.round(60 / zoom)) === 0 ? <span key={second} className="absolute top-1 text-[8px] text-slate-600" style={{ left: second * zoom }}>{second}s</span> : null)}</div>
                <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-cyan-300" style={{ left: playhead * zoom }}><div className="-translate-x-1/2 border-x-4 border-t-6 border-x-transparent border-t-cyan-300" /></div>
                {project.tracks.map((track) => <div key={track.id} className="relative h-12 border-b border-white/5 bg-[linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)]" style={{ backgroundSize: `${zoom}px 100%` }} onDoubleClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setPlayhead((e.clientX - rect.left) / zoom); }}>{track.clips.map((clip) => <button key={clip.id} onClick={(e) => { e.stopPropagation(); selectClip(clip.id); setPlayhead(Math.max(clip.start, Math.min(playhead, clip.start + clip.duration))); }} onPointerDown={(e) => { if (e.button !== 0) return; const startX = e.clientX; const original = clip.start; const target = e.currentTarget; target.setPointerCapture(e.pointerId); const move = (ev: PointerEvent) => { const next = Math.max(0, original + (ev.clientX - startX) / zoom); target.style.left = `${next * zoom}px`; }; const up = (ev: PointerEvent) => { target.releasePointerCapture(ev.pointerId); target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", up); moveClip(clip.id, track.id, Math.max(0, original + (ev.clientX - startX) / zoom)); }; target.addEventListener("pointermove", move); target.addEventListener("pointerup", up); }} className={`absolute top-1 h-10 overflow-hidden rounded-md border px-2 text-left text-[9px] font-semibold ${selectedClipId === clip.id ? "border-cyan-300 bg-cyan-400/25 text-cyan-100" : clip.type === "audio" || clip.type === "music" || clip.type === "sfx" ? "border-violet-400/25 bg-violet-500/20 text-violet-200" : clip.type === "text" ? "border-amber-400/25 bg-amber-500/20 text-amber-100" : "border-blue-400/25 bg-blue-500/20 text-blue-100"}`} style={{ left: clip.start * zoom, width: Math.max(28, clip.duration * zoom) }}><span className="block truncate">{clip.name}</span><span className="block text-[8px] opacity-50">{formatTime(clip.duration)}</span></button>)}</div>)}
              </div>
            </div>
          </section>
        </main>

        <aside className="min-h-0 overflow-y-auto border-l border-white/10 bg-[#0b0f18] p-3">
          <p className="mb-3 text-xs font-bold">Propiedades</p>
          {!selectedClip ? <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-[10px] text-slate-500">Selecciona un clip para editarlo.</div> : <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="truncate text-xs font-bold">{selectedClip.name}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-slate-500">{selectedClip.type}</p></div>
            {selectedClip.type === "text" && <label className="block text-[10px] text-slate-500">Texto<textarea value={selectedClip.text || ""} onChange={(e) => updateClip(selectedClip.id, { text: e.target.value, name: e.target.value.slice(0, 30) || "Texto" })} rows={4} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white outline-none" /></label>}
            <div className="grid grid-cols-2 gap-2"><NumberField label="Inicio" value={selectedClip.start} step={0.1} onChange={(value) => updateClip(selectedClip.id, { start: Math.max(0, value) })} /><NumberField label="Duración" value={selectedClip.duration} step={0.1} onChange={(value) => updateClip(selectedClip.id, { duration: Math.max(0.2, value) })} /></div>
            <div className="grid grid-cols-2 gap-2"><NumberField label="X" value={selectedClip.transform.x} onChange={(value) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, x: value } })} /><NumberField label="Y" value={selectedClip.transform.y} onChange={(value) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, y: value } })} /><NumberField label="Escala" value={selectedClip.transform.scale} step={0.05} onChange={(value) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, scale: Math.max(0.05, value) } })} /><NumberField label="Rotación" value={selectedClip.transform.rotation} onChange={(value) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, rotation: value } })} /></div>
            <SliderField label="Opacidad" value={selectedClip.transform.opacity} min={0} max={1} step={0.01} onChange={(value) => updateClip(selectedClip.id, { transform: { ...selectedClip.transform, opacity: value } })} />
            {selectedClip.type !== "image" && selectedClip.type !== "text" && <><SliderField label="Volumen" value={selectedClip.volume} min={0} max={1} step={0.01} onChange={(volume) => updateClip(selectedClip.id, { volume })} /><SliderField label="Velocidad" value={selectedClip.playbackRate} min={0.25} max={4} step={0.05} onChange={(playbackRate) => updateClip(selectedClip.id, { playbackRate })} /></>}
            {!["audio", "music", "sfx"].includes(selectedClip.type) && <><SliderField label="Brillo" value={selectedClip.style.brightness} min={0.2} max={2} step={0.05} onChange={(brightness) => updateClip(selectedClip.id, { style: { ...selectedClip.style, brightness } })} /><SliderField label="Contraste" value={selectedClip.style.contrast} min={0.2} max={2} step={0.05} onChange={(contrast) => updateClip(selectedClip.id, { style: { ...selectedClip.style, contrast } })} /><SliderField label="Saturación" value={selectedClip.style.saturation} min={0} max={2} step={0.05} onChange={(saturation) => updateClip(selectedClip.id, { style: { ...selectedClip.style, saturation } })} /><SliderField label="Blur" value={selectedClip.style.blur} min={0} max={20} step={0.5} onChange={(blur) => updateClip(selectedClip.id, { style: { ...selectedClip.style, blur } })} /></>}
            <button onClick={() => deleteClip(selectedClip.id)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/5 py-2 text-[10px] font-bold text-red-300 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Eliminar clip</button>
          </div>}
          <div className="mt-5 border-t border-white/10 pt-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Herramientas EDUAI</p><div className="space-y-2"><Link href="/video-studio" className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5 text-[10px] hover:bg-white/10"><Film className="h-4 w-4 text-cyan-300" />Generar video</Link><Link href="/image-studio" className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5 text-[10px] hover:bg-white/10"><ImageIcon className="h-4 w-4 text-pink-300" />Generar imagen</Link><Link href="/audio-lab" className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5 text-[10px] hover:bg-white/10"><Mic2 className="h-4 w-4 text-violet-300" />Audio, voz y subtítulos</Link><Link href="/music" className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5 text-[10px] hover:bg-white/10"><Music2 className="h-4 w-4 text-emerald-300" />EduAI Music</Link></div></div>
        </aside>
      </div>
    </div>
  );
}

function NumberField({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (value: number) => void }) {
  return <label className="text-[9px] text-slate-500">{label}<input type="number" value={Number(value.toFixed(2))} step={step} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-400/30" /></label>;
}

function SliderField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="block text-[9px] text-slate-500"><span className="flex justify-between"><span>{label}</span><span>{Number(value.toFixed(2))}</span></span><input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-cyan-400" /></label>;
}
