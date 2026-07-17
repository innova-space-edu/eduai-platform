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

writeFileSync(filePath, source)
