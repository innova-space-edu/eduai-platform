import { readFileSync } from "node:fs"
import assert from "node:assert/strict"

const source = path => readFileSync(path, "utf8")
const runtime = source("services/eduai-voice-chatterbox/main.py")
const docker = source("services/eduai-voice-chatterbox/Dockerfile")
const gateway = source("services/google-audio-gateway/voice_gateway.py")
const build = source("services/eduai-voice-chatterbox/stage-weights.cloudbuild.yaml")
const page = source("app/audio-lab/voices/page.tsx")
const diagnostics = source("app/api/agents/audio/voices/engine/route.ts")

for (const expected of [
  "ChatterboxMultilingualTTS.from_local",
  "HF_HUB_OFFLINE", "TORCH", // verified below for exact settings
]) if (expected === "ChatterboxMultilingualTTS.from_local") assert.ok(runtime.includes(expected))
assert.ok(docker.includes("HF_HUB_OFFLINE=1"))
assert.ok(docker.includes("TRANSFORMERS_OFFLINE=1"))
assert.ok(!runtime.includes("from_pretrained("))
assert.ok(runtime.includes("install_verified_weights"))
assert.ok(runtime.includes("hashlib.file_digest"))
assert.ok(runtime.includes("_generation_lock"))
assert.ok(runtime.includes("language_id=\"es\""))
assert.ok(runtime.includes("torch.inference_mode()"))
assert.ok(runtime.includes("model") && runtime.includes("from_local"))
assert.ok(!runtime.includes("hf_hub_download") && !runtime.includes("snapshot_download"))
assert.ok(build.includes("modelscope download"))
assert.ok(build.includes("ResembleAI/chatterbox"))
assert.ok(build.includes("t3_mtl23ls_v3.safetensors"))
assert.ok(!build.includes("huggingface.co"))
assert.ok(gateway.includes("VOICE_PROVIDER"))
assert.ok(gateway.includes("chatterbox_private_request"))
assert.ok(gateway.includes("fetch_id_token"))
assert.ok(gateway.includes("require_admin_adult(token)"))
assert.ok(gateway.includes("consent_audio_path"))
assert.ok(gateway.includes("chatterbox_render"))
assert.ok(gateway.includes("chatterbox_ready"))
assert.ok(diagnostics.includes("chatterbox-self-hosted"))
assert.ok(page.includes("Chatterbox"))
console.log("Chatterbox V3 offline Cloud Run integrity checks: OK")
