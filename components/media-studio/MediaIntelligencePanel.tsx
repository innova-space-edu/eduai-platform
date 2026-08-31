"use client";

import { useMemo, useState } from "react";
import { Captions, ChevronDown, ChevronUp, Film, Loader2, Sparkles, WandSparkles } from "lucide-react";
import { useMediaStudioStore } from "@/lib/media-studio/store";
import type { MediaAsset } from "@/lib/media-studio/types";

type Cue = { start: number; end: number; text: string };
type BrollSuggestion = { at: number; duration: number; query: string; reason: string };

function wordsOrSentences(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const sentences = cleaned.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  if (sentences.length > 1) return sentences;
  const words = cleaned.split(/\s+/);
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += 10) chunks.push(words.slice(index, index + 10).join(" "));
  return chunks;
}

function cueify(chunks: Array<{ startSeconds: number; endSeconds: number; cleanedText: string }>): Cue[] {
  const cues: Cue[] = [];
  for (const chunk of chunks) {
    const parts = wordsOrSentences(chunk.cleanedText);
    if (!parts.length) continue;
    const weights = parts.map((part) => Math.max(1, part.split(/\s+/).length));
    const total = weights.reduce((sum, value) => sum + value, 0);
    const duration = Math.max(0.5, chunk.endSeconds - chunk.startSeconds);
    let cursor = chunk.startSeconds;
    parts.forEach((part, index) => {
      const share = duration * (weights[index] / total);
      const end = index === parts.length - 1 ? chunk.endSeconds : cursor + share;
      cues.push({ start: cursor, end, text: part });
      cursor = end;
    });
  }
  return cues;
}

