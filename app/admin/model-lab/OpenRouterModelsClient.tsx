"use client";

import { useEffect, useMemo, useState } from "react";

type Model = {
  id: string;
  name: string;
  context_length: number | null;
  pricing: Record<string, unknown> | null;
};

export default function OpenRouterModelsClient() {
  const [models, setModels] = useState<Model[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadModels();
  }, []);

  async function loadModels() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/model-lab/chat-models", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No fue posible cargar modelos");
      setModels(Array.isArray(payload.models) ? payload.models : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return models.slice(0, 30);
    return models.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(normalized)).slice(0, 30);
  }, [models, query]);

  return (
    <section className="rounded-[28px] border border-fuchsia-400/25 bg-fuchsia-500/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-200">Chat experimental online</p>
          <h2 className="mt-2 text-2xl font-black">Catálogo de modelos OpenRouter</h2>
        </div>
        <button onClick={() => void loadModels()} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10">Recargar</button>
      </div>

      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fuchsia-100/80">
        Este panel lista modelos disponibles mediante OpenRouter. La ejecución de chat se habilitará en una etapa separada.
      </p>

      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar modelo..." className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm" />

      {loading && <p className="mt-4 text-sm text-fuchsia-100/70">Cargando modelos...</p>}
      {error && <p className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm text-amber-100">{error}</p>}

      {!loading && !error && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {filtered.map((model) => (
            <article key={model.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">OpenRouter</p>
              <h3 className="mt-1 text-sm font-black text-white">{model.name}</h3>
              <p className="mt-2 break-all text-xs text-slate-400">{model.id}</p>
              {model.context_length && <p className="mt-2 text-xs text-fuchsia-100/70">Contexto: {model.context_length.toLocaleString()} tokens</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
