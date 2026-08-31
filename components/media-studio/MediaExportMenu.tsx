"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Download, FileAudio, FileJson, FileText, Image as ImageIcon, Loader2, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMediaStudioStore } from "@/lib/media-studio/store";
import {
  exportBrowserMp4,
  exportFramePng,
  exportProjectJson,
  exportSrt,
  exportWebM,
  renderWebMBlob,
} from "@/lib/media-studio/browser-export";

type CloudFormat = "mp4" | "mp3" | "wav";
type Resolution = "720p" | "1080p" | "4k";

function safeName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "eduai-media";
}

export default function MediaExportMenu() {
  const supabase = useMemo(() => createClient(), []);
  const { project, playhead } = useMediaStudioStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [resolution, setResolution] = useState<Resolution>("1080p");

  async function runLocal(kind: "webm" | "png" | "srt" | "json") {
    setBusy(kind); setError(""); setStatus(""); setProgress(0);
    try {
      if (kind === "webm") await exportWebM(project, setProgress);
      if (kind === "png") await exportFramePng(project, playhead);
      if (kind === "srt") await exportSrt(project);
      if (kind === "json") await exportProjectJson(project);
      if (kind !== "webm") setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  async function waitForJob(id: string, format: CloudFormat) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const response = await fetch(`/api/media-studio/render?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || "No se pudo consultar el render");
      const job = body.job;
      if (job.status === "error") throw new Error(job.error_message || `Falló la conversión ${format.toUpperCase()}`);
      if (job.status === "done") {
        if (!job.downloadUrl) throw new Error("El render terminó pero no se pudo firmar la descarga");
        const a = document.createElement("a");
        a.href = job.downloadUrl;
        a.download = `${safeName(project.name)}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatus(`${format.toUpperCase()} listo y guardado también en la nube privada EDUAI.`);
        return;
      }
      setStatus(job.status === "rendering" ? `Convirtiendo a ${format.toUpperCase()}…` : `Render ${format.toUpperCase()} en cola…`);
    }
    setStatus(`El render ${format.toUpperCase()} continúa en la cola. Puedes cerrar el editor y recuperarlo después desde EDUAI.`);
  }

  async function runCloud(format: CloudFormat) {
    setBusy(format); setError(""); setStatus(""); setProgress(0);
    try {
      if (format === "mp4") {
        const direct = await exportBrowserMp4(project, setProgress);
        if (direct) {
          setStatus("MP4 generado directamente en tu navegador, sin consumir servidor.");
          return;
        }
        setProgress(0);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Inicia sesión para convertir a formatos de alta compatibilidad.");

      setStatus("Creando master fiel del timeline…");
      const master = await renderWebMBlob(project, setProgress);
      const masterPath = `${user.id}/${project.id}/masters/${crypto.randomUUID()}.webm`;
      const { error: uploadError } = await supabase.storage.from("media-studio").upload(masterPath, master, {
        contentType: master.type || "video/webm",
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      setStatus("Master privado guardado. Preparando conversión…");
      const response = await fetch("/api/media-studio/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          format,
          resolution: format === "mp4" ? resolution : "audio",
          masterPath,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok || !body.id) throw new Error(body?.error || "No se pudo crear la conversión");

      if (!body.workerConfigured) {
        setStatus(`Master guardado y render ${format.toUpperCase()} en cola. Se procesará al conectar el Media Worker.`);
        return;
      }
      await waitForJob(body.id, format);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70]">
      {open && (
        <div className="mb-2 w-80 rounded-2xl border border-white/10 bg-[#101621]/95 p-3 text-slate-100 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="text-xs font-bold">Exportar Media Studio</p><p className="text-[9px] text-slate-500">Local cuando es posible · Worker para compatibilidad universal</p></div>
            <Download className="h-4 w-4 text-cyan-300" />
          </div>

          <div className="mb-2 flex items-center justify-between rounded-xl border border-white/8 bg-white/5 px-2.5 py-2">
            <span className="text-[9px] font-bold text-slate-400">Resolución MP4</span>
            <select value={resolution} onChange={(event) => setResolution(event.target.value as Resolution)} className="rounded-lg border border-white/10 bg-[#151d2a] px-2 py-1 text-[9px] text-slate-200">
              <option value="720p">720p</option><option value="1080p">1080p</option><option value="4k">4K</option>
            </select>
          </div>

          <div className="space-y-2">
            <ExportButton icon={<Video className="h-4 w-4 text-emerald-300" />} title="Video MP4" subtitle="H.264/AAC · navegador compatible o FFmpeg Worker" busy={busy === "mp4"} onClick={() => runCloud("mp4")} />
            <ExportButton icon={<Video className="h-4 w-4 text-cyan-300" />} title="Video WebM" subtitle="Montaje completo local · sin servidor" busy={busy === "webm"} onClick={() => runLocal("webm")} />
            <ExportButton icon={<FileAudio className="h-4 w-4 text-violet-300" />} title="Audio MP3" subtitle="Mezcla final · 192 kbps mediante FFmpeg Worker" busy={busy === "mp3"} onClick={() => runCloud("mp3")} />
            <ExportButton icon={<FileAudio className="h-4 w-4 text-sky-300" />} title="Audio WAV" subtitle="PCM 48 kHz · máxima compatibilidad" busy={busy === "wav"} onClick={() => runCloud("wav")} />
            <ExportButton icon={<ImageIcon className="h-4 w-4 text-pink-300" />} title="Frame PNG" subtitle={`Captura en ${playhead.toFixed(1)} s`} busy={busy === "png"} onClick={() => runLocal("png")} />
            <ExportButton icon={<FileText className="h-4 w-4 text-amber-300" />} title="Subtítulos SRT" subtitle="Usa las capas de texto ordenadas por tiempo" busy={busy === "srt"} onClick={() => runLocal("srt")} />
            <ExportButton icon={<FileJson className="h-4 w-4 text-fuchsia-300" />} title="Proyecto EDUAI JSON" subtitle="Pistas, clips, keyframes y edición no destructiva" busy={busy === "json"} onClick={() => runLocal("json")} />
          </div>
          {busy && ["mp4", "mp3", "wav", "webm"].includes(busy) && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
          {status && <p className="mt-3 rounded-lg bg-cyan-400/8 p-2 text-[9px] leading-4 text-cyan-100">{status}</p>}
          {error && <p className="mt-3 rounded-lg bg-red-500/10 p-2 text-[9px] leading-4 text-red-300">{error}</p>}
        </div>
      )}
      <button onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2.5 text-xs font-black text-slate-950 shadow-xl shadow-cyan-500/20 hover:bg-cyan-300">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Exportar
      </button>
    </div>
  );
}

function ExportButton({ icon, title, subtitle, busy, onClick }: { icon: ReactNode; title: string; subtitle: string; busy: boolean; onClick: () => void }) {
  return <button disabled={busy} onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-2.5 text-left hover:bg-white/10 disabled:opacity-60"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/20">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}</div><div><p className="text-[10px] font-bold">{title}</p><p className="mt-0.5 text-[9px] text-slate-500">{subtitle}</p></div></button>;
}
