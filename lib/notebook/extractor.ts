type ExtractResult = {
  title?: string
  text: string
  images?: string[]
  provider: "firecrawl" | "fetch"
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

  const title =
    ogTitle?.[1]?.trim() ||
    titleMatch?.[1]?.trim()

  if (title) return cleanText(title).slice(0, 180)

  if (fallbackUrl) {
    try {
      return new URL(fallbackUrl).hostname
    } catch {}
  }

  return undefined
}

function extractImagesFromHtml(html: string, baseUrl?: string): string[] {
  const out = new Set<string>()
  const matches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)

  for (const match of matches) {
    try {
      const src = baseUrl ? new URL(match[1], baseUrl).toString() : match[1]
      if (/^https?:\/\//i.test(src)) out.add(src)
    } catch {}
  }

  return Array.from(out).slice(0, 10)
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

    if (!res.ok) return null

    const data = await res.json()
    const block = data?.data ?? data

    const text = cleanText(block?.markdown || block?.html || "")
    if (!text) return null

    return {
      title: block?.metadata?.title,
      text,
      images: extractImagesFromHtml(block?.html || "", url),
      provider: "firecrawl",
    }
  } catch {
    return null
  }
}

async function extractWithFetch(url: string): Promise<ExtractResult | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null

    const html = await res.text()
    const text = cleanText(html)

    if (!text) return null

    return {
      title: extractTitleFromHtml(html, url),
      text,
      images: extractImagesFromHtml(html, url),
      provider: "fetch",
    }
  } catch {
    return null
  }
}

export async function extractUrlContent(url: string): Promise<ExtractResult> {
  const firecrawl = await extractWithFirecrawl(url)
  if (firecrawl) return firecrawl

  const fetched = await extractWithFetch(url)
  if (fetched) return fetched

  throw new Error("No se pudo extraer contenido")
}
