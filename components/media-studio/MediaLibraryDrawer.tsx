"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudDownload, Image as ImageIcon, Library, Loader2, Music2, Play, Search, Video, Volume2, X } from "lucide-react";
import { useMediaStudioStore } from "@/lib/media-studio/store";
import type { MediaAsset } from "@/lib/media-studio/types";

type Mode = "mine" | "web";
type Provider = "all" | "pexels" | "pixabay" | "freesound" | "jamendo";

const providers: { id: Provider; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "pexels", label: "Pexels" },
  { id: "pixabay", label: "Pixabay" },
  { id: "freesound", label: "Freesound" },
  { id: "jamendo", label: "Jamendo" },
];

function Preview({ asset }: { asset: MediaAsset }) {
  if (asset.type === "video") return <video src={asset.url} poster={asset.thumbnailUrl} controls preload="metadata" className="h-full w-full object-cover" />;
  if (["audio", "music", "sfx"].includes(asset.type)) return <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2"><Music2 className="h-7 w-7 text-emerald-300" /><audio src={asset.url} controls preload="none" className="h-8 w-full" /></div>;
  if (asset.thumbnailUrl || asset.url) return <img src={asset.thumbnailUrl || asset.url} alt="" className="h-full w-full object-cover" />;
  return <ImageIcon className="h-6 w-6 text-pink-300" />;
}

export default function MediaLibraryDrawer() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("mine");
  const [provider, setProvider] = useState<Provider>("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const { project, addAsset, addClipFromAsset } = useMediaStudioStore();

  const subtitle = useMemo(() => mode === "mine" ? "Galería + música + archivos guardados" : "Pexels · Pixabay · Freesound · Jamendo", [mode]);

  async function load(q = query, targetMode = mode, targetProvider = provider) {
    setLoading(true); setMessage("");
    try {
      const endpoint = targetMode === "mine"
        ? `/api/media-studio/library?q=${encodeURIComponent(q)}`
        : `/api/media-studio/search?q=${encodeURIComponent(q)}&provider=${targetProvider}`;
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      if (targetMode === "web" && data.configured) {
        const missing = Object.entries(data.configured).filter(([, value]) => !value).map(([key]) => key);
        if (missing.length === 4) setMessage("Configura al menos una API de Pexels, Pixabay, Freesound o Jamendo para buscar contenido externo.");
      }
    } catch {
      setItems([]);
      setMessage("No se pudo cargar la biblioteca.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) void load("", mode, provider); }, [open, mode]);

  async function saveAndEdit(asset: MediaAsset) {
    setSavingId(asset.id); setMessage("");
    try {
      const res = await fetch("/api/media-studio/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, project }),
      });
      const data = await res.json();
      if (!res.ok || !data.asset) throw new Error(data.error || "No se pudo guardar el recurso.");
      addAsset(data.asset);
      addClipFromAsset(data.asset);
      setMessage("Guardado en la nube privada y añadido al timeline.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el recurso.");
    } finally {
      setSavingId(null);
    }
  }

  function addExisting(asset: MediaAsset) {
    addAsset(asset);
    addClipFromAsset(asset);
    setMessage("Añadido al timeline.");
  }

  return (
    <>
      {open && (
        <div className="fixed inset-y-16 left-4 z-[65] flex w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101621]/95 text-slate-100 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/10 p-3"><Library className="h-4 w-4 text-emerald-300" /><div className="flex-1"><p className="text-xs font-bold">Biblioteca Multimedia EDUAI</p><p className="text-[9px] text-slate-500">{subtitle}</p></div><button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div>

          <div className="grid grid-cols-2 border-b border-white/10 p-2">
            <button onClick={() => setMode("mine")} className={`rounded-lg py-2 text-[10px] font-bold ${mode === "mine" ? "bg-emerald-400/10 text-emerald-200" : "text-slate-500"}`}>Mis archivos EDUAI</button>
            <button onClick={() => setMode("web")} className={`rounded-lg py-2 text-[10px] font-bold ${mode === "web" ? "bg-cyan-400/10 text-cyan-200" : "text-slate-500"}`}>Buscar en la web</button>
          </div>

          <div className="p-3">
            <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-600" /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder={mode === "mine" ? "Buscar en EDUAI..." : "Buscar videos, música, sonidos..."} className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-2 text-xs outline-none focus:border-emerald-400/40" /></div><button onClick={() => load()} className="rounded-lg bg-white/10 px-2.5">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></div>
            {mode === "web" && <div className="mt-2 flex gap-1 overflow-x-auto pb-1">{providers.map((item) => <button key={item.id} onClick={() => { setProvider(item.id); void load(query, "web", item.id); }} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-bold ${provider === item.id ? "bg-cyan-400/15 text-cyan-200" : "bg-white/5 text-slate-500"}`}>{item.label}</button>)}</div>}
            {message && <p className="mt-2 rounded-lg bg-black/20 p-2 text-[9px] leading-4 text-slate-400">{message}</p>}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {!loading && !items.length && <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-[10px] text-slate-500">{mode === "web" && !query.trim() ? "Escribe algo para buscar videos, canciones, sonidos o imágenes." : "No hay recursos para mostrar."}</div>}
            <div className="space-y-2">{items.map((asset) => (
              <div key={asset.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <div className="grid grid-cols-[130px_1fr] gap-2 p-2">
                  <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black/30"><Preview asset={asset} /></div>
                  <div className="min-w-0"><div className="flex items-center gap-1.5">{asset.type === "video" ? <Video className="h-3 w-3 text-cyan-300" /> : ["audio","music","sfx"].includes(asset.type) ? <Volume2 className="h-3 w-3 text-emerald-300" /> : <ImageIcon className="h-3 w-3 text-pink-300" />}<p className="truncate text-[10px] font-semibold">{asset.name}</p></div><p className="mt-1 truncate text-[8px] text-slate-500">{asset.provider || "EDUAI"}</p>{asset.license && <p className="mt-1 line-clamp-2 text-[8px] leading-3 text-slate-600">{asset.license}{asset.attribution ? ` · ${asset.attribution}` : ""}</p>}
                    <button disabled={savingId === asset.id} onClick={() => mode === "mine" ? addExisting(asset) : saveAndEdit(asset)} className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[9px] font-bold ${mode === "mine" ? "bg-emerald-400/10 text-emerald-200" : "bg-cyan-400/10 text-cyan-200"}`}>{savingId === asset.id ? <Loader2 className="h-3 w-3 animate-spin" /> : mode === "mine" ? <Play className="h-3 w-3" /> : <CloudDownload className="h-3 w-3" />}{mode === "mine" ? "Añadir al timeline" : "Guardar + editar"}</button>
                  </div>
                </div>
              </div>
            ))}</div>
          </div>
        </div>
      )}
      <button onClick={() => setOpen((value) => !value)} className="fixed bottom-4 left-4 z-[70] flex items-center gap-2 rounded-full border border-emerald-400/20 bg-[#111b18] px-4 py-2.5 text-xs font-bold text-emerald-200 shadow-xl hover:bg-emerald-500/10"><Library className="h-4 w-4" />Biblioteca EDUAI</button>
    </>
  );
}
