import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { allowAutomaticTextProvider, openRouterTextProviderOptions, resolveOpenRouterTextModel } from "../lib/ai/free-routing"
import { providerOrderFor } from "../lib/ai/capabilities"
import {
  compatibleFallbackModel,
  compatibleModelCandidates,
  hasCompatibleProvider,
  isCompatibleProviderId,
  parseStructuredJson,
} from "../lib/ai/providers/openai-compatible"

function withEnv(name: string, value: string | undefined, fn: () => void) {
  const previous = process.env[name]
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
  try {
    fn()
  } finally {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  }
}

function testFreeRouting() {
  withEnv("EDUAI_AI_ALLOW_PAID_TEXT_FALLBACKS", undefined, () => {
    assert.equal(resolveOpenRouterTextModel("openrouter/auto"), "openrouter/free")
    assert.equal(resolveOpenRouterTextModel("google/gemma-4-26b-a4b-it:free"), "google/gemma-4-26b-a4b-it:free")
    assert.deepEqual(openRouterTextProviderOptions().max_price, { prompt: 0, completion: 0 })
    assert.deepEqual(compatibleModelCandidates("openrouter", "text", "openai/gpt-4o"), ["openrouter/free"])
    assert.equal(allowAutomaticTextProvider("together"), false)
    assert.equal(allowAutomaticTextProvider("cerebras"), false)
    assert.equal(allowAutomaticTextProvider("sambanova"), false)
    assert.equal(allowAutomaticTextProvider("cloudflare"), true)
  })
  withEnv("EDUAI_AI_ALLOW_PAID_TEXT_FALLBACKS", "true", () => {
    assert.equal(resolveOpenRouterTextModel("openrouter/auto"), "openrouter/auto")
    assert.equal(openRouterTextProviderOptions().max_price, undefined)
    assert.equal(allowAutomaticTextProvider("together"), true)
  })
  withEnv("CLOUDFLARE_WORKERS_AI_API_TOKEN", "test-only", () => {
    withEnv("CLOUDFLARE_ACCOUNT_ID", "a".repeat(32), () => {
      withEnv("EDUAI_CLOUDFLARE_AI_ENABLED", undefined, () => assert.equal(hasCompatibleProvider("cloudflare"), false))
      withEnv("EDUAI_CLOUDFLARE_AI_ENABLED", "true", () => assert.equal(hasCompatibleProvider("cloudflare"), true))
    })
  })
  assert.equal(compatibleFallbackModel("cloudflare", "text"), "@cf/openai/gpt-oss-20b")
}
testFreeRouting()

function testProviderOrders() {
  assert.deepEqual(providerOrderFor("text"), ["google", "groq", "openrouter", "cloudflare", "cerebras", "together", "sambanova"])
  assert.deepEqual(providerOrderFor("structured"), ["google", "groq", "openrouter", "cloudflare", "cerebras", "together", "sambanova"])
  assert.deepEqual(providerOrderFor("long_context"), ["google", "groq", "together", "openrouter", "cloudflare", "cerebras", "sambanova"])
  assert.deepEqual(providerOrderFor("research"), ["google", "groq", "openrouter"])
  assert.deepEqual(providerOrderFor("code"), ["google", "groq", "cerebras", "openrouter", "cloudflare", "together", "sambanova"])
}

function testProviderGuards() {
  assert.equal(isCompatibleProviderId("groq"), true)
  assert.equal(isCompatibleProviderId("openrouter"), true)
  assert.equal(isCompatibleProviderId("together"), true)
  assert.equal(isCompatibleProviderId("cerebras"), true)
  assert.equal(isCompatibleProviderId("sambanova"), true)
  assert.equal(isCompatibleProviderId("google"), false)
  assert.equal(isCompatibleProviderId("local"), false)

  withEnv("CEREBRAS_API_KEY", "test-only", () => {
    assert.equal(hasCompatibleProvider("cerebras"), true)
  })
  withEnv("CEREBRAS_API_KEY", undefined, () => {
    assert.equal(hasCompatibleProvider("cerebras"), false)
  })
}

