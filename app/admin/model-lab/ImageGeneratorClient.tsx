"use client";

import { FormEvent, useEffect, useState } from "react";

type GeneratedImage = {
  url?: string;
  width?: number;
  height?: number;
  content_type?: string;
};

const sizes = [
  { value: "landscape_4_3", label: "Horizontal 4:3" },
  { value: "landscape_16_9", label: "Horizontal 16:9" },
  { value: "square_hd", label: "Cuadrada HD" },
  { value: "portrait_4_3", label: "Vertical 3:4" },
  { value: "portrait_16_9", label: "Vertical 9:16" },
];

export default function ImageGeneratorClient() {
  const [prompt, setPrompt] = useState("");
  const [imageSize, setImageSize] = useState("landscape_4_3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [requestId, setRequestId] = useState("");
  const [providerReady, setProviderReady] = useState<boolean | null>(null);

  useEffect(() => {
    void loadProviderStatus();
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

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setImage(null);

    try {
      const response = await fetch("/api/admin/model-lab/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, imageSize }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.error || "No fue posible generar la imagen");

      const generated = Array.isArray(payload.data?.images) ? payload.data.images[0] : null;
      if (!generated?.url) throw new Error("El proveedor no devolvió una imagen utilizable");

      setImage(generated);
      setRequestId(payload.requestId || "");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="imagenes" className="scroll-mt-6 rounded-[28px] border border-violet-400/25 bg-violet-500/10 p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">Imágenes</p>
      <h2 className="mt-2 text-2xl font-black text-white">Crear una imagen</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-violet-100/80">
        Describe lo que necesitas, elige el formato y genera una imagen privada con FLUX Schnell.
      </p>

      {providerReady === false && (
        <p className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm text-amber-100">
          Fal todavía no está configurado en Vercel. Agrega la variable segura del proveedor para habilitar la generación.
        </p>
      )}

      <form onSubmit={generate} className="mt-5 grid gap-4">
        <div>
          <label htmlFor="image-prompt" className="mb-2 block text-sm font-bold text-violet-100">Descripción de la imagen</label>
          <textarea
            id="image-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ejemplo: afiche horizontal de ciencias con estilo moderno y fondo espacial..."
            rows={5}
            minLength={3}
            maxLength={3000}
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300/70"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:min-w-52">
            <label htmlFor="image-size" className="mb-2 block text-sm font-bold text-violet-100">Formato</label>
            <select id="image-size" value={imageSize} onChange={(event) => setImageSize(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none">
              {sizes.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading || prompt.trim().length < 3 || providerReady !== true} className="rounded-2xl bg-violet-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Generando imagen..." : providerReady === null ? "Comprobando proveedor..." : "Crear imagen"}
          </button>
        </div>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {loading && <p className="mt-4 text-sm font-bold text-violet-100">La imagen se está generando.</p>}
        {error && <p className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      </div>

      {image?.url && (
        <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/60 p-3">
          <img src={image.url} alt="Imagen generada en Model Lab" className="max-h-[720px] w-full rounded-2xl object-contain" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>{image.width && image.height ? `${image.width} × ${image.height}` : "Resultado generado"}</span>
            {requestId && <span>Solicitud: {requestId}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
