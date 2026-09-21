// next.config.ts  — actualizado para Notebook Hub
// Agrega paquetes nativos/Node como external packages del servidor

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // wllama publica TypeScript fuente; Next debe transpilarlo para Turbopack.
  transpilePackages: ["@wllama/wllama"],

  // Paquetes que no deben ser bundleados por Next.js.
  // pdf-inspector incluye un binario Rust específico para Linux en Vercel.
  serverExternalPackages: [
    "@firecrawl/pdf-inspector",
    "pdf-parse",
    "playwright-core",
    "mammoth",
  ],

  // Para usar @sparticuz/chromium en Vercel (opcional, si activas Playwright):
  // serverExternalPackages: ["playwright-core", "@sparticuz/chromium-min", "pdf-parse", "mammoth"],

  // Incluye el manifiesto generado del corpus en la función admin sin exponer el corpus completo.
  outputFileTracingIncludes: {
    "/api/admin/ai-core/local-factory": ["./artifacts/ai/eduai-local-corpus-manifest.json"],
  },

  // El Model Lab local necesita aislamiento cross-origin para SharedArrayBuffer y WASM multihilo.
  async headers() {
    return [
      {
        source: "/admin/model-lab/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ]
  },

  // Límite de memoria para funciones serverless de Vercel (default: 1024)
  // Si usas Playwright, necesitas al menos 1536MB
  // experimental: {
  //   serverActions: { bodySizeLimit: "10mb" },
  // },
}

export default nextConfig
