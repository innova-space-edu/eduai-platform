"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Library, Loader2, Music2, Search, X } from "lucide-react";
import { useMediaStudioStore } from "@/lib/media-studio/store";
import type { MediaAsset } from "@/lib/media-studio/types";

export default function MediaLibraryDrawer() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const { addAsset, addClipFromAsset } = useMediaStudioStore();

  async function load(q = query) {
    setLoading(true);
    try {
      const res = await fetch(`/api/media-studio/library?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open && !items.length) void load(""); }, [open]);

  return (
    <>
      {open && (
        <div className="fixed inset-y-16 left-4 z-[65] flex w-[340px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101621]/95 text-slate-100 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/10 p-3"><Library className="h-4 w-4 text-emerald-300" /><div className="flex-1"><p className="text-xs font-bold">Biblioteca EDUAI</p><p className="text-[9px] text-slate-500">Galería + música + assets reutilizables</p></div><button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div>
          <div className="flex gap-2 p-3"><div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-600" /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Buscar en tu biblioteca..." className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-2 text-xs outline-none focus:border-emerald-400/40" /></div><button onClick={() => load()} className="rounded-lg bg-white/10 px-2.5">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {!loading && !items.length && <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-[10px] text-slate-500">No hay recursos para mostrar todavía.</div>}
            <div className="grid grid-cols-2 gap-2">{items.map((asset) => <button key={asset.id} onClick={() => { addAsset(asset); addClipFromAsset(asset); }} className="overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left hover:border-emerald-400/30"><div className="flex aspect-video items-center justify-center overflow-hidden bg-black/30">{asset.thumbnailUrl ? <img src={asset.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : asset.type === "image" ? <ImageIcon className="h-6 w-6 text-pink-300" /> : <Music2 className="h-6 w-6 text-emerald-300" />}</div><div className="p-2"><p className="truncate text-[9px] font-semibold">{asset.name}</p><p className="mt-0.5 truncate text-[8px] text-slate-500">{asset.provider || "EDUAI"}</p></div></button>)}</div>
          </div>
        </div>
      )}
      <button onClick={() => setOpen((value) => !value)} className="fixed bottom-4 left-4 z-[70] flex items-center gap-2 rounded-full border border-emerald-400/20 bg-[#111b18] px-4 py-2.5 text-xs font-bold text-emerald-200 shadow-xl hover:bg-emerald-500/10"><Library className="h-4 w-4" />Biblioteca EDUAI</button>
    </>
  );
}
