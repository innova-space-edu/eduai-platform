"use client";

import { useMemo, useState } from "react";
import { AudioLines, ChevronDown, ChevronUp, WandSparkles } from "lucide-react";
import { useMediaStudioStore } from "@/lib/media-studio/store";
import type { ClipKeyframe } from "@/lib/media-studio/types";

function uniqueKeyframes(items: ClipKeyframe[]) {
  const map = new Map<string, ClipKeyframe>();
  for (const item of items.sort((a, b) => a.time - b.time)) {
    map.set(`${Math.round(item.time * 1000)}-${Object.keys(item.values).sort().join("-")}`, item);
  }
  return [...map.values()].sort((a, b) => a.time - b.time);
}

export default function MediaAudioAutomation() {
  const [open, setOpen] = useState(false);
  const [duckLevel, setDuckLevel] = useState(0.22);
  const [message, setMessage] = useState("");
  const { project, updateClip } = useMediaStudioStore();

  const stats = useMemo(() => {
    const clips = project.tracks.flatMap((track) => track.clips);
    return {
      voices: clips.filter((clip) => clip.type === "audio"),
      music: clips.filter((clip) => clip.type === "music"),
      sfx: clips.filter((clip) => clip.type === "sfx"),
    };
  }, [project]);

  function applyDucking() {
    if (!stats.music.length) {
      setMessage("No hay clips de tipo música en el timeline.");
      return;
    }
    if (!stats.voices.length) {
      setMessage("No hay clips de voz/audio para detectar cuándo bajar la música.");
      return;
    }

    let changed = 0;
    for (const music of stats.music) {
      const baseVolume = music.volume;
      const generated: ClipKeyframe[] = [];
      for (const voice of stats.voices) {
        const overlapStartAbs = Math.max(music.start, voice.start);
        const overlapEndAbs = Math.min(music.start + music.duration, voice.start + voice.duration);
        if (overlapEndAbs <= overlapStartAbs) continue;

        const localStart = overlapStartAbs - music.start;
        const localEnd = overlapEndAbs - music.start;
        const fadeIn = Math.max(0, localStart - 0.25);
        const fadeOut = Math.min(music.duration, localEnd + 0.35);
        generated.push(
          { id: `duck-${crypto.randomUUID()}`, time: fadeIn, easing: "ease-out", values: { volume: baseVolume } },
          { id: `duck-${crypto.randomUUID()}`, time: localStart, easing: "ease-out", values: { volume: Math.min(baseVolume, duckLevel) } },
          { id: `duck-${crypto.randomUUID()}`, time: localEnd, easing: "ease-in", values: { volume: Math.min(baseVolume, duckLevel) } },
          { id: `duck-${crypto.randomUUID()}`, time: fadeOut, easing: "ease-in", values: { volume: baseVolume } },
        );
      }
      if (!generated.length) continue;
      const manual = (music.keyframes || []).filter((item) => !item.id.startsWith("duck-"));
      updateClip(music.id, { keyframes: uniqueKeyframes([...manual, ...generated]) });
      changed += 1;
    }

    setMessage(changed ? `Auto-ducking aplicado a ${changed} pista${changed === 1 ? "" : "s"} de música.` : "La música no coincide en el tiempo con las pistas de voz.");
  }

  function clearDucking() {
    let changed = 0;
    for (const music of stats.music) {
      const next = (music.keyframes || []).filter((item) => !item.id.startsWith("duck-"));
      if (next.length === (music.keyframes || []).length) continue;
      updateClip(music.id, { keyframes: next });
      changed += 1;
    }
    setMessage(changed ? "Automatización de ducking eliminada." : "No había ducking automático aplicado.");
  }

  return (
    <div className="fixed bottom-4 left-[190px] z-[67] text-slate-100">
      {open && (
        <div className="mb-2 w-80 rounded-2xl border border-white/10 bg-[#101621]/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2"><WandSparkles className="h-4 w-4 text-emerald-300" /><div><p className="text-xs font-bold">Mezcla automática</p><p className="text-[9px] text-slate-500">Voz {stats.voices.length} · Música {stats.music.length} · SFX {stats.sfx.length}</p></div></div>
          <label className="text-[9px] text-slate-500">Volumen de música durante voz · {Math.round(duckLevel * 100)}%</label>
          <input type="range" min="0.05" max="0.6" step="0.01" value={duckLevel} onChange={(event) => setDuckLevel(Number(event.target.value))} className="mt-1 w-full accent-emerald-400" />
          <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={applyDucking} className="rounded-xl bg-emerald-400 px-3 py-2 text-[10px] font-black text-slate-950">Auto-ducking</button><button onClick={clearDucking} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-slate-300">Quitar</button></div>
          <p className="mt-2 text-[9px] leading-4 text-slate-600">La automatización crea keyframes de volumen con entrada de 250 ms y recuperación de 350 ms. No modifica el archivo original.</p>
          {message && <p className="mt-2 rounded-lg bg-black/20 p-2 text-[9px] leading-4 text-slate-300">{message}</p>}
        </div>
      )}
      <button onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-full border border-white/10 bg-[#101621]/95 px-4 py-2.5 text-xs font-black shadow-xl backdrop-blur-xl hover:bg-[#172131]"><AudioLines className="h-4 w-4 text-emerald-300" />Mezcla IA {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}</button>
    </div>
  );
}
