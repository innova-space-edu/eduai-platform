import fs from "node:fs"
import path from "node:path"

const routePath = path.join(process.cwd(), "app/api/work/deep-research/route.ts")
let source = fs.readFileSync(routePath, "utf8")
let changed = false

function replaceOnce(from, to, label) {
  if (source.includes(to)) return
  if (!source.includes(from)) throw new Error(`[deep-research-hardening] marker not found: ${label}`)
  source = source.replace(from, to)
  changed = true
}

replaceOnce(
  `export async function POST(request: NextRequest) {\n  const startedAt = Date.now()\n  let requestId: string | null = null\n  try {`,
  `export async function POST(request: NextRequest) {\n  const startedAt = Date.now()\n  let requestId: string | null = null\n  let requestSupabase: Awaited<ReturnType<typeof createClient>> | null = null\n  try {`,
  "POST request Supabase recovery state",
)

replaceOnce(
  `    const supabase = await createClient()\n    const { data: { user } } = await supabase.auth.getUser()`,
  `    const supabase = await createClient()\n    requestSupabase = supabase\n    const { data: { user } } = await supabase.auth.getUser()`,
  "capture POST Supabase client",
)

replaceOnce(
  `  } catch (error) {\n    const typed = error as Error & { status?: number; code?: string }\n    return NextResponse.json(\n      { error: typed.message || "No fue posible iniciar Deep Research", code: typed.code || undefined },\n      { status: typed.status || 500 },\n    )\n  }\n}\n\nexport async function GET(request: NextRequest) {\n  try {`,
  `  } catch (error) {\n    const typed = error as Error & { status?: number; code?: string }\n    if (requestId && requestSupabase) {\n      await finishGenerationRequest({\n        supabase: requestSupabase,\n        requestId,\n        status: "failed",\n        provider: "google",\n        error: typed.message || "No fue posible iniciar Deep Research",\n        latencyMs: Date.now() - startedAt,\n        metadata: { background: true, startFailed: true },\n      })\n    }\n    return NextResponse.json(\n      { error: typed.message || "No fue posible iniciar Deep Research", code: typed.code || undefined },\n      { status: typed.status || 500 },\n    )\n  }\n}\n\nexport async function GET(request: NextRequest) {\n  let recovery: { jobId: string; ownerId: string; requestId: string | null; agent: string; interactionId: string } | null = null\n  try {`,
  "POST failure closure and GET recovery state",
)

replaceOnce(
  `    const job = rawJob as DeepResearchJob\n\n    if (["completed", "failed", "cancelled"].includes(job.status)) {`,
  `    const job = rawJob as DeepResearchJob\n    recovery = {\n      jobId: job.id,\n      ownerId: user.id,\n      requestId: job.generation_request_id,\n      agent: job.agent,\n      interactionId: job.interaction_id,\n    }\n\n    if (["completed", "failed", "cancelled"].includes(job.status)) {`,
  "capture GET recovery metadata",
)

replaceOnce(
  `    const { data: claimed } = await admin\n      .from("eduai_deep_research_jobs")`,
  `    const completedText = interaction.text.trim()\n    if (!completedText) {\n      const errorMessage = "Deep Research terminó sin un informe de texto"\n      const now = new Date().toISOString()\n      await admin.from("eduai_deep_research_jobs").update({\n        status: "failed",\n        error_message: errorMessage,\n        updated_at: now,\n        completed_at: now,\n        metadata: { ...(job.metadata || {}), google_status: interaction.rawStatus },\n      }).eq("id", job.id).eq("owner_id", user.id)\n      await finishGenerationRequest({\n        supabase,\n        requestId: job.generation_request_id,\n        status: "failed",\n        provider: "google",\n        model: job.agent,\n        error: errorMessage,\n        metadata: { background: true, interactionId: job.interaction_id, emptyResult: true },\n      })\n      return NextResponse.json({ ...responseForStoredJob(job), status: "failed", error: errorMessage }, { status: 502 })\n    }\n\n    const { data: claimed } = await admin\n      .from("eduai_deep_research_jobs")`,
  "validate completed text before finalizing claim",
)

replaceOnce(
  `    const citations = dedupeCitations([...localCitations, ...googleCitations])\n    const text = interaction.text.trim()\n    if (!text) throw new Error("Deep Research terminó sin un informe de texto")`,
  `    const citations = dedupeCitations([...localCitations, ...googleCitations])\n    const text = completedText`,
  "reuse validated completed text",
)

replaceOnce(
  `  } catch (error) {\n    const typed = error as Error & { status?: number; code?: string }\n    return NextResponse.json(\n      { error: typed.message || "No fue posible consultar Deep Research", code: typed.code || undefined },\n      { status: typed.status || 500 },\n    )\n  }\n}`,
  `  } catch (error) {\n    const typed = error as Error & { status?: number; code?: string }\n    if (recovery) {\n      try {\n        const admin = adminClient()\n        const now = new Date().toISOString()\n        await admin.from("eduai_deep_research_jobs").update({\n          status: "failed",\n          error_message: (typed.message || "No fue posible finalizar Deep Research").slice(0, 1200),\n          updated_at: now,\n          completed_at: now,\n        }).eq("id", recovery.jobId).eq("owner_id", recovery.ownerId).in("status", ["queued", "running", "finalizing"])\n\n        const supabase = await createClient()\n        await finishGenerationRequest({\n          supabase,\n          requestId: recovery.requestId,\n          status: "failed",\n          provider: "google",\n          model: recovery.agent,\n          error: typed.message || "No fue posible finalizar Deep Research",\n          metadata: { background: true, interactionId: recovery.interactionId, finalizationFailed: true },\n        })\n      } catch (recoveryError) {\n        console.warn("[Deep Research recovery]", recoveryError instanceof Error ? recoveryError.message : String(recoveryError))\n      }\n    }\n    return NextResponse.json(\n      { error: typed.message || "No fue posible consultar Deep Research", code: typed.code || undefined },\n      { status: typed.status || 500 },\n    )\n  }\n}`,
  "GET finalization recovery",
)

if (changed) {
  fs.writeFileSync(routePath, source)
  console.log("[deep-research-hardening] requests/jobs cierran como failed ante errores de arranque o finalización")
} else {
  console.log("[deep-research-hardening] already applied")
}
