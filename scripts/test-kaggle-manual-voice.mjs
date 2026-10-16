import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const notebook = JSON.parse(readFileSync("notebooks/eduai_chatterbox_kaggle.ipynb", "utf8"))
assert.equal(notebook.nbformat, 4)
assert.ok(Array.isArray(notebook.cells) && notebook.cells.length >= 7)
const text = notebook.cells.map((c) => c.source.join("")).join("\n")
for (const required of [
  "torch.cuda.is_available", "ChatterboxMultilingualTTS.from_local",
  't3_model="v3"', "modelscope", "ResembleAI/chatterbox",
  "language_id=\"es\"", "TEXTO", "eduai_voz_kaggle.wav", "FileUpload",
  "reference.unlink", "HF_HUB_OFFLINE",
]) assert.ok(text.includes(required), "Notebook missing: " + required)
assert.ok(!text.includes("from_pretrained("), "Do not pull model checkpoints from Hugging Face")
assert.ok(!text.includes("ngrok") && !text.includes("cloudflared"), "Do not expose public tunnels from Kaggle")
assert.ok(!text.includes("SUPABASE_SERVICE_ROLE_KEY") && !text.includes("SUPABASE_ANON_KEY"), "No user credentials in notebook")
assert.ok(notebook.cells.every(c => c.cell_type !== "code" || (c.execution_count == null && c.outputs.length === 0)),
  "Never commit executed voice data to Git")

const route = readFileSync("app/api/agents/audio/voices/kaggle-import/route.ts", "utf8")
for (const required of [
  "validateVoiceSecuritySession", "getAuthenticatorAssuranceLevel",
  'currentLevel !== "aal2"', '.eq("user_id", ctx.user.id)',
  "consent_audio_path", "consent_confirmed", "authorization_confirmed",
  "8 * 1024 * 1024", 'status: "completed"', 'provider: "kaggle-manual"',
  'audio_bucket: BUCKET', 'Cache-Control', 'audio_voice_render_jobs',
]) assert.ok(route.includes(required), "Import endpoint missing " + required)
assert.ok(!route.includes("status: \"ready\""), "Do not alter cloned profile state")
const page = readFileSync("app/audio-lab/voices/page.tsx", "utf8")
assert.ok(page.includes("KAGGLE_START_URL"))
assert.ok(page.includes("kaggleNotebookUrl"))
assert.ok(page.includes('target="_blank" rel="noopener noreferrer"'))
assert.ok(page.includes("Importar WAV de Kaggle"))
assert.ok(page.includes("Guard") && page.includes("Kaggle"))
console.log("EDUAI Kaggle manual GPU notebook / private import security validation: OK")
