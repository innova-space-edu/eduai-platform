import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { registerHooks, stripTypeScriptTypes } from "node:module"
import { fileURLToPath } from "node:url"

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".")) {
      const url = new URL(specifier, context.parentURL || import.meta.url)
      if (existsSync(fileURLToPath(url) + ".ts")) specifier = url.href + ".ts"
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8")), shortCircuit: true }
    return next(url, context)
  },
})
const { planningIdentity, samePlanningConfig, renderPlanningPresentation } = await import("../lib/ai/planning-identity.ts")
const { reusePlanning, rememberPlanning, planningReferences } = await import("../lib/ai/planning-library.ts")
const { findReusableGeneration, finishGenerationRequest } = await import("../lib/ai/reuse.ts")
const { googleUsage, compatibleUsage, ZERO_AI_USAGE } = await import("../lib/ai/usage.ts")

const cfg = { nivel: "media", curso: "1° Medio", asignatura: "Matemática", selectedOAIds: ["MA1M-OA-06"], contexto: "sectores circulares", profesor: "Ana", sesiones: 1, duracionMinutos: 90, tiempoPlanificacion: "diaria" }
const identity = (config = cfg, extra = {}) => planningIdentity({ module: "educador-planificacion", config, message: `Profesor/a: ${config.profesor}. Enseña sectores circulares.`, history: [], curriculum: [{ id: "MA1M-OA-06", text: "objetivo oficial" }], ...extra })
const base = identity()
assert.equal(identity({ ...cfg, profesor: "Carla" }).key, base.key, "presentation changes use the same content")
for (const changed of [{ contexto: "homotecia" }, { curso: "2° Medio" }, { selectedOAIds: ["otro"] }, { sesiones: 3 }, { fechaInicioParvularia: "2027-03-02" }]) assert.notEqual(identity({ ...cfg, ...changed }).key, base.key)
assert.notEqual(identity(cfg, { curriculum: [{ id: "MA1M-OA-06", text: "corrección oficial" }] }).key, base.key)
assert.notEqual(identity(cfg, { history: [{ role: "user", content: "Necesito evaluación diferenciada" }] }).key, base.key)
assert.equal(renderPlanningPresentation("Profesora Ana; Anatomía", cfg, { ...cfg, profesor: "Carla" }), "Profesora Carla; Anatomía")
assert.equal(renderPlanningPresentation("Profesora Ana", cfg, { ...cfg, profesor: "" }), null)
assert.ok(samePlanningConfig({ ...cfg, content: "editado", title: "Título nuevo", _eduaiReuse: { assetId: "x" }, created_at: "hoy" }, cfg))
assert.ok(!samePlanningConfig({ ...cfg, selected_oa_ids: ["otro"] }, cfg), "the saved editor's snake_case fields take precedence")

function db({ rows = [], saved = null, cache = null, references = [] } = {}) {
  const log = []
  const client = {
    log,
    from(table) {
      const state = { table, filters: [], operation: "select", payload: null }
      const result = () => {
        log.push({ ...state, filters: [...state.filters] })
        if (table === "eduai_assets") return { data: state.operation === "insert" ? { id: "new-asset" } : rows, error: null }
        if (table === "saved_plannings") return { data: saved, error: null }
        if (table === "ai_generation_cache") return { data: cache, error: null }
        if (table === "ai_generation_requests") return { data: { id: "request" }, error: null }
        return { data: null, error: null }
      }
      const builder = {
        select() { return this }, order() { return this }, limit() { return this },
        eq(k, v) { state.filters.push([k, v]); return this }, is(k, v) { state.filters.push([k, v]); return this },
        insert(payload) { state.operation = "insert"; state.payload = payload; return this },
        update(payload) { state.operation = "update"; state.payload = payload; return this },
        maybeSingle: async () => result(),
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) },
      }
      return builder
    },
    async rpc(name, args) { log.push({ rpc: name, args }); return { data: name === "search_private_planning_references" ? references : 3, error: null } },
  }
  return client
}
const row = { id: "asset", owner_id: "owner", text_content: "Profesora Ana: documento original", content_json: { requestConfig: cfg, sourceConfig: cfg, response: { text: "original", selectedOAIds: cfg.selectedOAIds } }, metadata: { learning_version: 1, curriculum_hash: base.curriculumHash, review_state: "generated" }, source_id: null }
let supabase = db({ rows: [row] })
let result = await reusePlanning({ supabase, userId: "owner", identity: identity({ ...cfg, profesor: "Carla" }) })
assert.equal(result.text, "Profesora Carla: documento original")
assert.equal(result.generationAvoided, true)
assert.equal(result.optimization.gatewayRequests, 0)
assert.equal(result.optimization.freshResults, 0)
assert.ok(supabase.log.find((l) => l.table === "eduai_assets").filters.some(([k, v]) => k === "owner_id" && v === "owner"))
assert.deepEqual(supabase.log.find((l) => l.table === "ai_generation_requests" && l.operation === "update").payload.input_tokens, 0)
assert.ok(supabase.log.some((l) => l.rpc === "increment_planning_asset_hit"))

