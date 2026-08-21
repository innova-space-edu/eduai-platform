import { readFileSync, writeFileSync } from "node:fs"

const filePath = "lib/notebook/ingestion-v2.ts"
let source = readFileSync(filePath, "utf8")

source = source.replace(
  `    let root = $("body")
    for (const selector of selectors) {
      const candidate = $(selector).first()
      if (candidate.length && candidate.text().trim().length > 300) {
        root = candidate
        break
      }
    }

    const blocks: string[] = []
    root.find("h1,h2,h3,h4,p,li,blockquote,pre,figcaption").each((_, element) => {
      const tag = element.tagName?.toLowerCase() || ""`,
  `    let rootSelector = "body"
    for (const selector of selectors) {
      const candidate = $(selector).first()
      if (candidate.length && candidate.text().trim().length > 300) {
        rootSelector = selector
        break
      }
    }

    const root = $(rootSelector).first()
    const blocks: string[] = []
    root.find("h1,h2,h3,h4,p,li,blockquote,pre,figcaption").each((_, element) => {
      const tag = ((element as { tagName?: string }).tagName || "").toLowerCase()`,
)

const safeRemoteImport = `import { fetchSafeRemoteBytes } from "@/lib/safe-remote-url"`
if (!source.includes(safeRemoteImport)) {
  source = source.replace(
    `import { fetchPublicUrl } from "./url-safety"`,
    `import { fetchPublicUrl } from "./url-safety"\n${safeRemoteImport}`,
  )
}

source = source.replace(
  `async function extractRemotePdf(url: string): Promise<string> {
  const response = await fetchPublicUrl(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/pdf,*/*;q=0.5",
    },
    signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) throw new Error(\`PDF remoto respondió HTTP \${response.status}\`)

  const length = Number(response.headers.get("content-length") || 0)
  if (length > MAX_REMOTE_FILE_BYTES) throw new Error("El PDF supera el límite de 20 MB")

  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_REMOTE_FILE_BYTES) throw new Error("El PDF supera el límite de 20 MB")
  return parsePdfBuffer(Buffer.from(arrayBuffer))
}`,
  `async function extractRemotePdf(url: string): Promise<string> {
  const { buffer, mimeType } = await fetchSafeRemoteBytes({
    url,
    maxBytes: MAX_REMOTE_FILE_BYTES,
    timeoutMs: 25_000,
    maxRedirects: 5,
    userAgent: USER_AGENT,
    headers: { Accept: "application/pdf,*/*;q=0.5" },
  })
  if (mimeType !== "application/pdf" && mimeType !== "application/octet-stream") {
    throw new Error(\`El recurso remoto no es un PDF (\${mimeType})\`)
  }
  return parsePdfBuffer(buffer)
}`,
)

source = source.replace(
  `  if (contentType.includes("application/pdf") || new URL(response.url || url).pathname.toLowerCase().endsWith(".pdf")) {
    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_REMOTE_FILE_BYTES) throw new Error("El PDF supera el límite de 20 MB")
    const pdfText = await parsePdfBuffer(Buffer.from(arrayBuffer))
    return normalizeText([crossrefText, pdfText].filter(Boolean).join("\\n\\n--- TEXTO COMPLETO ---\\n\\n"), 120_000)
  }`,
  `  if (contentType.includes("application/pdf") || new URL(response.url || url).pathname.toLowerCase().endsWith(".pdf")) {
    if (response.body) await response.body.cancel().catch(() => undefined)
    const pdfText = await extractRemotePdf(response.url || url)
    return normalizeText([crossrefText, pdfText].filter(Boolean).join("\\n\\n--- TEXTO COMPLETO ---\\n\\n"), 120_000)
  }`,
)

writeFileSync(filePath, source)
