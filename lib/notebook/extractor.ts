type ExtractResult = {
  title?: string
  text: string
  images?: string[]
  provider: "firecrawl" | "playwright" | "fetch"
}

function cleanText(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function extractTitleFromHtml(html: string, fallbackUrl?: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  const twitterTitle = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)

  const title =
    ogTitle?.[1]?.trim() ||
    twitterTitle?.[1]?.trim() ||
    titleMatch?.[1]?.trim()

  if (title) return cleanText(title).slice(0, 180)

  if (fallbackUrl) {
    try {
      const url = new URL(fallbackUrl)
      return url.hostname
    } catch {
      return undefined
    }
  }

  return undefined
}

function extractImagesFromHtml(html: string, baseUrl?: string): string[] {
  const out = new Set<string>()
  const matches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)

  for (const match of matches) {
    const src = match[1]?.trim()
    if (!src) continue
    try {
      const absolute = baseUrl ? new URL(src, baseUrl).toString() : src
      if (/^https?:\/\//i.test(absolute)) out.add(absolute)
    } catch {
      continue
    }

  return Array.from(out).slice(0, 12)
}

async function extractWithFirecrawl(url: string): Promise<ExtractResult | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        onlyMainContent: true,
      }),
    })

    if (!res.ok) {
      console.warn("[Extractor] Firecrawl HTTP error:", res.status)
      return null
    }

    const data = await res.json()
    const block = data?.data ?? data

    const title = block?.metadata?.title || block?.title || undefined
    const markdown = block?.markdown || ""
    const html = block?.html || ""
    const text = cleanText(markdown || html)

    if (!text) return null

    const images = Array.isArray(block?.metadata?.ogImage)
      ? block.metadata.ogImage
      : typeof block?.metadata?.ogImage === "string"
      ? [block.metadata.ogImage]
      : extractImagesFromHtml(html, url)

    return {
      title,
      text,
      images,
      provider: "firecrawl",
    }
  } catch (err) {
    console.warn("[Extractor] Firecrawl failed:", err)
    return null
  }
}

async function extractWithPlaywright(url: string): Promise<ExtractResult | null> {
  const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT
  if (!wsEndpoint) return null

  try {
    // Avoid static resolution at build time when playwright-core is not installed.
    const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<any>
    const playwright = await dynamicImport("playwright-core").catch(() => null)

    if (!playwright?.chromium?.connect) {
      console.warn("[Extractor] playwright-core not available, skipping Playwright fallback")
      return null
    }

    const browser = await playwright.chromium.connect(wsEndpoint)
    const page = await browser.newPage()

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => null)

      const title = await page.title().catch(() => undefined)
      const html = await page.content()
      const text = cleanText(html)
      const images = await page
        .evaluate(() =>
          Array.from(document.images)
            .map((img) => img.src)
            .filter((src) => /^https?:\/\//i.test(src))
            .slice(0, 12)
        )
        .catch(() => [])

      if (!text) return null

      return {
        title,
        text,
        images,
        provider: "playwright",
      }
    } finally {
      await page.close().catch(() => null)
      await browser.close().catch(() => null)
    }
  } catch (err) {
    console.warn("[Extractor] Playwright failed:", err)
    return null
  }
}

async function extractWithFetch(url: string): Promise<ExtractResult | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EduAI-NotebookBot/1.0; +https://eduaiplatformclon.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    })

    if (!res.ok) {
      console.warn("[Extractor] Fetch HTTP error:", res.status)
      return null
    }

    const html = await res.text()
    const text = cleanText(html)
    const title = extractTitleFromHtml(html, url)
    const images = extractImagesFromHtml(html, url)

    if (!text) return null

    return {
      title,
      text,
      images,
      provider: "fetch",
    }
  } catch (err) {
    console.warn("[Extractor] Fetch fallback failed:", err)
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

  throw new Error("No se pudo extraer contenido desde la URL")
}
