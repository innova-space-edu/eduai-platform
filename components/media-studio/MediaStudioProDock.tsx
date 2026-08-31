"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronDown, ChevronUp, CloudUpload, Gauge, Loader2, Scissors, Sparkles, UploadCloud, Waves } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { analyzeAudioUrl, type AudioAnalysis } from "@/lib/media-studio/audio-analysis";
import { useMediaStudioStore } from "@/lib/media-studio/store";
import type { KeyframeEasing, MediaAsset, MediaAssetType, TransitionKind } from "@/lib/media-studio/types";

const BUCKET = "media-studio";

function mediaType(file: File): MediaAssetType | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  return null;
}

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120) || "asset";
}

async function durationFromFile(file: File) {
  if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) return 5;
  const url = URL.createObjectURL(file);
  try {
    const element = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
    element.preload = "metadata";
    element.src = url;
    return await new Promise<number>((resolve) => {
      const timeout = window.setTimeout(() => resolve(8), 6000);
      element.onloadedmetadata = () => { window.clearTimeout(timeout); resolve(Number.isFinite(element.duration) ? element.duration : 8); };
      element.onerror = () => { window.clearTimeout(timeout); resolve(8); };
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function formatTime(value: number) {
  const seconds = Math.max(0, value || 0);
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export default function MediaStudioProDock() {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<"audio" | "motion" | "cloud">("audio");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [easing, setEasing] = useState<KeyframeEasing>("ease-in-out");
  const [rendering, setRendering] = useState(false);

  const { project, selectedClipId, playhead, updateClip, addAsset, addClipFromAsset, setPlayhead, splitClip } = useMediaStudioStore();
  const selected = useMemo(() => project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId) || null, [project, selectedClipId]);
  const isAudio = Boolean(selected && ["audio", "music", "sfx"].includes(selected.type));

  useEffect(() => {
    setAnalysis(null);
  }, [selected?.id, selected?.sourceUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const center = rect.height / 2;
    const barWidth = rect.width / Math.max(1, analysis.peaks.length);
    ctx.fillStyle = "rgba(34,211,238,.78)";
    analysis.peaks.forEach((peak, index) => {
      const height = Math.max(2, peak * (rect.height - 8));
      ctx.fillRect(index * barWidth, center - height / 2, Math.max(1, barWidth - 1), height);
    });
    ctx.fillStyle = "rgba(251,191,36,.17)";
    for (const region of analysis.silence) {
      const x = (region.start / analysis.duration) * rect.width;
      const width = (region.duration / analysis.duration) * rect.width;
      ctx.fillRect(x, 0, width, rect.height);
    }
  }, [analysis, open, section]);

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Inicia sesión para guardar archivos permanentemente.");

      const { error: projectError } = await supabase.from("media_projects").upsert({
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
      if (projectError) throw projectError;

      let count = 0;
      for (const file of Array.from(files)) {
        const type = mediaType(file);
        if (!type) continue;
        const duration = await durationFromFile(file);
        const path = `${user.id}/${project.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
        if (uploadError) throw uploadError;
        const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signedError || !signed?.signedUrl) throw signedError || new Error("No se pudo crear URL temporal.");
        const { data: row, error: rowError } = await supabase.from("media_assets").insert({
          user_id: user.id,
          project_id: project.id,
          asset_type: type,
          name: file.name,
          source: "upload",
          provider: "Supabase Storage",
          storage_path: path,
          remote_url: null,
          mime_type: file.type || null,
          duration_seconds: duration,
          license: "Contenido del usuario",
          metadata: { size: file.size, private: true },
        }).select("id").single();
        if (rowError) throw rowError;
        const asset: MediaAsset = {
          id: String(row.id), type, name: file.name, url: signed.signedUrl, storagePath: path,
          duration, mimeType: file.type, source: "upload", provider: "Nube privada EDUAI", license: "Contenido del usuario",
        };
        addAsset(asset);
        addClipFromAsset(asset);
        count += 1;
      }
      setMessage(`${count} archivo${count === 1 ? "" : "s"} guardado${count === 1 ? "" : "s"} en la nube privada.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la subida.");
    } finally {
      setUploading(false);
    }
  }

  async function runAnalysis() {
    if (!selected?.sourceUrl || !isAudio) return;
    setAnalyzing(true);
    setMessage("");
    try {
      setAnalysis(await analyzeAudioUrl(selected.sourceUrl));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo analizar el audio.");
    } finally {
      setAnalyzing(false);
    }
  }

  function addKeyframe() {
    if (!selected) return;
    const time = Math.max(0, Math.min(selected.duration, playhead - selected.start));
    const keyframe = {
      id: `kf-${crypto.randomUUID()}`,
      time,
      easing,
      values: {
        ...selected.transform,
        ...selected.style,
        volume: selected.volume,
        playbackRate: selected.playbackRate,
      },
    };
    const keyframes = [...(selected.keyframes || []).filter((item) => Math.abs(item.time - time) > 0.03), keyframe].sort((a, b) => a.time - b.time);
    updateClip(selected.id, { keyframes });
    setMessage(`Keyframe añadido en ${formatTime(time)}.`);
  }

  function removeKeyframe(id: string) {
    if (!selected) return;
    updateClip(selected.id, { keyframes: (selected.keyframes || []).filter((item) => item.id !== id) });
  }

  function setTransition(side: "in" | "out", kind: TransitionKind) {
    if (!selected) return;
    const transition = { kind, duration: kind === "none" ? 0 : Math.min(1, Math.max(0.2, selected.duration / 4)) };
    updateClip(selected.id, side === "in" ? { transitionIn: transition } : { transitionOut: transition });
  }

  function kenBurns() {
    if (!selected || !["image", "video"].includes(selected.type)) return;
    updateClip(selected.id, {
      keyframes: [
        { id: `kf-${crypto.randomUUID()}`, time: 0, easing: "ease-in-out", values: { scale: 1, x: -18, y: 0, opacity: 1 } },
        { id: `kf-${crypto.randomUUID()}`, time: selected.duration, easing: "ease-in-out", values: { scale: 1.14, x: 22, y: -8, opacity: 1 } },
      ],
    });
    setMessage("Preset Ken Burns aplicado.");
  }

  function cutAtSilences() {
    if (!selected || !analysis?.silence.length) return;
    const regions = [...analysis.silence].filter((item) => item.start > 0.2 && item.end < selected.duration - 0.2).sort((a, b) => b.start - a.start);
    for (const region of regions) {
      splitClip(selected.id, selected.start + region.end);
      splitClip(selected.id, selected.start + region.start);
    }
    setMessage(`${regions.length} silencio${regions.length === 1 ? "" : "s"} marcado${regions.length === 1 ? "" : "s"} con cortes. Puedes eliminar los segmentos silenciosos desde el timeline.`);
  }

  async function queueRender(format: "mp4" | "mp3") {
    setRendering(true);
    setMessage("");
    try {
      const response = await fetch("/api/media-studio/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, format, resolution: format === "mp4" ? "1080p" : "audio" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo crear el render.");
      setMessage(`Render ${format.toUpperCase()} en cola · ${String(body.id).slice(0, 8)}…`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el render.");
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-[68] text-slate-100">
      {open && (
        <div className="mb-2 w-[430px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#101621]/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center border-b border-white/10">
            {([
              ["audio", Waves, "Audio"], ["motion", Activity, "Movimiento"], ["cloud", CloudUpload, "Nube/Render"],
            ] as const).map(([id, Icon, label]) => (
              <button key={id} onClick={() => setSection(id)} className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold ${section === id ? "bg-cyan-400/10 text-cyan-200" : "text-slate-500 hover:text-slate-300"}`}><Icon className="h-3.5 w-3.5" />{label}</button>
            ))}
          </div>

          <div className="max-h-[390px] overflow-y-auto p-3">
            {section === "audio" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><div><p className="text-xs font-bold">Forma de onda y silencios</p><p className="text-[9px] text-slate-500">Selecciona una pista de audio, música o SFX.</p></div><button disabled={!isAudio || analyzing} onClick={runAnalysis} className="rounded-lg bg-cyan-400/10 px-2.5 py-1.5 text-[10px] font-bold text-cyan-200 disabled:opacity-30">{analyzing ? "Analizando…" : "Analizar"}</button></div>
                <canvas ref={canvasRef} onClick={(event) => { if (!analysis || !selected) return; const rect = event.currentTarget.getBoundingClientRect(); const local = ((event.clientX - rect.left) / rect.width) * analysis.duration; setPlayhead(selected.start + local); }} className="h-24 w-full cursor-crosshair rounded-xl border border-white/10 bg-black/30" />
                {analysis && <div className="grid grid-cols-3 gap-2 text-center text-[9px]"><Metric label="Duración" value={formatTime(analysis.duration)} /><Metric label="Pico" value={`${Math.round(analysis.peak * 100)}%`} /><Metric label="Silencios" value={String(analysis.silence.length)} /></div>}
                {!!analysis?.silence.length && <div><button onClick={cutAtSilences} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 py-2 text-[10px] font-bold text-amber-200"><Scissors className="h-3.5 w-3.5" />Marcar cortes en silencios</button><div className="mt-2 flex flex-wrap gap-1">{analysis.silence.slice(0, 12).map((region, index) => <button key={`${region.start}-${index}`} onClick={() => selected && setPlayhead(selected.start + region.start)} className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-slate-400">{formatTime(region.start)} · {region.duration.toFixed(1)}s</button>)}</div></div>}
              </div>
            )}

            {section === "motion" && (
              <div className="space-y-3">
                {!selected ? <p className="rounded-xl bg-white/5 p-4 text-center text-[10px] text-slate-500">Selecciona un clip para animarlo.</p> : <>
                  <div className="flex items-center gap-2"><select value={easing} onChange={(event) => setEasing(event.target.value as KeyframeEasing)} className="flex-1 rounded-lg border border-white/10 bg-[#151d2a] px-2 py-2 text-[10px]"><option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in/out</option></select><button onClick={addKeyframe} className="rounded-lg bg-violet-500 px-3 py-2 text-[10px] font-bold">+ Keyframe</button></div>
                  <div className="relative h-8 rounded-lg bg-black/30"><div className="absolute inset-y-0 w-px bg-cyan-300" style={{ left: `${Math.max(0, Math.min(100, ((playhead - selected.start) / selected.duration) * 100))}%` }} />{(selected.keyframes || []).map((keyframe) => <button key={keyframe.id} onClick={() => setPlayhead(selected.start + keyframe.time)} title={`${keyframe.time.toFixed(2)} s`} className="absolute top-2 h-4 w-4 -translate-x-1/2 rotate-45 border border-violet-200 bg-violet-500" style={{ left: `${(keyframe.time / selected.duration) * 100}%` }} />)}</div>
                  {!!selected.keyframes?.length && <div className="flex flex-wrap gap-1">{selected.keyframes.map((keyframe) => <button key={keyframe.id} onDoubleClick={() => removeKeyframe(keyframe.id)} onClick={() => setPlayhead(selected.start + keyframe.time)} className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-slate-300">{keyframe.time.toFixed(2)}s · {keyframe.easing}</button>)}</div>}
                  <div className="grid grid-cols-2 gap-2"><label className="text-[9px] text-slate-500">Entrada<select value={selected.transitionIn?.kind || "none"} onChange={(event) => setTransition("in", event.target.value as TransitionKind)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[10px] text-slate-200"><TransitionOptions /></select></label><label className="text-[9px] text-slate-500">Salida<select value={selected.transitionOut?.kind || "none"} onChange={(event) => setTransition("out", event.target.value as TransitionKind)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[10px] text-slate-200"><TransitionOptions /></select></label></div>
                  <button onClick={kenBurns} disabled={!selected || !["image", "video"].includes(selected.type)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/10 py-2 text-[10px] font-bold text-violet-200 disabled:opacity-30"><Sparkles className="h-3.5 w-3.5" />Preset Ken Burns</button>
                  <p className="text-[9px] leading-4 text-slate-600">Cambia posición/escala/efectos en el inspector normal, mueve el playhead y pulsa + Keyframe. Doble clic en una etiqueta para borrarla.</p>
                </>}
              </div>
            )}

            {section === "cloud" && (
              <div className="space-y-3">
                <button disabled={uploading} onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 py-3 text-[10px] font-bold text-cyan-200 disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}Subir permanentemente a Nube EDUAI</button>
                <input ref={inputRef} type="file" multiple accept="video/*,audio/*,image/*" className="hidden" onChange={(event) => event.target.files && uploadFiles(event.target.files)} />
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="mb-2 flex items-center gap-2"><Gauge className="h-4 w-4 text-violet-300" /><p className="text-[10px] font-bold">Render Worker</p></div><p className="mb-3 text-[9px] leading-4 text-slate-500">Crea trabajos persistentes para MP4/MP3. La cola está separada de las funciones normales de Vercel para poder ejecutarse en un worker con FFmpeg/MediaBunny.</p><div className="grid grid-cols-2 gap-2"><button disabled={rendering} onClick={() => queueRender("mp4")} className="rounded-lg bg-violet-500 px-3 py-2 text-[10px] font-bold disabled:opacity-40">MP4 · 1080p</button><button disabled={rendering} onClick={() => queueRender("mp3")} className="rounded-lg bg-violet-500/20 px-3 py-2 text-[10px] font-bold text-violet-200 disabled:opacity-40">MP3 · Audio</button></div></div>
              </div>
            )}

            {message && <p className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2.5 text-[9px] leading-4 text-slate-300">{message}</p>}
          </div>
        </div>
      )}

      <button onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-full border border-white/10 bg-[#101621]/95 px-4 py-2.5 text-xs font-black shadow-xl backdrop-blur-xl hover:bg-[#172131]"><Waves className="h-4 w-4 text-cyan-300" />Herramientas Pro {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}</button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white/5 p-2"><p className="text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-200">{value}</p></div>;
}

function TransitionOptions() {
  return <><option value="none">Ninguna</option><option value="fade">Fade</option><option value="dissolve">Dissolve</option><option value="slide-left">Slide ←</option><option value="slide-right">Slide →</option><option value="zoom">Zoom</option></>;
}
