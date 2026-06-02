"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const statusLabels: Record<string, string> = {
  idle: "Listo para crear",
  submitting: "Enviando solicitud...",
  IN_QUEUE: "En cola de procesamiento",
  IN_PROGRESS: "Generando video...",
  COMPLETED: "Recuperando resultado...",
  completed: "Video listo",
  failed: "No fue posible completar el video",
};

export default function VideoGeneratorClient() {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [providerReady, setProviderReady] = useState<boolean | null>(null);
  const [status, setStatus] = useState("idle");
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadProviderStatus();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function loadProviderStatus() {
    try {
      const response = await fetch("/api/admin/model-lab/providers/status", { cache: "no-store" });
      const payload = await response.json();
      setProviderReady(response.ok && payload.providers?.fal?.configured === true);
    } catch {
      setProviderReady(false);
    }
  }

  function fail(cause: unknown) {
    if (timer.current) clearTimeout(timer.current);
    setStatus("failed");
    setError(cause instanceof Error ? cause.message : "Error desconocido");
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (timer.current) clearTimeout(timer.current);
    setError("");
    setVideoUrl("");
    setStatus("submitting");

    try {
      const response = await fetch("/api/admin/model-lab/video-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, aspectRatio, resolution }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.error || "No fue posible iniciar el video");
      setStatus("IN_QUEUE");
      await checkStatus(payload.requestId);
    } catch (cause) {
      fail(cause);
    }
  }

  async function checkStatus(requestId: string) {
    try {
      const response = await fetch(`/api/admin/model-lab/video-status?requestId=${encodeURIComponent(requestId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.error || "No fue posible consultar el estado");

      const nextStatus = payload.status?.status || "IN_PROGRESS";
      setStatus(nextStatus);
      if (nextStatus === "COMPLETED") return await loadResult(requestId);
      timer.current = setTimeout(() => void checkStatus(requestId), 4000);
    } catch (cause) {
      fail(cause);
    }
  }

  async function loadResult(requestId: string) {
    const response = await fetch(`/api/admin/model-lab/video-status?requestId=${encodeURIComponent(requestId)}&result=1`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || payload.error || "No fue posible recuperar el video");
    const url = payload.data?.video?.url || "";
    if (!url) throw new Error("El proveedor no devolvió un MP4 utilizable");
    setVideoUrl(url);
    setStatus("completed");
  }

  const running = status === "submitting" || status === "IN_QUEUE" || status === "IN_PROGRESS" || status === "COMPLETED";

  return (
    <section id="videos" className="scroll-mt-6 rounded-[28px] border border-cyan-400/25 bg-cyan-500/10 p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Videos</p>
      <h2 className="mt-2 text-2xl font-black">Crear un video</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-cyan-100/80">
        Describe la escena, define el formato y sigue el progreso mientras fal procesa el MP4 mediante una cola asíncrona.
      </p>

      {providerReady === false && <p className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm text-amber-100">El proveedor de video todavía no está configurado en Vercel Preview.</p>}

      <form onSubmit={generate} className="mt-5 grid gap-4">
        <div>
          <label htmlFor="video-prompt" className="mb-2 block text-sm font-bold text-cyan-100">Descripción del video</label>
          <textarea id="video-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ejemplo: cámara recorriendo una ciudad futurista al atardecer..." rows={4} minLength={3} maxLength={3000} required className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70" />
        </div>

        <div className="grid gap-3 sm:grid-cols-[180px_180px_1fr] sm:items-end">
          <div>
            <label htmlFor="video-ratio" className="mb-2 block text-sm font-bold text-cyan-100">Formato</label>
            <select id="video-ratio" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"><option>16:9</option><option>9:16</option></select>
          </div>
          <div>
            <label htmlFor="video-resolution" className="mb-2 block text-sm font-bold text-cyan-100">Resolución</label>
            <select id="video-resolution" value={resolution} onChange={(event) => setResolution(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"><option>480p</option><option>580p</option><option>720p</option></select>
          </div>
          <button type="submit" disabled={running || providerReady !== true || prompt.trim().length < 3} className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">{running ? "Procesando video..." : providerReady === null ? "Comprobando proveedor..." : "Crear video"}</button>
        </div>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {status !== "idle" && <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-sm font-bold text-cyan-100">{statusLabels[status] || status}</p>}
        {error && <p className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      </div>

      {videoUrl && <video src={videoUrl} controls className="mt-5 w-full rounded-2xl border border-white/10 bg-black" />}
    </section>
  );
}
