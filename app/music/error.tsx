"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function MusicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[EDUAI Music] route error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070a] p-6 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-cyan-300/20 bg-[#0b1018] p-7 text-center shadow-2xl shadow-black/40">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/10">
          <AlertTriangle className="h-6 w-6 text-amber-200" />
        </div>
        <h1 className="mt-4 text-xl font-black">La fuente de audio no pudo cargarse</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
          EDUAI Music sigue disponible. Reintenta la vista o vuelve a Agentes; una canción, radio o reproductor externo no debe sacar al usuario de la aplicación.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300"
          >
            <RotateCcw className="h-4 w-4" />
            Reintentar
          </button>
          <Link
            href="/agentes"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-200 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Agentes
          </Link>
        </div>
      </section>
    </main>
  );
}
