"use client";

import { CheckCircle2, Download, ExternalLink, Film, Link2, Loader2, Music2, Plus, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

export type ImportedUrlMedia = {
  name: string;
  kind: "audio" | "video";
  url: string;
  downloadUrl?: string;
  duration: number;
  mime?: string;
  extension?: string;
  source: string;
  thumbnail?: string;
};

type Props = {
  onImport: (media: ImportedUrlMedia) => void;
  onNotice?: (message: string) => void;
};

type MediaInfo = {
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  webpage_url?: string;
  extractor?: string;
};

type Job = {
  id: string;
  status: "queued" | "processing" | "done" | "error";
  progress?: number;
  title?: string;
  filename?: string;
  media_url?: string;
  download_url?: string;
  mime?: string;
  extension?: string;
  duration?: number;
  error?: string;
};

function apiBase() {
  return (process.env.NEXT_PUBLIC_MEDIA_WORKER_URL || "").replace(/\/$/, "");
}

function fmtSeconds(value = 0) {
  const total = Math.max(0, Math.round(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function UrlMediaImporter({ onImport, onNotice }: Props) {
  const worker = useMemo(apiBase, []);
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"audio" | "video">("audio");
  const [audioBitrate, setAudioBitrate] = useState("192");
  const [videoHeight, setVideoHeight] = useState("1080");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<Job | null>(null);

  async function inspect() {
    if (!url.trim()) return;
    if (!worker) {
      onNotice?.("Configura NEXT_PUBLIC_MEDIA_WORKER_URL para activar el importador por URL.");
      return;
    }
    setBusy(true);
    setJob(null);
    try {
      const response = await fetch(`${worker}/v1/media/inspect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "No se pudo analizar la URL.");
      setInfo(data);
      onNotice?.("Enlace analizado. Elige formato y confirma que tienes derecho a usar el contenido.");
    } catch (error) {
      setInfo(null);
      onNotice?.(error instanceof Error ? error.message : "No se pudo analizar la URL.");
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (!info || !rightsConfirmed || !worker) return;
    setBusy(true);
    try {
      const response = await fetch(`${worker}/v1/media/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          mode,
          audio_bitrate_kbps: Number(audioBitrate),
          video_height: Number(videoHeight),
          rights_confirmed: rightsConfirmed,
        }),
      });
      const created = await response.json();
      if (!response.ok) throw new Error(created?.detail || "No se pudo iniciar la conversión.");
      setJob(created);
      pollJob(created.id);
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : "No se pudo iniciar la conversión.");
      setBusy(false);
    }
  }

  async function pollJob(id: string) {
    try {
      for (let attempt = 0; attempt < 240; attempt += 1) {
        const response = await fetch(`${worker}/v1/media/jobs/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data: Job = await response.json();
        if (!response.ok) throw new Error((data as { error?: string }).error || "No se pudo consultar el trabajo.");
        setJob(data);
        if (data.status === "done") {
          setBusy(false);
          onNotice?.("Conversión terminada. Puedes importarla directamente a la línea de tiempo o descargarla.");
          return;
        }
        if (data.status === "error") throw new Error(data.error || "La conversión falló.");
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
      throw new Error("La conversión excedió el tiempo de seguimiento del navegador.");
    } catch (error) {
      setBusy(false);
      onNotice?.(error instanceof Error ? error.message : "No se pudo completar la conversión.");
    }
  }

  function importResult() {
    if (!job?.media_url || job.status !== "done") return;
    onImport({
      name: job.filename || `${info?.title || "contenido"}.${mode === "audio" ? "mp3" : "mp4"}`,
      kind: mode,
      url: job.media_url,
      downloadUrl: job.download_url || job.media_url,
      duration: job.duration || info?.duration || 0,
      mime: job.mime || (mode === "audio" ? "audio/mpeg" : "video/mp4"),
      extension: job.extension || (mode === "audio" ? "mp3" : "mp4"),
      source: info?.extractor || "url",
      thumbnail: info?.thumbnail,
    });
    onNotice?.("Contenido importado al panel de archivos. Usa + para colocarlo en la línea de tiempo.");
  }

  return <div className="space-y-3">
    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-3">
      <div className="mb-2 flex items-center gap-2"><Link2 size={15} className="text-cyan-300" /><p className="text-xs font-semibold">Importar desde URL</p></div>
      <div className="flex gap-2">
        <input value={url} onChange={(event) => { setUrl(event.target.value); setInfo(null); setJob(null); }} onKeyDown={(event) => { if (event.key === "Enter") void inspect(); }} placeholder="Pega un enlace público de video o audio" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none" />
        <button onClick={() => void inspect()} disabled={busy || !url.trim()} className="rounded-xl bg-cyan-600 px-3 text-xs font-semibold disabled:opacity-40">{busy && !job ? <Loader2 size={14} className="animate-spin" /> : "Analizar"}</button>
      </div>
      <p className="mt-2 text-[9px] leading-4 text-slate-500">Solo contenido público que poseas, sea de dominio público o tengas autorización para reutilizar. No admite cuentas, cookies ni contenido privado/restringido.</p>
    </div>

    {info && <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      {info.thumbnail ? <img src={info.thumbnail} alt="" className="aspect-video w-full object-cover" /> : null}
      <div className="space-y-2 p-3">
        <div><p className="line-clamp-2 text-xs font-semibold">{info.title}</p><p className="mt-1 text-[9px] text-slate-500">{info.uploader || info.extractor || "Fuente externa"} · {fmtSeconds(info.duration)}</p></div>
        {info.webpage_url ? <a href={info.webpage_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] text-cyan-300">Abrir fuente <ExternalLink size={10} /></a> : null}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setMode("audio")} className={`rounded-xl border p-2 text-left ${mode === "audio" ? "border-emerald-400/35 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}><Music2 size={14} className="mb-1" /><p className="text-[10px] font-semibold">MP3 · solo audio</p></button>
          <button onClick={() => setMode("video")} className={`rounded-xl border p-2 text-left ${mode === "video" ? "border-cyan-400/35 bg-cyan-500/10" : "border-white/10 bg-white/[0.03]"}`}><Film size={14} className="mb-1" /><p className="text-[10px] font-semibold">MP4 · video</p></button>
        </div>

        {mode === "audio" ? <label className="block text-[9px] text-slate-400">Calidad MP3<select value={audioBitrate} onChange={(event) => setAudioBitrate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-2 text-[10px]"><option value="128">128 kbps</option><option value="192">192 kbps</option><option value="256">256 kbps</option><option value="320">320 kbps</option></select></label> : <label className="block text-[9px] text-slate-400">Resolución máxima<select value={videoHeight} onChange={(event) => setVideoHeight(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-2 text-[10px]"><option value="360">360p</option><option value="480">480p</option><option value="720">720p</option><option value="1080">1080p</option></select></label>}

        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-500/5 p-2 text-[9px] leading-4 text-amber-100"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} className="mt-0.5" /><span><ShieldCheck size={11} className="mr-1 inline" />Confirmo que tengo derechos o autorización para descargar y reutilizar este contenido.</span></label>
        <button onClick={() => void convert()} disabled={busy || !rightsConfirmed} className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 p-2.5 text-xs font-semibold disabled:opacity-40">{busy ? <><Loader2 size={13} className="mr-1 inline animate-spin" />Procesando {job?.progress ? `${Math.round(job.progress)}%` : "…"}</> : `Convertir a ${mode === "audio" ? "MP3" : "MP4"}`}</button>
      </div>
    </div>}

    {job?.status === "done" && job.media_url ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-emerald-200"><CheckCircle2 size={15} /><p className="text-xs font-semibold">Archivo listo</p></div>
      <p className="mb-2 truncate text-[9px] text-slate-400">{job.filename}</p>
      <div className="grid grid-cols-2 gap-2"><button onClick={importResult} className="rounded-xl bg-emerald-500/15 p-2 text-[10px] font-semibold text-emerald-100"><Plus size={12} className="mr-1 inline" />Importar al editor</button><a href={job.download_url || job.media_url} target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 p-2 text-center text-[10px]"><Download size={12} className="mr-1 inline" />Descargar</a></div>
    </div> : null}
  </div>;
}
