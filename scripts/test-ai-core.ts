import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { generationFingerprint, stableJson } from "../lib/ai/fingerprint"
import { providerOrderFor } from "../lib/ai/capabilities"
import {
  decideCapability,
  deriveAccessProfileFromMetadata,
  deriveEffectiveStoredAccessProfile,
  unresolvedAccessProfile,
  type EduAIAccessProfile,
} from "../lib/ai/access-policy"
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

function testMetadataNormalizationOnly() {
  const minor = deriveAccessProfileFromMetadata({
    userId: "minor-metadata",
    metadata: {
      birth_date: "2012-01-15",
      account_type: "university_student",
    },
  })
  assert.ok(minor, "Una fecha válida en metadata debe poder normalizarse para provisión/UI")
  assert.equal(minor.ageBand, "under_18")
  assert.equal(minor.accessTier, "restricted")

  const adultTeacherMetadata = deriveAccessProfileFromMetadata({
    userId: "adult-metadata",
    metadata: {
      birth_date: "1990-05-20",
      account_type: "teacher",
    },
  })
  assert.ok(adultTeacherMetadata)
  assert.equal(adultTeacherMetadata.ageBand, "adult")
  assert.equal(
    adultTeacherMetadata.accessTier,
    "standard",
    "Metadata controlada por cliente no debe elevar una cuenta a teacher/researcher/admin",
  )

  const invalid = deriveAccessProfileFromMetadata({
    userId: "invalid-metadata",
    metadata: { birth_date: "2026-02-31", account_type: "teacher" },
  })
  assert.equal(invalid, null, "Fechas imposibles no deben normalizarse como perfil válido")
}

function testMissingProfileFailsClosed() {
  const unresolved = unresolvedAccessProfile("missing-profile")
  assert.equal(unresolved.ageBand, "unknown")
  assert.equal(unresolved.accessTier, "restricted")
  assert.equal(unresolved.hasExplicitAgeProfile, false)
  assert.equal(decideCapability(unresolved, "video", "google").allowed, false)
  assert.equal(decideCapability(unresolved, "text", "google").allowed, false)
  assert.equal(decideCapability(unresolved, "text", "local").allowed, true)

  const accessPolicyPath = path.join(process.cwd(), "lib", "ai", "access-policy.ts")
  const source = fs.readFileSync(accessPolicyPath, "utf8")
  const start = source.indexOf("export async function getEduAIAccessProfile")
  const end = source.indexOf("export function decideCapability", start)
  assert.ok(start >= 0 && end > start, "Debe existir getEduAIAccessProfile")
  const authorizationBlock = source.slice(start, end)
  assert.equal(
    authorizationBlock.includes("user_metadata"),
    false,
    "La autorización no debe derivarse desde user_metadata editable por el usuario",
  )
  assert.ok(
    authorizationBlock.includes("return unresolvedAccessProfile(userId)"),
    "La ausencia de perfil debe fallar cerrada",
  )
}

function testStoredAgeTransition() {
  const now = new Date("2026-08-17T12:00:00.000Z")

  const staleMinor = deriveEffectiveStoredAccessProfile({
    userId: "stale-minor",
    birthDate: "2010-08-18",
    ageBand: "adult",
    accountType: "other",
    accessTier: "standard",
    now,
  })
  assert.equal(staleMinor.ageBand, "under_18", "birth_date actual debe prevalecer sobre age_band obsoleto")
  assert.equal(staleMinor.accessTier, "restricted", "un menor nunca debe heredar un tier adulto obsoleto")

  const eighteenthBirthday = deriveEffectiveStoredAccessProfile({
    userId: "turning-18",
    birthDate: "2008-08-17",
    ageBand: "under_18",
    accountType: "university_student",
    accessTier: "restricted",
    now,
  })
  assert.equal(eighteenthBirthday.ageBand, "adult", "al cumplir 18 debe cambiar el tramo efectivo")
  assert.equal(eighteenthBirthday.accessTier, "standard", "la restricción causada por minoría debe expirar a los 18")

  const adultAdministrativeRestriction = deriveEffectiveStoredAccessProfile({
    userId: "adult-restricted",
    birthDate: "1990-05-20",
    ageBand: "adult",
    accountType: "other",
    accessTier: "restricted",
    now,
  })
  assert.equal(
    adultAdministrativeRestriction.accessTier,
    "restricted",
    "una restricción adulta no debe levantarse solo por recalcular edad",
  )

  const adultTeacher = deriveEffectiveStoredAccessProfile({
    userId: "adult-teacher",
    birthDate: "1985-03-10",
    ageBand: "adult",
    accountType: "teacher",
    accessTier: "teacher",
    now,
  })
  assert.equal(adultTeacher.accessTier, "teacher", "roles privilegiados válidos deben conservarse")
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
  testMetadataNormalizationOnly()
  testMissingProfileFailsClosed()
  testStoredAgeTransition()
  testStructuredObservability()
  await testModelRegistryFallback()
  console.log("✓ EduAI AI Core tests OK")
}

void main()
