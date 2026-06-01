"use client";

import { useEffect, useState } from "react";

type ProviderState = {
  configured: boolean;
};

type ProvidersPayload = {
  providers?: {
    fal?: ProviderState;
    openrouter?: ProviderState;
  };
};

export default function ProvidersStatusClient() {
  const [payload, setPayload] = useState<ProvidersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/model-lab/providers/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible consultar proveedores");
      setPayload(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const providers = [
    { key: "fal", label: "fal", description: "Generación de imágenes y video" },
    { key: "openrouter", label: "OpenRouter", description: "Catálogo y futura ejecución de chat" },
  ] as const;

  return (
    <section id="proveedores" className="scroll-mt-6 rounded-[28px] border border-emerald-400/25 bg-emerald-500/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Estado de conexiones</p>
          <h2 className="mt-2 text-2xl font-black">Proveedores online</h2>
        </div>
        <button onClick={() => void loadStatus()} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10">
          Actualizar
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {loading && <p className="mt-4 text-sm text-emerald-100/70">Comprobando proveedores...</p>}
        {error && <p className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      </div>

      {!loading && !error && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {providers.map((provider) => {
            const configured = payload?.providers?.[provider.key]?.configured === true;
            return (
              <article key={provider.key} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-white">{provider.label}</h3>
                    <p className="mt-1 text-xs text-slate-400">{provider.description}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${configured ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}>
                    {configured ? "Configurado" : "Pendiente"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
