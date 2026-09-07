"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

type FreesoundResult = {
  id: string;
  name: string;
  creator: string;
  duration: number;
  license: string;
  tags: string[];
  previewUrl: string;
  externalUrl: string;
  source: "freesound";
};

function fmt(value: number) {
  const safe = Math.max(0, value || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function shell() {
  return document.querySelector<HTMLElement>(".multimedia-responsive-shell");
}

function setNativeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function nextPaint() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function findEditorFileInput(root: HTMLElement) {
  return root.querySelector<HTMLInputElement>('aside:first-of-type input[type="file"][multiple]');
}

async function putFileInEditor(file: File, addToTimeline = true) {
  const root = shell();
  if (!root) throw new Error("No se encontró el editor multimedia.");

  const filesTab = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.title === "Archivos");
  filesTab?.click();
  await nextPaint();

  const input = findEditorFileInput(root);
  if (!input) throw new Error("No se encontró el cargador de archivos del editor.");

  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));

  if (!addToTimeline) return;

  window.setTimeout(() => {
    const currentRoot = shell();
    if (!currentRoot) return;
    const nameNode = Array.from(currentRoot.querySelectorAll<HTMLParagraphElement>("p")).find((node) => node.textContent?.trim() === file.name);
    const row = nameNode?.closest("div.flex.items-center");
    const addButton = row?.querySelector<HTMLButtonElement>("button");
    addButton?.click();
  }, 650);
}

function findInspectorTrackSelect(root: HTMLElement) {
  const inspector = Array.from(root.querySelectorAll<HTMLElement>("aside")).at(-1);
  if (!inspector) return null;
  const label = Array.from(inspector.querySelectorAll<HTMLLabelElement>("label")).find((item) => {
    const text = item.childNodes[0]?.textContent?.trim() || item.textContent?.trim() || "";
    return text.startsWith("Pista");
  });
  return label?.querySelector<HTMLSelectElement>("select") || null;
}

function moveSelectedClipTrack(direction: -1 | 1) {
  const root = shell();
  if (!root) return false;
  const select = findInspectorTrackSelect(root);
  if (!select || select.options.length < 2) return false;
  const next = Math.max(0, Math.min(select.options.length - 1, select.selectedIndex + direction));
  if (next === select.selectedIndex) return false;
  setNativeValue(select, select.options[next].value);
  return true;
}

function applyVolumeEnvelopePoint(percent: number) {
  const root = shell();
  if (!root) return false;
  const inspector = Array.from(root.querySelectorAll<HTMLElement>("aside")).at(-1);
  if (!inspector) return false;

  const volumeLabel = Array.from(inspector.querySelectorAll<HTMLLabelElement>("label")).find((label) =>
    (label.textContent || "").trim().startsWith("Volumen ·"),
  );
  const slider = volumeLabel?.querySelector<HTMLInputElement>('input[type="range"]');
  if (!slider) return false;
  setNativeValue(slider, String(Math.max(0, Math.min(100, percent)) / 100));

  window.setTimeout(() => {
    const currentRoot = shell();
    if (!currentRoot) return;
    const currentInspector = Array.from(currentRoot.querySelectorAll<HTMLElement>("aside")).at(-1);
    const keyframeButton = Array.from(currentInspector?.querySelectorAll<HTMLButtonElement>("button") || []).find((button) =>
      (button.textContent || "").includes("+ actual"),
    );
    keyframeButton?.click();
  }, 80);
  return true;
}

function toggleEditorPlayback() {
  const root = shell();
  if (!root) return false;
  const monitor = Array.from(root.querySelectorAll<HTMLElement>("section")).find((section) => section.textContent?.includes("Monitor"));
  const button = monitor?.querySelector<HTMLButtonElement>("button.bg-cyan-600");
  if (!button) return false;
  button.click();
  return true;
}