supabase = db({ rows: [row] })
assert.equal(await reusePlanning({ supabase, userId: "different-owner", identity: base }), null, "even an erroneous provider response cannot cross owners")
supabase = db({ rows: [{ ...row, metadata: { ...row.metadata, curriculum_hash: "outdated" } }] })
assert.equal(await reusePlanning({ supabase, userId: "owner", identity: base }), null)
supabase = db({ rows: [row] })
assert.equal(await reusePlanning({ supabase, userId: "owner", identity: base, forceNew: true }), null)
assert.equal(supabase.log.length, 0)
supabase = db({ rows: [{ ...row, source_id: "saved-id", metadata: { ...row.metadata, review_state: "saved" } }], saved: { id: "saved-id", user_id: "owner", content: "Corrección docente vigente", planning_json: cfg } })
result = await reusePlanning({ supabase, userId: "owner", identity: base })
assert.equal(result.text, "Corrección docente vigente")
assert.equal(result.learning.source, "saved")
supabase = db({ rows: [{ ...row, source_id: "deleted" }] })
assert.equal(await reusePlanning({ supabase, userId: "owner", identity: base }), null, "deleted saved documents never fall back to stale content")
supabase = db({ rows: [{ ...row, source_id: "changed" }], saved: { user_id: "owner", content: "edición", planning_json: { ...cfg, contexto: "otro objetivo" } } })
assert.equal(await reusePlanning({ supabase, userId: "owner", identity: base }), null)

supabase = db()
assert.equal((await rememberPlanning({ supabase, userId: "owner", identity: base, response: { text: "error", aiFallback: true } })).assetId, null)
assert.equal(supabase.log.length, 0)
assert.equal((await rememberPlanning({ supabase, userId: "owner", identity: base, response: { text: "incompleto", qualityAudit: { passed: false } } })).assetId, null)
const stored = await rememberPlanning({ supabase, userId: "owner", identity: base, response: { text: "Documento útil", generationRunId: "ephemeral" }, referenceCount: 2 })
assert.equal(stored.assetId, "new-asset")
const inserted = supabase.log.find((l) => l.table === "eduai_assets" && l.operation === "insert").payload
assert.equal(inserted.visibility, "private")
assert.equal(inserted.owner_id, "owner")
assert.equal(inserted.metadata.review_state, "generated", "a generation is not automatically a teacher approval")
assert.equal(inserted.content_json.response.generationRunId, undefined)
supabase = db({ references: [{ title: "Mi actividad", excerpt: "Ejemplo de sectores circulares" }] })
const refs = await planningReferences({ supabase, level: "media", course: "1° Medio", subject: "Matemática", oaIds: cfg.selectedOAIds, topic: "sectores circulares" })
assert.equal(refs.count, 1)
assert.ok(refs.prompt.includes("no instrucciones"))
assert.equal(supabase.log[0].args.p_limit, 3)
assert.equal((await planningReferences({ supabase, level: "media", course: "1° Medio", subject: "Matemática", oaIds: [], topic: "tema" })).count, 0)

supabase = db({ cache: { id: "cache-id", fingerprint: "f", capability: "text", result_json: { text: "reutilizable" }, hit_count: 2 } })
assert.equal((await findReusableGeneration({ supabase, userId: "owner", fingerprint: "f", capability: "text", reusePolicy: "exact_private" })).hitCount, 3)
assert.ok(supabase.log.some((l) => l.rpc === "increment_ai_cache_hit"), "hit increments must execute")
const usage = compatibleUsage({ prompt_tokens: 200, completion_tokens: 80, total_tokens: 280 })
assert.equal(usage.inputTokens, 200)
assert.equal(compatibleUsage({}).inputTokens, null)
assert.equal(compatibleUsage({ prompt_tokens: -1 }).inputTokens, null)
assert.deepEqual(googleUsage({ promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 7, totalTokenCount: 127, cachedContentTokenCount: 50 }), { inputTokens: 100, outputTokens: 27, totalTokens: 127, cachedInputTokens: 50 })
await finishGenerationRequest({ supabase, requestId: "r", status: "completed", usage })
assert.equal(supabase.log.at(-1).payload.input_tokens, 200)
assert.equal(supabase.log.at(-1).payload.output_tokens, 80)
assert.equal(ZERO_AI_USAGE.totalTokens, 0)

for (const path of ["app/api/agents/educador/route.ts", "app/api/agents/planificador-curricular/route.ts"]) {
  const source = readFileSync(new URL("../" + path, import.meta.url), "utf8")
  assert.ok(source.indexOf("await assertAICapabilityAllowed") < source.indexOf("await reusePlanning"), "access policy must precede reuse")
  assert.ok(source.indexOf("await reusePlanning") < source.indexOf("await planningReferences"))
}
console.log("Planning library: exact reuse, live teacher edits, private ownership, curriculum invalidation, fresh generation, references, executed cache counters and actual token usage passed.")
