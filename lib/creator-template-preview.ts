import type { Browser } from "puppeteer-core"

const PREVIEW_WIDTH = 1400
const PREVIEW_HEIGHT = 1800

async function launchBrowser() {
  const chromium = (await import("@sparticuz/chromium")).default
  const puppeteer = await import("puppeteer-core")
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}

async function screenshotHtml(html: string) {
  let browser: Browser | null = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 })
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 30_000 })
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready
    })
    const screenshot = await page.screenshot({ type: "png", fullPage: false })
    return Buffer.from(screenshot)
  } finally {
    await browser?.close().catch(() => undefined)
  }
}

async function renderPdf(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getScreenshot({ first: 1, desiredWidth: PREVIEW_WIDTH, imageDataUrl: false, imageBuffer: true })
    const first = result.pages?.[0]?.data
    return first ? Buffer.from(first) : null
  } finally {
    await parser.destroy()
  }
}

async function renderDocx(buffer: Buffer) {
  const mammothModule = await import("mammoth")
  const mammoth = mammothModule.default || mammothModule
  const result = await mammoth.convertToHtml({ buffer })
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  *{box-sizing:border-box}
  html,body{margin:0;background:#e5e7eb;font-family:Arial,sans-serif;color:#111827}
  body{padding:48px}
  .page{width:100%;min-height:${PREVIEW_HEIGHT - 96}px;background:white;padding:88px 96px;box-shadow:0 12px 36px rgba(15,23,42,.18);overflow:hidden}
  h1{font-size:42px;line-height:1.1;margin:0 0 24px}
  h2{font-size:30px;line-height:1.2;margin:30px 0 14px}
  h3{font-size:24px;line-height:1.25;margin:24px 0 12px}
  p,li{font-size:20px;line-height:1.55}
  table{width:100%;border-collapse:collapse;margin:18px 0}
  td,th{border:1px solid #cbd5e1;padding:10px;font-size:17px}
  img{max-width:100%;height:auto}
</style>
</head>
<body><article class="page">${result.value}</article></body>
</html>`
  return screenshotHtml(html)
}

async function renderOfficeViewer(sourceUrl: string) {
  let browser: Browser | null = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    const viewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(sourceUrl)}`
    await page.goto(viewer, { waitUntil: "networkidle2", timeout: 45_000 })
    await new Promise((resolve) => setTimeout(resolve, 8_000))
    const screenshot = await page.screenshot({ type: "png", fullPage: false })
    return Buffer.from(screenshot)
  } finally {
    await browser?.close().catch(() => undefined)
  }
}

export async function renderCreatorTemplatePreview({
  buffer,
  mimeType,
  fileKind,
  sourceUrl,
}: {
  buffer: Buffer
  mimeType: string
  fileKind: "image" | "pdf" | "presentation" | "document"
  sourceUrl?: string | null
}) {
  if (fileKind === "image") return buffer
  try {
    if (fileKind === "pdf" || mimeType === "application/pdf") return await renderPdf(buffer)
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return await renderDocx(buffer)
    if (sourceUrl) return await renderOfficeViewer(sourceUrl)
  } catch (error) {
    console.error("[CreatorTemplatePreview]", error)
  }
  return null
}
