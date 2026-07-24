"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Model = { id: string; name: string };
type Message = { role: "user" | "assistant"; content: string };

export default function ChatPlaygroundClient() {
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [temperature, setTemperature] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [providerReady, setProviderReady] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadProvider();
    void loadModels();
  }, []);

  async function loadProvider() {
    try {
      const response = await fetch("/api/admin/model-lab/providers/status", { cache: "no-store" });
      const payload = await response.json();
      setProviderReady(response.ok && payload.providers?.openrouter?.configured === true);
    } catch {
      setProviderReady(false);
    }
  }

  async function loadModels() {
    try {
      const response = await fetch("/api/admin/model-lab/chat-models", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) return;
      const next = Array.isArray(payload.models) ? payload.models : [];
      setModels(next);
      if (!model && next[0]?.id) setModel(next[0].id);
    } catch {
      // El panel principal muestra el estado del proveedor.
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || !model) return;

    const nextMessages = [...messages, { role: "user" as const, content: prompt }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/model-lab/openrouter-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: nextMessages, temperature }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.error || "No fue posible completar el chat");
      setMessages((current) => [...current, { role: "assistant", content: payload.answer || "Sin respuesta" }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const canSend = useMemo(() => providerReady === true && Boolean(model) && input.trim().length > 0 && !loading, [providerReady, model, input, loading]);

  return (
    <section id="chat" className="scroll-mt-6 rounded-[28px] border border-fuchsia-400/25 bg-fuchsia-500/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-200">Chat experimental</p>
          <h2 className="mt-2 text-2xl font-black">Probar modelos OpenRouter</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fuchsia-100/80">Selecciona un modelo, escribe una consulta y compara respuestas dentro del laboratorio privado.</p>
        </div>
        <button onClick={() => setMessages([])} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10">Limpiar chat</button>
      </div>

      {providerReady === false && <p className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm text-amber-100">OpenRouter todavía no está configurado en Vercel.</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]">
        <div>
          <label htmlFor="chat-model" className="mb-2 block text-sm font-bold text-fuchsia-100">Modelo</label>
          <select id="chat-model" value={model} onChange={(event) => setModel(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm">
            <option value="">Selecciona un modelo</option>
            {models.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="chat-temperature" className="mb-2 block text-sm font-bold text-fuchsia-100">Temperatura: {temperature.toFixed(1)}</label>
          <input id="chat-temperature" type="range" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} className="w-full" />
        </div>
      </div>

      <div className="mt-5 min-h-56 space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        {messages.length === 0 && <p className="text-sm text-slate-400">Todavía no hay mensajes. Escribe una consulta para comenzar.</p>}
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "ml-auto bg-fuchsia-300 text-slate-950" : "bg-white/10 text-slate-100"}`}>
            <p className="mb-1 text-[11px] font-black uppercase tracking-wider opacity-70">{message.role === "user" ? "Administrador" : "Modelo"}</p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label htmlFor="chat-input" className="sr-only">Mensaje</label>
        <textarea id="chat-input" value={input} onChange={(event) => setInput(event.target.value)} rows={3} maxLength={6000} placeholder="Escribe una consulta para probar el modelo..." className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-fuchsia-300/70" />
        <button type="submit" disabled={!canSend} className="rounded-2xl bg-fuchsia-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Consultando..." : "Enviar"}</button>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {loading && <p className="mt-4 text-sm font-bold text-fuchsia-100">El modelo está generando una respuesta.</p>}
        {error && <p className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      </div>
    </section>
  );
}
