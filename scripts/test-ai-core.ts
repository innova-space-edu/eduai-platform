import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { generationFingerprint, stableJson } from "../lib/ai/fingerprint"
import { providerOrderFor } from "../lib/ai/capabilities"
import { decideCapability, type EduAIAccessProfile } from "../lib/ai/access-policy"
import { resolveProviderModel } from "../lib/ai/model-registry"

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

function testStructuredObservability() {
  const gatewayPath = path.join(process.cwd(), "lib", "ai", "gateway.ts")
  const gateway = fs.readFileSync(gatewayPath, "utf8")
  const start = gateway.indexOf("export async function runAIStructured")
  const end = gateway.indexOf("export async function streamAIText", start)
  assert.ok(start >= 0 && end > start, "Debe existir el bloque runAIStructured")

  const structured = gateway.slice(start, end)
  assert.ok(structured.includes("recordGenerationStart({"), "Structured debe registrar cada solicitud")
  assert.ok(structured.includes('status: "reused"'), "Structured debe registrar generaciones evitadas")
  assert.ok(structured.includes('status: "completed"'), "Structured debe registrar generaciones reales")
  assert.ok(structured.includes('status: "failed"'), "Structured debe registrar fallos")
  assert.ok(structured.includes("generationAvoided: true"), "Structured debe marcar ahorro por reutilización")
}

async function testModelRegistryFallback() {
  const resolved = await resolveProviderModel({
    provider: "google",
    capability: "image",
    fallbackModel: "fallback-image-model",
  })
  assert.equal(resolved.model, "fallback-image-model")
  assert.equal(resolved.source, "fallback")

  const gatewayPath = path.join(process.cwd(), "lib", "ai", "gateway.ts")
  const gateway = fs.readFileSync(gatewayPath, "utf8")
  assert.ok(gateway.includes("resolveProviderModel({"), "Gateway debe consultar el registro dinámico")
  assert.ok(gateway.includes("model: selected.model"), "Gateway debe pasar el modelo resuelto al proveedor")
}

async function main() {
  testStableJson()
  testFingerprintDeterminism()
  testProviderOrder()
  testAccessPolicy()
  testStructuredObservability()
  await testModelRegistryFallback()
  console.log("✓ EduAI AI Core tests OK")
}

void main()