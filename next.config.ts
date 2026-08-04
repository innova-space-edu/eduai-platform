// next.config.ts  — actualizado para Notebook Hub
// Agrega paquetes nativos/Node como external packages del servidor

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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

  // Límite de memoria para funciones serverless de Vercel (default: 1024)
  // Si usas Playwright, necesitas al menos 1536MB
  // experimental: {
  //   serverActions: { bodySizeLimit: "10mb" },
  // },
}

export default nextConfig
