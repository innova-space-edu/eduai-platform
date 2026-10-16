import fs from "node:fs"
import assert from "node:assert/strict"

const read = (name) => fs.readFileSync(name, "utf8")
const security = read("lib/audio/voice-security.ts")
const securityApi = read("app/api/agents/audio/voices/security/route.ts")
const terms = read("app/api/agents/audio/voices/terms/route.ts")
const profiles = read("app/api/agents/audio/voices/profiles/route.ts")
const gateway = read("services/google-audio-gateway/voice_gateway.py")
const gatewayApp = read("services/google-audio-gateway/main.py")
const ui = read("app/audio-lab/voices/page.tsx")
const check = read("app/api/agents/audio/voices/engine/route.ts")

for (const token of ['rpc("is_admin")','rpc("is_adult_profile")']) {
  assert.ok(security.includes(token), "Missing server-side admin/adult verification: " + token)
}
assert.ok(security.includes("const eligibility = await checkVoiceAdminEligibility(supabase)"))
assert.ok(securityApi.includes("checkVoiceAdminEligibility(supabase, false)"))
assert.ok(securityApi.includes("checkVoiceAdminEligibility(supabase)"))
assert.ok(terms.includes("checkVoiceAdminEligibility(supabase, false)"))
assert.ok(profiles.includes("validateVoiceSecuritySession"))
assert.ok(gateway.includes("async def require_admin_adult("))
for (const operation of ["prepare_voice","render_voice","delete_voice"]) {
  const tail = gateway.split("async def " + operation + "(")[1]
  assert.ok(tail?.slice(0, 280).includes("require_admin_adult(token)"), "Unprotected Cloud Run endpoint: " + operation)
}
assert.ok(gateway.includes('claims.get("aal") != "aal2"'))
assert.ok(gateway.includes('not profile.get("consent_confirmed")'))
assert.ok(gatewayApp.includes("https://eduai.innova-space-edu.cl"))
assert.ok(ui.includes("sin Hugging Face"))
assert.ok(ui.includes("sin consentimiento"))
assert.ok(check.includes("validateVoiceSecuritySession"))
assert.ok(check.includes("/diagnostics/voice"))
assert.ok(!gateway.includes("huggingface.co") && !gateway.includes("hf.co"))
console.log("EDUAI: admin-only adult voice replication / no HF integrity: OK")
