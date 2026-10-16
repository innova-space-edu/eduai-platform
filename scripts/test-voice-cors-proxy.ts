import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { audioEngineRequest, EDUAI_AUDIO_ENGINE_URL } from "../lib/audio/cloud-run-client"

for (const [path, action] of [
  ["/v1/voice/prepare", "prepare"],
  ["/v1/voice/render", "render"],
  ["/v1/voice/delete", "delete"],
]) {
  const { url, init } = audioEngineRequest(path, "sample-secret-must-not-leak", {
    profile_id: "00000000-0000-4000-8000-000000000001",
  }, action !== "delete")
  assert.equal(url, "/api/agents/audio/voices/gateway")
  assert.equal((init.headers as Record<string, string>).Authorization, undefined, "Client must not send bearer tokens to the voice relay")
  assert.equal((init.headers as Record<string, string>)["Content-Type"], "application/json")
  assert.equal(JSON.parse(init.body).action, action)
  assert.equal(init.credentials, "same-origin")
}
const song = audioEngineRequest("/v1/song/run", "sample-token", { job_id: "abcde12345" }, true)
assert.equal(song.url, EDUAI_AUDIO_ENGINE_URL + "/v1/song/run")
assert.equal((song.init.headers as Record<string, string>).Authorization, "Bearer sample-token")
const code = readFileSync("app/api/agents/audio/voices/gateway/route.ts", "utf8")
for (const requirement of [
  "validateVoiceSecuritySession", "getAuthenticatorAssuranceLevel", "currentLevel",
  '.eq("user_id", user.id)', "consent_audio_path", "consent_confirmed",
  "authorization_confirmed", "getSession()", "ACTIONS[action]", "upstream.body",
  "text/event-stream", 'request.headers.get("origin")',
]) {
  assert.ok(code.includes(requirement), "Voice relay missing: " + requirement)
}
assert.ok(!code.includes("process.env.SUPABASE_SERVICE_ROLE_KEY"), "Never use service-role bypass for voice actions")
console.log("Voice relay CORS, ownership and protected auth regression: OK")
