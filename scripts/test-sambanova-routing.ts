import assert from "node:assert/strict"
import { DEFAULT_PROVIDER_ORDER, providerOrderFor } from "../lib/ai/capabilities"
import {
  hasCompatibleProvider,
  compatibleModelCandidates,
  generateCompatibleText,
} from "../lib/ai/providers/openai-compatible"

async function main() {
  const oldEnv = {
    SAMBANOVA_API_KEY: process.env.SAMBANOVA_API_KEY,
    SAMBANOVA_API_KEY_MODEL_LAB: process.env.SAMBANOVA_API_KEY_MODEL_LAB,
    SAMBANOVA_API_KEY_CLAW: process.env.SAMBANOVA_API_KEY_CLAW,
    EDUAI_SAMBANOVA_ENABLED: process.env.EDUAI_SAMBANOVA_ENABLED,
  }
  const oldFetch = globalThis.fetch
  try {
    process.env.SAMBANOVA_API_KEY = "local-test-general"
    process.env.SAMBANOVA_API_KEY_MODEL_LAB = "local-test-lab"
    process.env.SAMBANOVA_API_KEY_CLAW = "local-test-claw"
    process.env.EDUAI_SAMBANOVA_ENABLED = "true"

    assert.equal(DEFAULT_PROVIDER_ORDER.text[0], "google")
    assert.equal(DEFAULT_PROVIDER_ORDER.structured[0], "google")
    assert.equal(DEFAULT_PROVIDER_ORDER.vision.includes("sambanova"), false)
    assert.ok(providerOrderFor("text").includes("sambanova"))
    assert.equal(hasCompatibleProvider("sambanova"), true)
    assert.equal(hasCompatibleProvider("sambanova", "model-lab"), true)
    assert.equal(compatibleModelCandidates("sambanova", "text", "DeepSeek-V3.2")[0], "DeepSeek-V3.2")

    const keys: string[] = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(url), "https://api.sambanova.ai/v1/chat/completions")
      const headers = init?.headers as Record<string, string>
      keys.push(headers.Authorization)
      const body = JSON.parse(String(init?.body)) as { model: string }
      assert.equal(body.model, "gpt-oss-120b")
      return Response.json({ model: body.model, choices: [{ message: { content: "EDUAI_OK" } }] })
    }) as typeof fetch

    const request = {
      provider: "sambanova" as const,
      model: "gpt-oss-120b",
      messages: [{ role: "user" as const, content: "test" }],
    }
    assert.equal((await generateCompatibleText({ ...request, module: "model-lab" })).text, "EDUAI_OK")
    assert.equal((await generateCompatibleText({ ...request, module: "claw-chat-stream" })).text, "EDUAI_OK")
    assert.equal((await generateCompatibleText({ ...request, module: "unknown-module" })).text, "EDUAI_OK")
    assert.deepEqual(keys, ["Bearer local-test-lab", "Bearer local-test-claw", "Bearer local-test-general"])

    process.env.EDUAI_SAMBANOVA_ENABLED = "false"
    assert.equal(hasCompatibleProvider("sambanova"), false)
    assert.equal(hasCompatibleProvider("sambanova", "model-lab"), false)
    console.log("SambaNova modular routing: OK")
  } finally {
    globalThis.fetch = oldFetch
    for (const [name, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}
void main()
