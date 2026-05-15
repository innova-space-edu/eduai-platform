"use client";

import Link from "next/link";
import EduAIMusicPlayer from "@/components/music/EduAIMusicPlayer";

export default function MusicPage() {
  return (
    <main className="min-h-screen bg-[#050b08] p-4 text-white">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300/80">
              EduAI Focus OS
            </p>
            <h1 className="text-3xl font-black tracking-tight">
              ♫ EduAI Music
            </h1>
            <p className="mt-1 text-sm text-emerald-100/60">
              Reproductor tipo Spotify/OpenSpot para estudiar, crear playlists y
              mantener música mientras navegas.
            </p>
          </div>
          <Link
            href="/agentes"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-white/10"
          >
            ← Agentes
          </Link>
        </div>
        <EduAIMusicPlayer mode="page" showMiniWhenStopped />
      </div>
    </main>
  );
}