export default function MediaIntelligencePanel() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"transcribe" | "captions" | "broll" | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [cues, setCues] = useState<Cue[]>([]);
  const [suggestions, setSuggestions] = useState<BrollSuggestion[]>([]);
  const [captionMode, setCaptionMode] = useState<"phrases" | "words">("phrases");

  const { project, selectedClipId, addTextClip, updateClip, addAsset, addClipFromAsset } = useMediaStudioStore();
  const selected = useMemo(() => project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId) || null, [project, selectedClipId]);
  const canTranscribe = Boolean(selected?.sourceUrl && ["audio", "video", "music"].includes(selected.type));

  async function transcribe() {
    if (!selected?.sourceUrl || !canTranscribe) return;
    setBusy("transcribe"); setStatus(""); setProgress(0); setSuggestions([]);
    try {
      const response = await fetch(selected.sourceUrl);
      if (!response.ok) throw new Error(`No se pudo leer el archivo (${response.status})`);
      const blob = await response.blob();
      const [{ transcribeWhisperLongForm }, { transcribeWhisperFeaturesWorker }] = await Promise.all([
        import("@/lib/ai/local/whisper-longform"),
        import("@/lib/ai/local/whisper-worker-client"),
      ]);
      const backend = typeof navigator !== "undefined" && "gpu" in navigator ? "webgpu" : "wasm";
      const result = await transcribeWhisperLongForm(blob, {
        backend,
        language: "auto",
        task: "transcribe",
        qualityPreset: "balanced",
        transcribeFeatures: transcribeWhisperFeaturesWorker,
        onProgress: (event) => {
          if (event.phase === "model" && event.modelProgress?.total) setProgress(Math.min(0.95, (event.chunkIndex + event.modelProgress.current / event.modelProgress.total) / Math.max(1, event.chunkCount)));
          else if (event.phase === "merge") setProgress(0.98);
        },
      });
      const next = cueify(result.chunks.map((chunk) => ({ startSeconds: chunk.startSeconds, endSeconds: chunk.endSeconds, cleanedText: chunk.cleanedText })));
      setCues(next);
      setProgress(1);
      setStatus(`Transcripción local lista: ${next.length} segmento${next.length === 1 ? "" : "s"} · idioma ${result.language}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo transcribir.");
    } finally {
      setBusy(null);
    }
  }

  function createCaptions() {
    if (!selected || !cues.length) return;
    setBusy("captions");
    let count = 0;
    try {
      if (captionMode === "phrases") {
        for (const cue of cues) {
          addTextClip(cue.text, selected.start + cue.start);
          const id = useMediaStudioStore.getState().selectedClipId;
          if (!id) continue;
          updateClip(id, {
            duration: Math.max(0.5, cue.end - cue.start),
            fontSize: 34,
            transform: { x: 0, y: 330, scale: 1, rotation: 0, opacity: 1 },
            backgroundColor: "rgba(0,0,0,.58)",
            style: { brightness: 1, contrast: 1, saturation: 1, blur: 0, borderRadius: 10 },
          });
          count += 1;
        }
      } else {
        for (const cue of cues) {
          const words = cue.text.split(/\s+/).filter(Boolean);
          const duration = Math.max(0.6, cue.end - cue.start);
          const each = duration / Math.max(1, words.length);
          words.forEach((word, index) => {
            addTextClip(word, selected.start + cue.start + index * each);
            const id = useMediaStudioStore.getState().selectedClipId;
            if (!id) return;
            updateClip(id, {
              duration: Math.max(0.18, each * 1.08),
              fontSize: 42,
              transform: { x: 0, y: 330, scale: 1, rotation: 0, opacity: 1 },
              backgroundColor: "rgba(0,0,0,.52)",
              style: { brightness: 1, contrast: 1, saturation: 1, blur: 0, borderRadius: 10 },
              transitionIn: { kind: "fade", duration: Math.min(0.1, each / 3) },
              transitionOut: { kind: "fade", duration: Math.min(0.1, each / 3) },
            });
            count += 1;
          });
        }
      }
      setStatus(`${count} capa${count === 1 ? "" : "s"} de subtítulos añadida${count === 1 ? "" : "s"} al timeline.`);
    } finally {
      setBusy(null);
    }
  }

  async function planBroll() {
    if (!cues.length) return;
    setBusy("broll"); setStatus("");
    try {
      const response = await fetch("/api/media-studio/broll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cues, language: "es" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo planificar B-roll");
      const next = Array.isArray(body.suggestions) ? body.suggestions : [];
      setSuggestions(next);
      setStatus(`${next.length} sugerencia${next.length === 1 ? "" : "s"} de B-roll preparada${next.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo generar B-roll.");
    } finally {
      setBusy(null);
    }
  }

  async function insertSuggestion(suggestion: BrollSuggestion) {
    if (!selected) return;
    setStatus(`Buscando “${suggestion.query}”…`);
    try {
      let external: MediaAsset | undefined;
      for (const provider of ["pexels", "pixabay"] as const) {
        const response = await fetch(`/api/media-studio/search?q=${encodeURIComponent(suggestion.query)}&provider=${provider}`);
        const body = await response.json();
        external = Array.isArray(body.items) ? body.items.find((item: MediaAsset) => item.type === "video" || item.type === "image") : undefined;
        if (external) break;
      }
      if (!external) throw new Error("No se encontró material editable para esa sugerencia.");

      setStatus(`Guardando “${external.name}” en la nube privada…`);
      const importResponse = await fetch("/api/media-studio/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset: external, project }),
      });
      const importBody = await importResponse.json().catch(() => null);
      if (!importResponse.ok || !importBody?.asset) throw new Error(importBody?.error || "No se pudo guardar el B-roll en EDUAI.");
      const asset = importBody.asset as MediaAsset;

      addAsset(asset);
      addClipFromAsset(asset, undefined, selected.start + suggestion.at);
      const id = useMediaStudioStore.getState().selectedClipId;
      if (id) updateClip(id, { duration: suggestion.duration, transitionIn: { kind: "fade", duration: 0.25 }, transitionOut: { kind: "fade", duration: 0.25 } });
      setStatus(`B-roll guardado y añadido: ${asset.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo insertar el B-roll.");
    }
  }

  async function insertAllBroll() {
    for (const suggestion of suggestions) await insertSuggestion(suggestion);
  }

  return (
    <div className="fixed bottom-4 left-[360px] z-[66] text-slate-100">
      {open && (
        <div className="mb-2 w-[390px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#101621]/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-fuchsia-300" /><div><p className="text-xs font-bold">Inteligencia audiovisual</p><p className="text-[9px] text-slate-500">Whisper local · subtítulos · B-roll automático</p></div></div>
          <button onClick={transcribe} disabled={!canTranscribe || busy !== null} className="flex w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-500 py-2.5 text-[10px] font-black disabled:opacity-35">{busy === "transcribe" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Captions className="h-4 w-4" />}Transcribir clip seleccionado</button>
          {busy === "transcribe" && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-fuchsia-400 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}

          {!!cues.length && <>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2.5"><p className="text-[9px] font-bold text-slate-300">Vista previa</p><p className="mt-1 max-h-20 overflow-y-auto text-[9px] leading-4 text-slate-500">{cues.slice(0, 6).map((cue) => cue.text).join(" ")}</p></div>
            <div className="mt-3 flex gap-2"><select value={captionMode} onChange={(event) => setCaptionMode(event.target.value as typeof captionMode)} className="flex-1 rounded-lg border border-white/10 bg-[#151d2a] px-2 text-[10px]"><option value="phrases">Subtítulos por frase</option><option value="words">Palabra a palabra</option></select><button onClick={createCaptions} disabled={busy !== null} className="rounded-lg bg-white/10 px-3 py-2 text-[10px] font-bold hover:bg-white/15">Añadir</button></div>
            <button onClick={planBroll} disabled={busy !== null} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 py-2.5 text-[10px] font-bold text-cyan-200"><Film className="h-4 w-4" />{busy === "broll" ? "Analizando…" : "Proponer B-roll automático"}</button>
          </>}

          {!!suggestions.length && <div className="mt-3 space-y-1.5"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">B-roll sugerido</p><button onClick={insertAllBroll} className="text-[9px] font-bold text-cyan-300">Guardar + insertar todo</button></div>{suggestions.map((item, index) => <button key={`${item.at}-${index}`} onClick={() => insertSuggestion(item)} className="w-full rounded-lg border border-white/8 bg-white/5 p-2 text-left hover:bg-white/10"><div className="flex justify-between gap-2"><p className="truncate text-[10px] font-semibold">{item.query}</p><span className="text-[9px] text-slate-500">{item.at.toFixed(1)}s</span></div><p className="mt-0.5 text-[9px] leading-4 text-slate-600">{item.reason}</p></button>)}</div>}
          {status && <p className="mt-3 rounded-lg bg-black/20 p-2 text-[9px] leading-4 text-slate-300">{status}</p>}
          <p className="mt-2 text-[8px] leading-3 text-slate-700">El B-roll externo se copia primero a la nube privada para que siga disponible y pueda renderizarse sin depender de CORS. El modo palabra a palabra distribuye tiempos dentro de cada segmento Whisper.</p>
        </div>
      )}
      <button onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-full border border-white/10 bg-[#101621]/95 px-4 py-2.5 text-xs font-black shadow-xl backdrop-blur-xl hover:bg-[#172131]"><WandSparkles className="h-4 w-4 text-fuchsia-300" />Subtítulos & B-roll {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}</button>
    </div>
  );
}
