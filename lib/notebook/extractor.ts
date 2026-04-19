// lib/notebook/extractor.ts
// Extractor web de 3 capas:
//   1. Firecrawl API  — scraping + JS rendering en la nube (recomendado para Vercel)
//   2. fetch + cheerio — extracción básica sin JS rendering
//   3. Playwright     — solo para self-hosted / servidor dedicado
//
// NOTA Playwright en Vercel:
//   Vercel serverless tiene límite de 250MB. Playwright + Chromium ≈ 200MB.
//   Solución: usar @sparticuz/chromium-min + playwright-core (ver abajo).
//   Para la mayoría de casos, Firecrawl es más simple y más confiable.

import { cleanHtml } from "./chunking"

export type ExtractResult = {
  title:   string
  text:    string
  images:  string[]
  source:  "firecrawl" | "fetch" | "playwright"
}

// ─── Capa 1: Firecrawl ────────────────────────────────────────────────────────
// Maneja JS, SPAs, bloqueos, captchas. Plan gratuito disponible.
// Docs: https://docs.firecrawl.dev

async function extractWithFirecrawl(url: string): Promise<ExtractResult | null> {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) return null

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        url,
        formats:          ["markdown", "extract"],
        onlyMainContent: true,
        waitFor:         1500,
      }),
      signal: AbortSignal.timeout(25_000),
    })

    if (!res.ok) return null
    const data = await res.json()
    if (!data.success) return null

    const text   = (data.data?.markdown ?? data.data?.content ?? "").slice(0, 60_000)
    const title  = data.data?.metadata?.title ?? url
    const images = (data.data?.metadata?.images ?? []).slice(0, 5)

    if (!text || text.length < 50) return null

    return { title, text, images, source: "firecrawl" }
  } catch (err) {
    console.warn("[Extractor] Firecrawl failed:", err)
    return null
  }
}

// ─── Capa 2: fetch + cheerio (sin JS rendering) ───────────────────────────────

async function extractWithFetch(url: string): Promise<ExtractResult | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EduAI-NotebookBot/1.0; +https://eduai.cl)",
        "Accept":     "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es,en;q=0.5",
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const html  = await res.text()
    const text  = cleanHtml(html).slice(0, 50_000)
    const title = extractHtmlTitle(html) ?? url

    if (!text || text.length < 50) return null

    return { title, text, images: [], source: "fetch" }
  } catch (err) {
    console.warn("[Extractor] fetch failed:", err)
    return null
  }
}

function extractHtmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m?.[1]?.trim().slice(0, 120) ?? null
}

// ─── Capa 3: Playwright (self-hosted) ─────────────────────────────────────────
// Solo disponible si PLAYWRIGHT_WS_ENDPOINT está configurado
// (ej: servidor propio con Playwright server, o browserless.io)
//
// Para correr localmente:
//   npm i playwright @playwright/test
//   npx playwright install chromium
//
// Para Vercel (serverless):
//   npm i playwright-core @sparticuz/chromium-min
//   Configurar next.config.ts con serverComponentsExternalPackages

async function extractWithPlaywright(url: string): Promise<ExtractResult | null> {
  // Opción A: Playwright server remoto (browserless.io, self-hosted, etc.)
  const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT
  if (!wsEndpoint) return null

  try {
    // "playwright-core" es opcional — solo si está instalado y PLAYWRIGHT_WS_ENDPOINT está definido.
    // El cast evita el error TS cuando el paquete no está en node_modules.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { chromium } = await import("playwright-core" as any) as any

    const browser = await chromium.connect(wsEndpoint)
    const page    = await browser.newPage()

    await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 })

    // Extraer contenido del article/main, o del body como fallback
    const text = await page.evaluate(() => {
      const article = document.querySelector("article, main, [role='main'], .content, #content")
      const el      = article ?? document.body

      // Limpiar elementos de ruido
      el.querySelectorAll("nav, footer, header, aside, script, style, .ad, [class*='nav']")
        .forEach((n) => n.remove())

      return el.innerText.slice(0, 60_000)
    })

    const title  = await page.title()
    const images = await page.evaluate(() =>
      Array.from(document.querySelectorAll("article img, main img"))
        .slice(0, 5)
        .map((img) => (img as HTMLImageElement).src)
        .filter((src) => src.startsWith("http"))
    )

    await browser.close()

    if (!text || text.length < 50) return null

    return { title: title.slice(0, 120), text, images, source: "playwright" }
  } catch (err) {
    console.warn("[Extractor] Playwright failed:", err)
    return null
  }
}

// ─── Función pública: intenta en cascada ─────────────────────────────────────

export async function extractUrlContent(url: string): Promise<ExtractResult> {
  // 1. Firecrawl (cloud, JS rendering, recomendado)
  const fc = await extractWithFirecrawl(url)
  if (fc) return fc

  // 2. Playwright (si hay endpoint configurado)
  const pw = await extractWithPlaywright(url)
  if (pw) return pw

  // 3. fetch básico
  const ft = await extractWithFetch(url)
  if (ft) return ft

  // Sin resultados
  return {
    title:  url,
    text:   "",
    images: [],
    source: "fetch",
  }
}