function testFallbackModels() {
  withEnv("GROQ_TEXT_MODEL", undefined, () => {
    assert.equal(compatibleFallbackModel("groq", "text"), "openai/gpt-oss-120b")
  })
  withEnv("GROQ_RESEARCH_MODEL", undefined, () => {
    assert.equal(compatibleFallbackModel("groq", "research"), "openai/gpt-oss-120b")
  })
  withEnv("OPENROUTER_TEXT_MODEL", undefined, () => {
    withEnv("OPENROUTER_STRUCTURED_MODEL", undefined, () => {
      assert.equal(compatibleFallbackModel("openrouter", "text"), "openrouter/free")
      assert.equal(compatibleFallbackModel("openrouter", "structured"), "openrouter/free")
    })
  })
  withEnv("TOGETHER_TEXT_MODEL", undefined, () => {
    assert.equal(compatibleFallbackModel("together", "text"), "Qwen/Qwen3.5-9B")
  })
  withEnv("CEREBRAS_TEXT_MODEL", undefined, () => {
    assert.equal(compatibleFallbackModel("cerebras", "text"), "gpt-oss-120b")
  })
  withEnv("SAMBANOVA_TEXT_MODEL", undefined, () => {
    assert.equal(compatibleFallbackModel("sambanova", "text"), "gpt-oss-120b")
  })
  withEnv("GROQ_TEXT_MODEL", undefined, () => {
    assert.deepEqual(
      compatibleModelCandidates("groq", "long_context", "llama-3.3-70b-versatile"),
      ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
    )
  })
}

function testRetiredModelEnvFallback() {
  withEnv("GROQ_TEXT_MODEL", "llama-3.3-70b-versatile", () => {
    assert.equal(compatibleFallbackModel("groq", "text"), "openai/gpt-oss-120b")
    assert.ok(!compatibleModelCandidates("groq", "text", "llama-3.3-70b-versatile").includes("llama-3.3-70b-versatile"))
  })
  withEnv("GROQ_RESEARCH_MODEL", "groq/compound", () => {
    assert.equal(compatibleFallbackModel("groq", "research"), "openai/gpt-oss-120b")
    assert.ok(!compatibleModelCandidates("groq", "research").includes("groq/compound"))
  })
}

function testStructuredParsing() {
  assert.deepEqual(parseStructuredJson<{ ok: boolean }>('{"ok":true}'), { ok: true })
  assert.deepEqual(parseStructuredJson<{ ok: boolean }>('```json\n{"ok":true}\n```'), { ok: true })
  assert.deepEqual(parseStructuredJson<{ value: number }>('Resultado: {"value":7} fin'), { value: 7 })
}

function testGatewayWiring() {
  const gatewayPath = path.join(process.cwd(), "lib", "ai", "gateway.ts")
  const source = fs.readFileSync(gatewayPath, "utf8")
  assert.ok(source.includes("generateCompatibleText"), "Gateway debe invocar adaptadores multiproveedor")
  assert.ok(source.includes("streamCompatibleText"), "Gateway debe mantener streaming real en fallbacks")
  assert.ok(source.includes("hasCompatibleProvider"), "Gateway debe saltar proveedores sin credenciales")
  assert.ok(source.includes("compatibleFallbackModel"), "Gateway debe resolver fallback por proveedor")
  assert.ok(source.includes("resolveProviderModel({"), "Gateway debe conservar el registro dinámico")
}

function testVertexWiring() {
  const googlePath = path.join(process.cwd(), "lib", "ai", "providers", "google.ts")
  const source = fs.readFileSync(googlePath, "utf8")
  assert.ok(source.includes('process.env.GOOGLE_GENAI_USE_VERTEX === "true"'), "Vertex debe estar detrás de feature flag")
  assert.ok(source.includes("vertexai: true"), "Google provider debe poder iniciar Vertex AI")
  assert.ok(source.includes("GOOGLE_CLOUD_PROJECT"), "Vertex debe exigir proyecto server-side")
  assert.ok(source.includes('kind === "text" && useVertexText()'), "Vertex debe limitarse a texto mientras image/video siguen estables")
}

function main() {
  testProviderOrders()
  testProviderGuards()
  testFallbackModels()
  testRetiredModelEnvFallback()
  testStructuredParsing()
  testGatewayWiring()
  testVertexWiring()
  console.log("✓ EduAI multiprovider tests OK")
}

main()
