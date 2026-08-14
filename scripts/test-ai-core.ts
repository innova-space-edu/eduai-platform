import assert from "node:assert/strict"
import { generationFingerprint, stableJson } from "../lib/ai/fingerprint"
import { providerOrderFor } from "../lib/ai/capabilities"
import { decideCapability, type EduAIAccessProfile } from "../lib/ai/access-policy"

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

function testAccessPolicy() {
  const adult: EduAIAccessProfile = {
    userId: "adult",
    ageBand: "adult",
    accountType: "teacher",
    accessTier: "teacher",
    hasExplicitAgeProfile: true,
  }
  const minor: EduAIAccessProfile = {
    userId: "minor",
    ageBand: "under_18",
    accountType: "other",
    accessTier: "restricted",
    hasExplicitAgeProfile: true,
  }

  assert.equal(decideCapability(adult, "video", "google").allowed, true)
  assert.equal(decideCapability(adult, "research", "google").allowed, true)
  assert.equal(decideCapability(minor, "video", "google").allowed, false)
  assert.equal(decideCapability(minor, "image", "google").allowed, false)
  assert.equal(decideCapability(minor, "text", "local").allowed, true)
  assert.equal(decideCapability(minor, "text", "google").allowed, false)
}

function main() {
  testStableJson()
  testFingerprintDeterminism()
  testProviderOrder()
  testAccessPolicy()
  console.log("✓ EduAI AI Core tests OK")
}

main()