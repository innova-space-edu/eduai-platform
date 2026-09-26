import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
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

function testProviderOrders() {
  assert.deepEqual(providerOrderFor("text"), ["google", "groq", "cerebras", "openrouter", "together"])
  assert.deepEqual(providerOrderFor("structured"), ["google", "groq", "cerebras", "openrouter", "together"])
  assert.deepEqual(providerOrderFor("long_context"), ["google", "groq", "cerebras", "openrouter", "together"])
  assert.deepEqual(providerOrderFor("research"), ["google", "groq", "cerebras", "openrouter"])
  assert.deepEqual(providerOrderFor("code"), ["google", "groq", "cerebras", "openrouter", "together"])
}

function testProviderGuards() {
  assert.equal(isCompatibleProviderId("groq"), true)
  assert.equal(isCompatibleProviderId("openrouter"), true)
  assert.equal(isCompatibleProviderId("together"), true)
  assert.equal(isCompatibleProviderId("cerebras"), true)
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
    withEnv("GROQ_TEXT_MODEL_FAST", undefined, () => {
      withEnv("GROQ_TEXT_MODEL_REASONING", undefined, () => {
        assert.equal(compatibleFallbackModel("groq", "text", "fast"), "openai/gpt-oss-20b")
        assert.equal(compatibleFallbackModel("groq", "text", "quality"), "openai/gpt-oss-120b")
      })
    })
  })
  withEnv("GROQ_RESEARCH_MODEL", undefined, () => {
    assert.equal(compatibleFallbackModel("groq", "research"), "groq/compound")
  })
  withEnv("OPENROUTER_FREE_ONLY", undefined, () => {
    withEnv("OPENROUTER_TEXT_MODEL", undefined, () => {
      withEnv("OPENROUTER_STRUCTURED_MODEL", undefined, () => {
        assert.equal(compatibleFallbackModel("openrouter", "text"), "openrouter/free")
        assert.equal(compatibleFallbackModel("openrouter", "structured"), "openrouter/free")
      })
    })
    withEnv("OPENROUTER_TEXT_MODEL", "openrouter/auto", () => {
      assert.equal(compatibleFallbackModel("openrouter", "text"), "openrouter/free")
      assert.deepEqual(
        compatibleModelCandidates("openrouter", "text", "openrouter/auto"),
        ["openrouter/free"],
      )
    })
  })
  withEnv("TOGETHER_TEXT_MODEL", undefined, () => {
    assert.equal(compatibleFallbackModel("together", "text"), "Qwen/Qwen3.5-9B")
  })
  withEnv("CEREBRAS_TEXT_MODEL", undefined, () => {
    assert.equal(compatibleFallbackModel("cerebras", "text"), "gpt-oss-120b")
  })
  withEnv("GROQ_TEXT_MODEL", undefined, () => {
    withEnv("GROQ_TEXT_MODEL_FAST", undefined, () => {
      withEnv("GROQ_TEXT_MODEL_REASONING", undefined, () => {
        assert.deepEqual(
          compatibleModelCandidates("groq", "long_context", "llama-3.3-70b-versatile", "quality"),
          ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"],
        )
        assert.deepEqual(
          compatibleModelCandidates("groq", "text", "llama-3.3-70b-versatile", "fast"),
          ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.6-27b"],
        )
      })
    })
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
  assert.ok(source.includes("fallbackProfile"), "Gateway debe distinguir perfiles rápidos y de calidad")
  assert.ok(source.includes("resolveProviderModel({"), "Gateway debe conservar el registro dinámico")
}

function testModuleFallbackWiring() {
  const chat = fs.readFileSync(path.join(process.cwd(), "app", "api", "agents", "chat", "route.ts"), "utf8")
  const mira = fs.readFileSync(path.join(process.cwd(), "app", "api", "agents", "mira", "route.ts"), "utf8")
  const math = fs.readFileSync(path.join(process.cwd(), "app", "api", "agents", "matematico", "route.ts"), "utf8")

  assert.ok(chat.includes('fallbackProfile: "fast"'), "Chat debe usar GPT-OSS 20B como fallback rápido")
  assert.ok(!chat.includes('preferredProvider: "groq"'), "Chat no debe anular el fallback global")
  assert.ok(mira.includes('fallbackProfile: "fast"'), "MIRA debe usar fallback rápido")
  assert.ok(!math.includes('preferredProvider: "google"'), "Matemático debe poder caer a proveedores alternativos")
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
  testStructuredParsing()
  testGatewayWiring()
  testModuleFallbackWiring()
  testVertexWiring()
  console.log("✓ EduAI multiprovider tests OK")
}

main()
