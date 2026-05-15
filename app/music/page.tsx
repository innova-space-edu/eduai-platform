"use client";

import Link from "next/link";
import EduAIMusicPlayer from "@/components/music/EduAIMusicPlayer";

export default function MusicPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] p-4 text-slate-950">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-blue-600">EduAI Focus OS</p>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">♫ EduAI Music Studio</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Biblioteca tipo Spotify clara: listado lateral, reproductor central, playlists, búsqueda online con previews y música persistente mientras navegas.
            </p>
          </div>
          <Link href="/agentes" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">← Agentes</Link>
        </div>
        <EduAIMusicPlayer mode="page" showMiniWhenStopped />
      </div>
    </main>
  );
}
