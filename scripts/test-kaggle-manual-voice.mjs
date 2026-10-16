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
assert.ok(text.includes('socket.getaddrinfo("pypi.org"'), "Must verify DNS before pip")
assert.ok(text.includes("Turn on internet"), "Must explain Kaggle Internet switch")
assert.ok(text.includes("https://www.kaggle.com/settings"), "Provide account verification support")
for (const pin of ['"torch==2.6.0"', '"torchvision==0.21.0"', '"torchaudio==2.6.0"', '"--index-url"', 'download.pytorch.org/whl/cu126']) {
  assert.ok(text.includes(pin), "Pytorch CUDA compatibility pin missing: "+pin)
}
assert.ok(text.includes("subprocess.run([sys.executable, \"-c\", verify]"), "Verify torch and torchaudio from clean process")
assert.ok(text.includes('run_pip("setuptools<81")'), "Perth pkg_resources compatibility pin required")
assert.ok(text.includes("perth.PerthImplicitWatermarker is not None"), "Do not accept missing Perth watermarker")
assert.ok(text.includes("perth.PerthImplicitWatermarker()"), "Exercise the real Perth watermark constructor")
assert.ok(!text.includes("DummyWatermarker"), "Do not disable the output watermark")

assert.ok(text.includes('"--no-deps", source'), "Prevent Chatterbox V3 git from overriding CUDA torch")

assert.ok(text.indexOf("getaddrinfo") < text.indexOf("chatterbox-tts==0.1.7"), "DNS check must run before pip")
assert.ok(!text.includes("from_pretrained("), "Do not pull model checkpoints from Hugging Face")
assert.ok(!text.includes("ngrok") && !text.includes("cloudflared"), "Do not expose public tunnels from Kaggle")
assert.ok(!text.includes("SUPABASE_SERVICE_ROLE_KEY") && !text.includes("SUPABASE_ANON_KEY"), "No user credentials in notebook")
assert.ok(notebook.cells.every(c => c.cell_type !== "code" || (c.execution_count == null && c.outputs.length === 0)),
  "Never commit executed voice data to Git")

const route = readFileSync("lib/audio/kaggle-voice-import.ts", "utf8")
for (const required of [
  "validateVoiceSecuritySession", "getAuthenticatorAssuranceLevel",
  'currentLevel !== "aal2"', '.eq("user_id", ctx.user.id)',
  "consent_audio_path", "consent_confirmed", "authorization_confirmed",
  "8 * 1024 * 1024", 'status: "completed"', 'provider: "kaggle-manual"',
  'audio_bucket: BUCKET', 'Cache-Control', 'audio_voice_render_jobs',
]) assert.ok(route.includes(required), "Import endpoint missing " + required)
assert.ok(!route.includes("status: \"ready\""), "Do not alter cloned profile state")
const profiles = readFileSync("app/api/agents/audio/voices/profiles/route.ts", "utf8")
assert.ok(profiles.includes('searchParams.get("mode") === "kaggle"'))
assert.ok(profiles.includes("importKaggleWav(req)") && profiles.includes("listKaggleWavs()"))
const page = readFileSync("app/audio-lab/voices/page.tsx", "utf8")
assert.ok(page.includes("KAGGLE_START_URL"))
assert.ok(page.includes("/api/agents/audio/voices/profiles?mode=kaggle"))
assert.ok(page.includes("kaggleNotebookUrl"))
assert.ok(page.includes('target="_blank" rel="noopener noreferrer"'))
assert.ok(page.includes("Importar WAV de Kaggle"))
assert.ok(page.includes("Guard") && page.includes("Kaggle"))
console.log("EDUAI Kaggle manual GPU notebook / private import security validation: OK")
