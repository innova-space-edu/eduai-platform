import fs from "node:fs"
import path from "node:path"

const healthPath = path.join(process.cwd(), "app/api/admin/ai-core/health/route.ts")
const panelPath = path.join(process.cwd(), "components/admin/AICoreHealthPanel.tsx")
let health = fs.readFileSync(healthPath, "utf8")
let panel = fs.readFileSync(panelPath, "utf8")
let changed = false

function replaceIn(target, from, to, label) {
  let source = target === "health" ? health : panel
  if (source.includes(to)) return
  if (!source.includes(from)) throw new Error(`[google-research-runtime] marker not found: ${label}`)
  source = source.replace(from, to)
  if (target === "health") health = source
  else panel = source
  changed = true
}

if (!health.includes('from "@/lib/ai/providers/google-deep-research"')) {
  health = health.replace(
    'import { hasGoogleAI } from "@/lib/ai/providers/google"\n',
    'import { hasGoogleAI } from "@/lib/ai/providers/google"\nimport { hasGoogleDeepResearch } from "@/lib/ai/providers/google-deep-research"\nimport { googleFileSearchEmbeddingModel, hasGoogleFileSearch } from "@/lib/ai/providers/google-file-search"\n',
  )
  changed = true
}

replaceIn(
  "health",
  `  "video_usage_daily",\n] as const`,
  `  "video_usage_daily",\n  "eduai_deep_research_jobs",\n  "eduai_google_file_search_stores",\n  "eduai_google_file_search_documents",\n] as const`,
  "required Google research tables",
)

replaceIn(
  "health",
  `    research: {\n      tavily: configured("TAVILY_API_KEY"),\n      firecrawl: configured("FIRECRAWL_API_KEY"),\n      googleGrounding: hasGoogleAI("text"),\n    },`,
  `    research: {\n      tavily: configured("TAVILY_API_KEY"),\n      firecrawl: configured("FIRECRAWL_API_KEY"),\n      googleGrounding: hasGoogleAI("text"),\n      deepResearch: hasGoogleDeepResearch(),\n      fileSearch: hasGoogleFileSearch(),\n      fileSearchEmbeddingModel: googleFileSearchEmbeddingModel(),\n    },`,
  "Google research runtime state",
)

replaceIn(
  "panel",
  `    research: { tavily: boolean; firecrawl: boolean; googleGrounding: boolean }`,
  `    research: {\n      tavily: boolean\n      firecrawl: boolean\n      googleGrounding: boolean\n      deepResearch: boolean\n      fileSearch: boolean\n      fileSearchEmbeddingModel: string\n    }`,
  "Google research response types",
)

if (!panel.includes('label="Google Deep Research"')) {
  const marker = '                <Status ok={data.configuration.google.video} label="Video" />'
  if (!panel.includes(marker)) throw new Error("[google-research-runtime] Google status UI marker not found")
  panel = panel.replace(
    marker,
    `${marker}\n                <Status ok={data.configuration.research.deepResearch} label="Google Deep Research" />\n                <Status ok={data.configuration.research.fileSearch} label="Google File Search" />`,
  )
  changed = true
}

if (!panel.includes("File Search embeddings:")) {
  const marker = "                <p>Embeddings: {data.configuration.google.embeddingModel}</p>"
  if (!panel.includes(marker)) throw new Error("[google-research-runtime] embedding UI marker not found")
  panel = panel.replace(
    marker,
    `${marker}\n                <p>File Search embeddings: {data.configuration.research.fileSearchEmbeddingModel}</p>`,
  )
  changed = true
}

if (changed) {
  fs.writeFileSync(healthPath, health)
  fs.writeFileSync(panelPath, panel)
  console.log("[google-research-runtime] Deep Research y File Search visibles en Model Lab sin secretos")
} else {
  console.log("[google-research-runtime] already applied")
}
