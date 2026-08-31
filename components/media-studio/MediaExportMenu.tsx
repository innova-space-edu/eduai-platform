"use client";

import { useState, type ReactNode } from "react";
import { Download, FileJson, FileText, Image as ImageIcon, Loader2, Video } from "lucide-react";
import { useMediaStudioStore } from "@/lib/media-studio/store";
import { exportFramePng, exportProjectJson, exportSrt, exportWebM } from "@/lib/media-studio/browser-export";

export default function MediaExportMenu() {
  const { project, playhead } = useMediaStudioStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function run(kind: "webm" | "png" | "srt" | "json") {
    setBusy(kind); setError(""); setProgress(0);
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

  return (
    <div className="fixed bottom-4 right-4 z-[70]">
      {open && (
        <div className="mb-2 w-72 rounded-2xl border border-white/10 bg-[#101621]/95 p-3 text-slate-100 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold">Exportar Media Studio</p><p className="text-[9px] text-slate-500">Formatos disponibles en navegador</p></div><Download className="h-4 w-4 text-cyan-300" /></div>
          <div className="space-y-2">
            <ExportButton icon={<Video className="h-4 w-4 text-cyan-300" />} title="Video WebM" subtitle="Montaje completo con audio · tiempo real" busy={busy === "webm"} onClick={() => run("webm")} />
            {busy === "webm" && <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
            <ExportButton icon={<ImageIcon className="h-4 w-4 text-pink-300" />} title="Frame PNG" subtitle={`Captura en ${playhead.toFixed(1)} s`} busy={busy === "png"} onClick={() => run("png")} />
            <ExportButton icon={<FileText className="h-4 w-4 text-amber-300" />} title="Subtítulos SRT" subtitle="Usa las capas de texto ordenadas por tiempo" busy={busy === "srt"} onClick={() => run("srt")} />
            <ExportButton icon={<FileJson className="h-4 w-4 text-violet-300" />} title="Proyecto EDUAI JSON" subtitle="Conserva pistas, clips y edición no destructiva" busy={busy === "json"} onClick={() => run("json")} />
          </div>
          {error && <p className="mt-3 rounded-lg bg-red-500/10 p-2 text-[9px] leading-4 text-red-300">{error}</p>}
          <p className="mt-3 text-[9px] leading-4 text-slate-600">MP4/MP3 de alta compatibilidad se reservarán para el render worker; WebM evita subir el proyecto a un servidor para esta V1.</p>
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
