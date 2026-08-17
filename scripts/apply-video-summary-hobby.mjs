import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const routePath = path.join(root, "app/api/creator/video-summary/route.ts")

if (!fs.existsSync(routePath)) {
  console.log("[video-summary-hobby] route not found; skipped")
} else {
  let source = fs.readFileSync(routePath, "utf8")
  let changed = false

  function replaceOnce(from, to, label) {
    if (source.includes(to)) return
    if (!source.includes(from)) {
      throw new Error(`[video-summary-hobby] marker not found: ${label}`)
    }
    source = source.replace(from, to)
    changed = true
  }

  replaceOnce(
    'export const maxDuration = 300',
    'export const maxDuration = 60',
    'App Router duration',
  )

  replaceOnce(
    'const TARGET_SEGMENT_SECONDS = 600',
    'const TARGET_SEGMENT_SECONDS = 900',
    'segment size',
  )

  replaceOnce(
    'const SEGMENT_CONCURRENCY = 3',
    'const SEGMENT_CONCURRENCY = MAX_SEGMENTS',
    'segment concurrency',
  )

  replaceOnce(
    'schema: PLAN_SCHEMA,\n    maxOutputTokens: 512,\n    timeoutMs: 45_000,',
    'schema: PLAN_SCHEMA,\n    maxOutputTokens: 512,\n    timeoutMs: 15_000,',
    'duration fallback timeout',
  )

  replaceOnce(
    'maxOutputTokens: 5_500,\n      timeoutMs: 90_000,',
    'maxOutputTokens: 5_000,\n      timeoutMs: 42_000,',
    'segment timeout',
  )

  const functionStart = source.indexOf('async function buildGlobalSynthesis({')
  const postStart = source.indexOf('\nexport async function POST(', functionStart)

  if (functionStart < 0 || postStart < 0) {
    throw new Error('[video-summary-hobby] synthesis function markers not found')
  }

  const currentFunction = source.slice(functionStart, postStart)
  if (!currentFunction.includes('La consolidación se realizó localmente')) {
    const localSynthesis = `async function buildGlobalSynthesis({
  segmentResults,
  metadata,
}: {
  segmentResults: Array<{ segment: Segment; analysis: UnknownRecord }>
  metadata: PublicMetadata
  durationSeconds: number
  options: VideoSummaryOptions
  requestId: string
}): Promise<UnknownRecord> {
  const summaries = segmentResults
    .map(({ segment, analysis }) => {
      const summary = typeof analysis.summary === "string" ? analysis.summary.trim() : ""
      return summary ? segment.startLabel + "–" + segment.endLabel + ": " + summary : ""
    })
    .filter(Boolean)

  const takeaways = dedupeStrings(
    segmentResults.flatMap(({ analysis }) => stringArray(analysis.takeaways)),
    12,
  )
  const questions = dedupeStrings(
    segmentResults.flatMap(({ analysis }) => stringArray(analysis.questions)),
    12,
  )
  const limitations = dedupeStrings(
    segmentResults.flatMap(({ analysis }) => stringArray(analysis.limitations)),
    20,
  )
  const conceptNames = dedupeStrings(
    segmentResults.flatMap(({ analysis }) => objectArray(analysis.concepts)
      .map((concept) => typeof concept.name === "string" ? concept.name.trim() : "")
      .filter(Boolean)),
    8,
  )

  const centralThesis = takeaways[0]
    || (conceptNames.length
      ? "El video desarrolla principalmente " + conceptNames.slice(0, 3).join(", ") + "."
      : "Síntesis del video " + (metadata.title || "de YouTube") + ".")

  return {
    executiveSummary: summaries.join("\\n\\n"),
    centralThesis,
    takeaways,
    questions,
    limitations: dedupeStrings([
      "La consolidación se realizó localmente para mantener cada petición dentro del límite del plan Hobby.",
      ...limitations,
    ], 20),
  }
}
`
    source = source.slice(0, functionStart) + localSynthesis + source.slice(postStart)
    changed = true
  }

  if (changed) {
    fs.writeFileSync(routePath, source)
    console.log("[video-summary-hobby] segmented video analysis adapted for Hobby")
  } else {
    console.log("[video-summary-hobby] already applied")
  }
}

await import("./apply-video-model-registry.mjs")
await import("./test-video-model-registry.mjs")
await import("./apply-video-reusable-assets.mjs")
await import("./test-video-reusable-assets.mjs")
await import("./apply-video-preview-autostart.mjs")
await import("./test-video-preview-autostart.mjs")
await import("./apply-video-free-provider-router.mjs")
await import("./test-video-free-provider-router.mjs")
await import("./apply-production-hardening-stage2.mjs")
