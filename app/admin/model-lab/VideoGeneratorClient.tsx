"use client";

import { FormEvent, useRef, useState } from "react";

export default function VideoGeneratorClient() {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [status, setStatus] = useState("idle");
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      if (!response.ok) throw new Error(payload.error || "No fue posible iniciar el video");
      setStatus("IN_QUEUE");
      await checkStatus(payload.requestId);
    } catch (cause) {
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : "Error desconocido");
    }
  }

  async function checkStatus(requestId: string) {
    const response = await fetch(`/api/admin/model-lab/video-status?requestId=${encodeURIComponent(requestId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible consultar el estado");

    const nextStatus = payload.status?.status || "IN_PROGRESS";
    setStatus(nextStatus);
    if (nextStatus === "COMPLETED") return loadResult(requestId);
    timer.current = setTimeout(() => void checkStatus(requestId), 4000);
  }

  async function loadResult(requestId: string) {
    const response = await fetch(`/api/admin/model-lab/video-status?requestId=${encodeURIComponent(requestId)}&result=1`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible recuperar el video");
    setVideoUrl(payload.data?.video?.url || "");
    setStatus("completed");
  }

  return (
    <section className="rounded-[28px] border border-cyan-400/25 bg-cyan-500/10 p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Video online experimental</p>
      <h2 className="mt-2 text-2xl font-black">Generador de video con cola asíncrona</h2>
      <form onSubmit={generate} className="mt-5 grid gap-4">
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe el video..." rows={4} minLength={3} maxLength={3000} required className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm"><option>16:9</option><option>9:16</option></select>
          <select value={resolution} onChange={(event) => setResolution(event.target.value)} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm"><option>480p</option><option>580p</option><option>720p</option></select>
          <button type="submit" disabled={status === "submitting" || status === "IN_QUEUE" || status === "IN_PROGRESS"} className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">Crear video</button>
        </div>
      </form>
      {status !== "idle" && <p className="mt-4 text-sm font-bold text-cyan-100">Estado: {status}</p>}
      {error && <p className="mt-4 text-sm text-red-100">{error}</p>}
      {videoUrl && <video src={videoUrl} controls className="mt-5 w-full rounded-2xl" />}
    </section>
  );
}
