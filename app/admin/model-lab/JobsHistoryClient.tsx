"use client";

import { useEffect, useState } from "react";

type Job = {
  id: string;
  job_type: string;
  provider: string;
  model_id: string;
  prompt: string | null;
  status: string;
  output_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
};

export default function JobsHistoryClient() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadJobs();
  }, []);

  async function loadJobs() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/model-lab/jobs", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No fue posible cargar el historial");
      setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Historial privado</p>
          <h2 className="mt-2 text-2xl font-black">Últimas ejecuciones</h2>
        </div>
        <button onClick={() => void loadJobs()} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10">
          Recargar
        </button>
      </div>

      {loading && <p className="mt-4 text-sm text-slate-400">Cargando historial...</p>}
      {error && <p className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      {!loading && !error && jobs.length === 0 && <p className="mt-4 text-sm text-slate-400">Todavía no hay ejecuciones registradas.</p>}

      {jobs.length > 0 && (
        <div className="mt-5 space-y-3">
          {jobs.map((job) => (
            <article key={job.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">{job.job_type} · {job.provider}</p>
                  <h3 className="mt-1 text-sm font-black text-white">{job.model_id}</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-200">{job.status}</span>
              </div>
              {job.prompt && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-300">{job.prompt}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{new Date(job.created_at).toLocaleString()}</span>
                {job.output_path && <a href={job.output_path} target="_blank" rel="noreferrer" className="font-bold text-blue-300 hover:text-blue-200">Abrir resultado ↗</a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
