"use client";

import { FormEvent, useState } from "react";

type GeneratedImage = {
  url: string;
  width: number;
  height: number;
  provider: string;
  model: string;
};

type SizeConfig = {
  value: string;
  label: string;
  width: number;
  height: number;
};

const sizes: SizeConfig[] = [
  { value: "landscape_4_3", label: "Horizontal 4:3", width: 1024, height: 768 },
  { value: "landscape_16_9", label: "Horizontal 16:9", width: 1280, height: 720 },
  { value: "square_hd", label: "Cuadrada HD", width: 1024, height: 1024 },
  { value: "portrait_4_3", label: "Vertical 3:4", width: 768, height: 1024 },
  { value: "portrait_16_9", label: "Vertical 9:16", width: 720, height: 1280 },
];

async function readPayload(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text };
  }
}

function getString(payload: Record<string, unknown>, key: string): string {
  return typeof payload[key] === "string" ? payload[key] : "";
}

export default function ImageGeneratorClient() {
  const [prompt, setPrompt] = useState("");
  const [imageSize, setImageSize] = useState("landscape_4_3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState<GeneratedImage | null>(null);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setImage(null);

    try {
      const selectedSize = sizes.find((size) => size.value === imageSize) || sizes[0];
      const response = await fetch("/api/agents/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: "realistic",
          width: selectedSize.width,
          height: selectedSize.height,
          provider: "auto",
          mode: "quality",
          source: "admin-model-lab",
        }),
      });

      const payload = await readPayload(response);
      if (!response.ok) throw new Error(getString(payload, "detail") || getString(payload, "error") || "No fue posible generar la imagen");

      const imageUrl = getString(payload, "imageUrl");
      if (!imageUrl) throw new Error("Image Studio no devolvió una imagen utilizable");

      setImage({
        url: imageUrl,
        width: selectedSize.width,
        height: selectedSize.height,
        provider: getString(payload, "provider") || "Image Studio EduAI",
        model: getString(payload, "model"),
      });
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
        Generación privada mediante Image Studio de EduAI con respaldo automático entre proveedores.
      </p>

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
          <button type="submit" disabled={loading || prompt.trim().length < 3} className="rounded-2xl bg-violet-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Generando imagen..." : "Crear imagen"}
          </button>
        </div>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {loading && <p className="mt-4 text-sm font-bold text-violet-100">La imagen se está generando.</p>}
        {error && <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      </div>

      {image?.url && (
        <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/60 p-3">
          <img src={image.url} alt="Imagen generada en Model Lab" className="max-h-[720px] w-full rounded-2xl object-contain" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>{image.width} × {image.height}</span>
            <span>{image.model ? `${image.provider} · ${image.model}` : image.provider}</span>
          </div>
        </div>
      )}
    </section>
  );
}