export default function MultimediaAudioProPanel() {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("ambiente aula");
  const [results, setResults] = useState<FreesoundResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("Freesound + Biblioteca de audio de YouTube · herramientas de mezcla tipo Audacity.");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [volumePoint, setVolumePoint] = useState(100);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      previewRef.current?.pause();
      previewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const root = shell();
    if (!root) return;

    let drag: { clip: HTMLElement; startY: number; pointerId: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("button")) return;
      const clip = target.closest<HTMLElement>('[class*="cursor-grab"]');
      if (!clip) return;
      const timeline = clip.closest("section");
      if (!timeline?.textContent?.includes("Línea de tiempo")) return;
      drag = { clip, startY: event.clientY, pointerId: event.pointerId };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dy) < 4) return;
      drag.clip.style.transform = `translateY(${dy}px)`;
      drag.clip.style.zIndex = "90";
      drag.clip.style.overflow = "visible";
    };

    const finishDrag = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const current = drag;
      drag = null;
      current.clip.style.transform = "";
      current.clip.style.zIndex = "";
      current.clip.style.overflow = "";

      const timeline = current.clip.closest("section");
      if (!timeline) return;
      const headers = Array.from(timeline.querySelectorAll<HTMLElement>("div.sticky.left-0.z-30")).filter((header) => {
        const rect = header.getBoundingClientRect();
        return rect.height >= 45 && (header.textContent || "").trim().length > 0;
      });
      const targetHeader = headers.find((header) => {
        const rect = header.getBoundingClientRect();
        return event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
      const targetName = targetHeader?.textContent?.trim();
      if (!targetName) return;

      window.setTimeout(() => {
        const currentRoot = shell();
        if (!currentRoot) return;
        const select = findInspectorTrackSelect(currentRoot);
        if (!select) return;
        const option = Array.from(select.options).find((item) => item.text.trim() === targetName);
        if (!option || option.value === select.value) return;
        setNativeValue(select, option.value);
        setMessage(`Clip movido a ${targetName}.`);
      }, 0);
    };

    root.addEventListener("pointerdown", onPointerDown, true);
    root.addEventListener("pointermove", onPointerMove, true);
    root.addEventListener("pointerup", finishDrag, true);
    root.addEventListener("pointercancel", finishDrag, true);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown, true);
      root.removeEventListener("pointermove", onPointerMove, true);
      root.removeEventListener("pointerup", finishDrag, true);
      root.removeEventListener("pointercancel", finishDrag, true);
    };
  }, []);

  async function searchFreesound() {
    if (!query.trim()) return;
    setSearching(true);
    setMessage("Buscando efectos y sonidos en Freesound…");
    try {
      const response = await fetch(`/api/media/audio/freesound?query=${encodeURIComponent(query.trim())}&limit=18`);
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || "No se pudo buscar en Freesound.");
      setResults(data.sounds || []);
      setMessage(`${(data.sounds || []).length} sonidos encontrados. Revisa siempre la licencia indicada por el autor.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo buscar en Freesound.");
    } finally {
      setSearching(false);
    }
  }

  function togglePreview(sound: FreesoundResult) {
    if (previewId === sound.id) {
      previewRef.current?.pause();
      previewRef.current = null;
      setPreviewId(null);
      return;
    }
    previewRef.current?.pause();
    const url = `/api/media/audio/freesound?preview=${encodeURIComponent(sound.previewUrl)}&name=${encodeURIComponent(`${sound.name}.mp3`)}`;
    const audio = new Audio(url);
    previewRef.current = audio;
    setPreviewId(sound.id);
    audio.addEventListener("ended", () => setPreviewId(null), { once: true });
    void audio.play().catch(() => {
      setPreviewId(null);
      setMessage("El navegador bloqueó la preescucha. Pulsa Play nuevamente.");
    });
  }

  async function importFreesound(sound: FreesoundResult) {
    setMessage(`Importando ${sound.name}…`);
    try {
      const url = `/api/media/audio/freesound?preview=${encodeURIComponent(sound.previewUrl)}&name=${encodeURIComponent(`${sound.name}.mp3`)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("No se pudo descargar la preescucha de Freesound.");
      const blob = await response.blob();
      const safe = sound.name.replace(/[^a-z0-9áéíóúüñ _.-]+/gi, "-").slice(0, 80) || `freesound-${sound.id}`;
      const file = new File([blob], `${safe}.mp3`, { type: blob.type || "audio/mpeg" });
      await putFileInEditor(file, true);
      setMessage(`${sound.name} se agregó a EDUAI. Licencia: ${sound.license || "ver ficha de Freesound"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo importar el sonido.");
    }
  }

  async function importDownloadedAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await putFileInEditor(file, true);
      setMessage(`${file.name} importado y agregado a la línea de tiempo.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo importar el archivo.");
    }
  }

  function moveTrack(direction: -1 | 1) {
    setMessage(moveSelectedClipTrack(direction)
      ? "Clip trasladado a otra pista de audio."
      : "Selecciona primero un clip de audio/música y asegúrate de tener más de una pista.");
  }

  function addEnvelopePoint() {
    setMessage(applyVolumeEnvelopePoint(volumePoint)
      ? `Punto de volumen ${volumePoint}% agregado en el cabezal. Usa varios puntos para crear sectores y transiciones.`
      : "Selecciona un clip de audio o música antes de crear un punto de volumen.");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[80] flex items-center gap-2 rounded-2xl border border-violet-300/25 bg-[#0b1020]/95 px-4 py-3 text-xs font-semibold text-violet-100 shadow-2xl backdrop-blur-xl hover:bg-[#121a31]"
      >
        <Waves size={16} /> Audio Pro
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[80] flex max-h-[78dvh] w-[min(430px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-[#080d1d]/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200"><Waves size={16} /></div>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-100">Audio Pro · Biblioteca y mezcla</p><p className="truncate text-[9px] text-slate-500">Freesound · YouTube Audio Library · controles tipo Audacity</p></div>
        <button onClick={() => setOpen(false)} title="Contraer" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10"><ChevronDown size={15} /></button>
        <button onClick={() => setOpen(false)} title="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10"><X size={14} /></button>
      </div>

      <div className="overflow-y-auto p-3">
        <div className="mb-3 grid grid-cols-3 gap-2">
          <button onClick={() => toggleEditorPlayback()} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-2 py-2 text-[10px] font-semibold text-cyan-100"><Play size={12} className="mr-1 inline" />Play/Pausa</button>
          <button onClick={() => moveTrack(-1)} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[10px]"><ChevronLeft size={12} className="mr-1 inline" />Pista</button>
          <button onClick={() => moveTrack(1)} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[10px]">Pista<ChevronRight size={12} className="ml-1 inline" /></button>
        </div>

        <div className="mb-3 rounded-xl border border-violet-400/15 bg-violet-500/5 p-2.5">
          <div className="mb-2 flex items-center gap-2"><SlidersHorizontal size={13} className="text-violet-200" /><p className="text-[10px] font-semibold text-violet-100">Envolvente de volumen por sectores</p></div>
          <div className="flex items-center gap-2"><input type="range" min={0} max={100} step={1} value={volumePoint} onChange={(event) => setVolumePoint(Number(event.target.value))} className="min-w-0 flex-1 accent-violet-500" /><span className="w-9 text-right text-[9px] text-slate-300">{volumePoint}%</span><button onClick={addEnvelopePoint} className="rounded-lg bg-violet-500/20 px-2 py-1.5 text-[9px] font-semibold text-violet-100"><Plus size={11} className="mr-1 inline" />Punto</button></div>
          <p className="mt-1.5 text-[8px] leading-4 text-slate-500">Coloca el cabezal en el sector, define la intensidad y añade un punto. Repite para crear subidas, bajadas y ducking.</p>
        </div>

        <div className="mb-3 rounded-xl border border-red-400/15 bg-red-500/5 p-2.5">
          <div className="flex items-center gap-2"><Music2 size={13} className="text-red-200" /><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold text-red-100">Biblioteca de audio de YouTube</p><p className="text-[8px] leading-4 text-slate-500">Busca música/efectos en YouTube Studio, descarga el MP3 oficial y tráelo directo a EDUAI.</p></div></div>
          <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => window.open("https://youtube.com/audiolibrary", "_blank", "noopener,noreferrer")} className="rounded-lg bg-red-500/15 px-2 py-2 text-[9px] font-semibold text-red-100"><ExternalLink size={11} className="mr-1 inline" />Abrir biblioteca</button><label className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center text-[9px]"><Upload size={11} className="mr-1 inline" />Importar MP3<input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" className="hidden" onChange={importDownloadedAudio} /></label></div>
        </div>

        <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-2.5">
          <div className="mb-2 flex items-center gap-2"><Volume2 size={13} className="text-emerald-200" /><p className="text-[10px] font-semibold text-emerald-100">Freesound</p></div>
          <div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchFreesound(); }} placeholder="lluvia, aplausos, ambiente…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-[10px] outline-none" /><button onClick={() => void searchFreesound()} disabled={searching} className="rounded-lg bg-emerald-600 px-2.5 text-white disabled:opacity-50"><Search size={13} /></button></div>
          <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {results.map((sound) => <div key={sound.id} className="rounded-lg border border-white/8 bg-black/20 p-2">
              <div className="flex items-center gap-2"><button onClick={() => togglePreview(sound)} title="Preescuchar" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-100">{previewId === sound.id ? <Pause size={12} /> : <Play size={12} />}</button><div className="min-w-0 flex-1"><p className="truncate text-[9px] font-medium text-slate-200">{sound.name}</p><p className="truncate text-[8px] text-slate-500">{sound.creator} · {fmt(sound.duration)} · {sound.license || "licencia en ficha"}</p></div><button onClick={() => void importFreesound(sound)} title="Agregar a la timeline" className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-100"><Plus size={12} /></button><button onClick={() => window.open(sound.externalUrl, "_blank", "noopener,noreferrer")} title="Ver fuente/licencia" className="rounded-lg bg-white/5 p-1.5 text-slate-300"><ExternalLink size={11} /></button></div>
              {sound.tags?.length ? <p className="mt-1 truncate text-[7px] text-slate-600">{sound.tags.slice(0, 6).join(" · ")}</p> : null}
            </div>)}
            {!results.length && <p className="py-4 text-center text-[9px] text-slate-500">Busca sonidos para preescuchar y agregarlos al proyecto.</p>}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2 text-[8px] leading-4 text-slate-400">{message}<br /><span className="text-slate-500">Tip: mantén presionado un clip de audio y arrástralo verticalmente; al soltar sobre otra pista compatible, EDUAI lo cambia de pista.</span></div>
      </div>
    </div>
  );
}
