import { cleanHtml } from "./chunking"

export type ExtractResult = {
  title: string
  text: string
  images: string[]
  source: "firecrawl" | "fetch" | "playwright"
}

async function extractWithFirecrawl(url: string): Promise<ExtractResult | null> {
  const key = process.env.FIRECRAWL_API_KEY?.trim()
  if (!key) return null

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        onlyMainContent: true,
        waitFor: 1500,
      }),
      signal: AbortSignal.timeout(25_000),
    })

    if (!res.ok) {
      console.warn("[Extractor] Firecrawl HTTP error:", res.status)
      return null
    }

    const data = await res.json()
    if (!data?.success) return null

    const markdown = typeof data.data?.markdown === "string" ? data.data.markdown : ""
    const html = typeof data.data?.html === "string" ? data.data.html : ""
    const text = (markdown || cleanHtml(html || "")).slice(0, 60_000)
    const title =
      (typeof data.data?.metadata?.title === "string" && data.data.metadata.title.trim()) || url
    const rawImages = data.data?.metadata?.images
    const images = Array.isArray(rawImages)
      ? rawImages.filter((img: unknown): img is string => typeof img === "string").slice(0, 5)
      : []

    if (!text || text.length < 50) return null

    return { title, text, images, source: "firecrawl" }
  } catch (err) {
    console.warn("[Extractor] Firecrawl failed:", err)
    return null
  }
}

async function extractWithFetch(url: string): Promise<ExtractResult | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EduAI-NotebookBot/1.0; +https://eduai.cl)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es,en;q=0.5",
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const html = await res.text()
    const text = cleanHtml(html).slice(0, 50_000)
    const title = extractHtmlTitle(html) ?? url
    const images = extractImageUrls(html, url)

    if (!text || text.length < 50) return null

    return { title, text, images, source: "fetch" }
  } catch (err) {
    console.warn("[Extractor] fetch failed:", err)
    return null
  }
}

function extractHtmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m?.[1]?.trim().slice(0, 120) ?? null
}

function extractImageUrls(html: string, baseUrl: string): string[] {
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
  const urls = matches
    .map((m) => m[1])
    .filter(Boolean)
    .map((src) => {
      try {
        return new URL(src, baseUrl).toString()
      } catch {
        return ""
      }
    })
    .filter((src) => /^https?:\/\//i.test(src))

  return Array.from(new Set(urls)).slice(0, 5)
}

async function extractWithPlaywright(url: string): Promise<ExtractResult | null> {
  const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT?.trim()
  if (!wsEndpoint) return null

  try {
    const playwright = (await import("playwright-core")) as typeof import("playwright-core")
    const browser = await playwright.chromium.connect(wsEndpoint)
    const page = await browser.newPage()

    await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 })

    const text = await page.evaluate(() => {
      const article = document.querySelector("article, main, [role='main'], .content, #content")
      const element = article ?? document.body

      element
        .querySelectorAll("nav, footer, header, aside, script, style, .ad, [class*='nav']")
        .forEach((n) => n.remove())

      return (element as HTMLElement).innerText.slice(0, 60_000)
    })

    const title = (await page.title()).slice(0, 120)
    const images = await page.evaluate(() =>
      Array.from(document.querySelectorAll("article img, main img, img"))
        .slice(0, 5)
        .map((img) => (img as HTMLImageElement).src)
        .filter((src) => /^https?:\/\//i.test(src))
    )

    await browser.close()

    if (!text || text.length < 50) return null

    return { title: title || url, text, images, source: "playwright" }
  } catch (err) {
    console.warn("[Extractor] Playwright failed:", err)
    return null
  }
}

export async function extractUrlContent(url: string): Promise<ExtractResult> {
  const firecrawl = await extractWithFirecrawl(url)
  if (firecrawl) return firecrawl

  const playwright = await extractWithPlaywright(url)
  if (playwright) return playwright

  const fetched = await extractWithFetch(url)
  if (fetched) return fetched

  return {
    title: url,
    text: "",
    images: [],
    source: "fetch",
  }
}
