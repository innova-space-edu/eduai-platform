"use client";

import { useMemo, useState } from "react";
import { AudioLines, ChevronDown, ChevronUp, Film, Layers3, Loader2, SlidersHorizontal, Sparkles, Volume2 } from "lucide-react";
import { useMediaStudioStore } from "@/lib/media-studio/store";
import type { MediaAsset } from "@/lib/media-studio/types";

type Operation = "proxy" | "denoise" | "normalize" | "stems" | "extract_audio";

type ProcessJob = {
  id: string;
  status: string;
  progress?: number;
  error_message?: string | null;
  signedOutputs?: Array<{ path: string; url?: string }>;
};

export default function MediaProcessingPanel() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Operation | null>(null);
  const [status, setStatus] = useState("");
  const { project, selectedClipId, addAsset } = useMediaStudioStore();
  const selected = useMemo(() => project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId) || null, [project, selectedClipId]);
  const canAudio = Boolean(selected && ["audio", "music", "sfx", "video"].includes(selected.type));
  const canProxy = selected?.type === "video";
  const saved = Boolean(selected?.assetId && selected?.sourceUrl);

  function addResults(operation: Operation, job: ProcessJob) {
    for (const [index, output] of (job.signedOutputs || []).entries()) {
      if (!output.url) continue;
      const video = operation === "proxy";
      const asset: MediaAsset = {
        id: `processed-${job.id}-${index}`,
        type: video ? "video" : "audio",
        name: output.path.split("/").pop() || `${operation}-${index + 1}`,
        url: output.url,
        storagePath: output.path,
        source: "eduai",
        provider: operation === "stems" ? "EDUAI · Demucs" : "EDUAI · Media Worker",
        license: "Derivado del contenido del usuario",
        mimeType: video ? "video/mp4" : output.path.endsWith(".mp3") ? "audio/mpeg" : "audio/wav",
      };
      addAsset(asset);
    }
  }

  async function waitForJob(id: string, operation: Operation) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const response = await fetch(`/api/media-studio/process?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || "No se pudo consultar el procesamiento");
      const job = body.job as ProcessJob;
      if (job.status === "error") throw new Error(job.error_message || "El procesamiento falló");
      if (job.status === "done") {
        addResults(operation, job);
        setStatus(`Proceso terminado. ${(job.signedOutputs || []).length} resultado(s) agregado(s) a la Biblioteca EDUAI.`);
        return;
      }
      setStatus(job.status === "processing" ? `Procesando · ${Math.round(Number(job.progress || 0) * 100)}%` : "Trabajo en cola…");
    }
    setStatus("El trabajo continúa en la cola y sus resultados aparecerán en la Biblioteca EDUAI cuando finalice.");
  }

  async function run(operation: Operation, parameters: Record<string, unknown> = {}) {
    if (!selected?.assetId) {
      setStatus("Este clip debe estar guardado en la Nube EDUAI antes de procesarlo.");
      return;
    }
    setBusy(operation); setStatus("");
    try {
      const response = await fetch("/api/media-studio/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selected.assetId, operation, projectId: project.id, parameters }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok || !body.id) throw new Error(body?.error || "No se pudo crear el trabajo");
      if (!body.workerConfigured) {
        setStatus("Trabajo guardado en cola. Se procesará cuando el Media Worker esté conectado.");
        return;
      }
      await waitForJob(body.id, operation);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo procesar el clip.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed bottom-4 left-[690px] z-[65] text-slate-100 max-xl:left-auto max-xl:right-[118px]">
      {open && (
        <div className="mb-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#101621]/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-amber-300" /><div><p className="text-xs font-bold">Procesamiento Pro</p><p className="text-[9px] text-slate-500">FFmpeg · limpieza · proxies · Demucs</p></div></div>
          {!selected ? <p className="rounded-xl bg-white/5 p-4 text-center text-[10px] text-slate-500">Selecciona un clip del timeline.</p> : <>
            <div className="mb-3 rounded-xl border border-white/8 bg-black/20 p-2.5"><p className="truncate text-[10px] font-bold">{selected.name}</p><p className="mt-1 text-[9px] text-slate-600">{selected.type} · {saved ? "asset EDUAI" : "requiere guardado"}</p></div>
            <div className="grid grid-cols-2 gap-2">
              <Action disabled={!canProxy || busy !== null} busy={busy === "proxy"} icon={<Film className="h-4 w-4" />} title="Crear proxy" desc="720p liviano" onClick={() => run("proxy")} />
              <Action disabled={!canAudio || busy !== null} busy={busy === "extract_audio"} icon={<AudioLines className="h-4 w-4" />} title="Extraer audio" desc="MP3 192 kbps" onClick={() => run("extract_audio")} />
              <Action disabled={!canAudio || busy !== null} busy={busy === "denoise"} icon={<Sparkles className="h-4 w-4" />} title="Limpiar voz" desc="Denoise + LUFS" onClick={() => run("denoise")} />
              <Action disabled={!canAudio || busy !== null} busy={busy === "normalize"} icon={<Volume2 className="h-4 w-4" />} title="Normalizar" desc="-16 LUFS" onClick={() => run("normalize")} />
            </div>
            <button disabled={!canAudio || busy !== null} onClick={() => run("stems", { mode: "4", model: "htdemucs" })} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/10 py-2.5 text-[10px] font-black text-violet-200 disabled:opacity-30">{busy === "stems" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers3 className="h-4 w-4" />}Separar voz · batería · bajo · otros</button>
            {status && <p className="mt-3 rounded-lg bg-black/20 p-2 text-[9px] leading-4 text-slate-300">{status}</p>}
          </>}
        </div>
      )}
      <button onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-[#1a1710]/95 px-4 py-2.5 text-xs font-black text-amber-100 shadow-xl backdrop-blur-xl hover:bg-amber-400/10"><SlidersHorizontal className="h-4 w-4 text-amber-300" />Procesar {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}</button>
    </div>
  );
}

function Action({ disabled, busy, icon, title, desc, onClick }: { disabled: boolean; busy: boolean; icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className="rounded-xl border border-white/8 bg-white/5 p-2.5 text-left hover:bg-white/10 disabled:opacity-30"><div className="flex items-center gap-2 text-amber-200">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}<span className="text-[10px] font-bold">{title}</span></div><p className="mt-1 text-[8px] text-slate-600">{desc}</p></button>;
}
