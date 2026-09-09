import { NextRequest, NextResponse } from "next/server"

const CACHE_SECONDS = 60 * 60 * 12
const MAX_SUBPAGES = 120
const MAX_CHARS = 900_000

function clean(value?: string | null) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
}

async function mediaWikiJson(host: string, params: URLSearchParams, signal: AbortSignal) {
  const response = await fetch(`https://${host}/w/api.php?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json", "User-Agent": "EDUAI-Wikimedia-Reader/1.0" },
    next: { revalidate: CACHE_SECONDS },
  })
  if (!response.ok) throw new Error(`Wikimedia respondió ${response.status}`)
  return response.json() as Promise<unknown>
}

async function pageExtract(host: string, titles: string[], signal: AbortSignal) {
  const params = new URLSearchParams({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    exsectionformat: "plain",
    redirects: "1",
    titles: titles.join("|"),
    format: "json",
    origin: "*",
  })
  const payload = (await mediaWikiJson(host, params, signal)) as {
    query?: { pages?: Record<string, { title?: string; extract?: string; missing?: boolean }> }
  }
  return Object.values(payload.query?.pages || {})
    .filter((page) => !page.missing && page.title && page.extract)
    .map((page) => ({ title: page.title || "", text: page.extract || "" }))
}

async function listSubpages(host: string, title: string, signal: AbortSignal) {
  const pages: string[] = []
  let continuation = ""

  while (pages.length < MAX_SUBPAGES) {
    const params = new URLSearchParams({
      action: "query",
      list: "allpages",
      apprefix: `${title}/`,
      apnamespace: "0",
      aplimit: "max",
      format: "json",
      origin: "*",
    })
    if (continuation) params.set("apcontinue", continuation)
    const payload = (await mediaWikiJson(host, params, signal)) as {
      query?: { allpages?: Array<{ title?: string }> }
      continue?: { apcontinue?: string }
    }
    for (const page of payload.query?.allpages || []) {
      if (page.title) pages.push(page.title)
      if (pages.length >= MAX_SUBPAGES) break
    }
    continuation = payload.continue?.apcontinue || ""
    if (!continuation) break
  }

  return pages
}

export async function GET(request: NextRequest) {
  const project = request.nextUrl.searchParams.get("project")
  const title = clean(request.nextUrl.searchParams.get("title")).slice(0, 300)
  if (!title || (project !== "wikisource" && project !== "wikibooks")) {
    return NextResponse.json({ error: "Proyecto o título inválido" }, { status: 400 })
  }

  const host = project === "wikisource" ? "es.wikisource.org" : "es.wikibooks.org"
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 16000)

  try {
    const [root, subpages] = await Promise.all([
      pageExtract(host, [title], controller.signal),
      listSubpages(host, title, controller.signal),
    ])

    const sections = [...root]
    for (let index = 0; index < subpages.length; index += 20) {
      const batch = subpages.slice(index, index + 20)
      const values = await pageExtract(host, batch, controller.signal)
      sections.push(...values)
      if (sections.reduce((sum, section) => sum + section.text.length, 0) >= MAX_CHARS) break
    }

    const seen = new Set<string>()
    const text = sections
      .filter((section) => {
        if (seen.has(section.title)) return false
        seen.add(section.title)
        return true
      })
      .map((section) => `# ${section.title}\n\n${section.text}`)
      .join("\n\n")
      .slice(0, MAX_CHARS)

    if (text.length < 100) {
      return NextResponse.json({ error: "No se encontró texto legible para esta obra" }, { status: 404 })
    }

    return NextResponse.json(
      {
        title,
        project,
        text,
        sections: sections.length,
        truncated: text.length >= MAX_CHARS,
        sourceUrl: `https://${host}/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`,
      },
      { headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400` } },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el texto Wikimedia" },
      { status: 502 },
    )
  } finally {
    clearTimeout(timeout)
  }
}
