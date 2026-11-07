import assert from "node:assert/strict"
import { classifyMaleCNSSource, getMaleCNSVerifiedContext } from "../lib/eduai/malecns-source-boundary"
import { getEduAIPlatformKnowledgeContext } from "../lib/eduai/platform-knowledge"

async function main() {

// This fake DB fails immediately: project-specific answers must never depend
// on or accidentally load the old V29/V45C records in Supabase.
const staleDb = { from: () => { throw new Error("STALE DATABASE ACCESSED") } } as never

assert.equal(classifyMaleCNSSource("¿Qué es MaleCNS?"), "internal")
assert.equal(classifyMaleCNSSource("Explica el conectoma Male CNS v1.0 de Janelia"), "external")
assert.equal(classifyMaleCNSSource("Compara nuestro MaleCNS con el connectoma de Janelia"), "comparison")
assert.equal(classifyMaleCNSSource("Explícame cuántas neuronas hay en un cerebro"), null)
assert.equal(classifyMaleCNSSource("Explica ScientificBrain como plataforma científica"), null)

const internal = await getEduAIPlatformKnowledgeContext(staleDb, "¿Qué es MaleCNS?")
assert.match(internal, /MaleCNS Principal/)
assert.match(internal, /MaleCNS-Cognitive/)
assert.match(internal, /no consulta live/i)
assert.doesNotMatch(internal, /V29-fix1 mostró query accuracy/i)
assert.doesNotMatch(internal, /124,2 millones de contactos/i)
assert.doesNotMatch(internal, /87\.331 parámetros/i)

const internalAdmin = await getEduAIPlatformKnowledgeContext(staleDb, "Estado de nuestro MaleCNS", [], { allowInternalResearch: true })
assert.match(internalAdmin, /C0\.13 OneEpoch-NewOnly/)
assert.match(internalAdmin, /48,4375%/)
assert.match(internalAdmin, /promovido=false/)
assert.match(internalAdmin, /Claw no consulta Kaggle en tiempo real/i)
assert.match(internalAdmin, /ensayo joint validation=41,875%/)
assert.match(internalAdmin, /encoder_change reportados fueron 0\.0/)
assert.match(internalAdmin, /promoted=false/)
assert.doesNotMatch(internalAdmin, /V45C Scalable es el protocolo de escalamiento actualmente preparado/)

const external = await getEduAIPlatformKnowledgeContext(staleDb, "Datos del connectoma Male CNS de Janelia")
assert.match(external, /166\.700 neuronas/)
assert.match(external, /124,2 millones de contactos sinápticos/)
assert.doesNotMatch(external, /C0\.13/)
assert.doesNotMatch(external, /notebooks/)

const comparison = await getEduAIPlatformKnowledgeContext(staleDb, "Compara MaleCNS nuestro con Male CNS de Janelia", [], { allowInternalResearch: true })
assert.match(comparison, /PROYECTO PROPIO/)
assert.match(comparison, /FUENTE EXTERNA/)
assert.match(comparison, /C0\.13/)
assert.match(comparison, /166\.700/)
assert.ok(comparison.indexOf("PROYECTO PROPIO") < comparison.indexOf("FUENTE EXTERNA"))

const followUp = await getEduAIPlatformKnowledgeContext(staleDb, "Cuéntame más", [
  { role: "user", content: "Explícame MaleCNS de nuestro proyecto" },
  { role: "assistant", content: "MaleCNS es experimental." },
  { role: "user", content: "Cuéntame más" },
], { allowInternalResearch: true })
assert.match(followUp, /C0\.13/)

const neuronFollowUp = await getEduAIPlatformKnowledgeContext(staleDb, "¿Y cuántas neuronas activas tenemos?", [
  { role: "user", content: "¿Qué es MaleCNS de nuestro proyecto?" },
  { role: "assistant", content: "Es nuestro proyecto experimental." },
  { role: "user", content: "¿Y cuántas neuronas activas tenemos?" },
], { allowInternalResearch: true })
assert.match(neuronFollowUp, /8\.192 neuronas activas/)
assert.doesNotMatch(neuronFollowUp, /124,2 millones de contactos/)

assert.equal(getMaleCNSVerifiedContext("¿Cómo aprende una neurona?"), null)

console.log("[malecns-source-boundary] internal/external/compare, admin-gating, freshness, follow-up and stale-db bypass verified")

}

void main().catch(error => { console.error(error); process.exitCode = 1 })
