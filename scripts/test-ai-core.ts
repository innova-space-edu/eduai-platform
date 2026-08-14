import assert from "node:assert/strict"
import { generationFingerprint, stableJson } from "../lib/ai/fingerprint"
import { providerOrderFor } from "../lib/ai/capabilities"

function testStableJson() {
  const a = stableJson({ b: 2, a: "  hola   mundo ", nested: { z: true, a: 1 } })
  const b = stableJson({ nested: { a: 1, z: true }, a: "hola mundo", b: 2 })
  assert.equal(a, b, "stableJson debe ignorar el orden de las claves y normalizar espacios")
}

function testFingerprintDeterminism() {
  const one = generationFingerprint({
    capability: "image",
    scopeKey: "user-1",
    payload: { prompt: "Sistema solar", width: 1024, height: 768, style: "educational" },
  })

  const two = generationFingerprint({
    capability: "image",
    scopeKey: "user-1",
    payload: { style: "educational", height: 768, prompt: " Sistema   solar ", width: 1024 },
  })

  const otherUser = generationFingerprint({
    capability: "image",
    scopeKey: "user-2",
    payload: { prompt: "Sistema solar", width: 1024, height: 768, style: "educational" },
  })

  assert.equal(one, two, "Solicitudes equivalentes deben reutilizar el mismo fingerprint")
  assert.notEqual(one, otherUser, "El scope privado debe impedir cache cruzado entre usuarios")
  assert.match(one, /^[a-f0-9]{64}$/)
}

function testProviderOrder() {
  assert.deepEqual(providerOrderFor("image"), ["google", "openrouter", "together"])
  assert.deepEqual(
    providerOrderFor("text", "groq,google,groq,INVALID"),
    ["groq", "google"],
    "El override debe filtrar proveedores inválidos y eliminar duplicados"
  )
}

function main() {
  testStableJson()
  testFingerprintDeterminism()
  testProviderOrder()
  console.log("✓ EduAI AI Core tests OK")
}

main()
