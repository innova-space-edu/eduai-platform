import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

const source = p => readFileSync(p,"utf8")
const server = source("lib/audio/voice-gpu-bridge.ts")
const ui = source("app/audio-lab/voices/VoiceGpuBridge.tsx")
const endpoint = source("app/api/agents/audio/voices/profiles/route.ts")
const sql = source("supabase/migrations/20261016211500_eduai_voice_worker_admin_verification.sql")

for(const name of [
  "validateVoiceSecuritySession","getAuthenticatorAssuranceLevel",
  'mfa?.currentLevel !== "aal2"','source_kind === "self"',
  "consent_confirmed","authorization_confirmed","consent_audio_path",
  "randomBytes(32)",'createHash("sha256")',
  "expires_at","SESSION_SECONDS","createSignedUrl(src,3600)",
  "createSignedUploadUrl(path)","audio_voice_render_jobs",
  'operation === "poll"','operation === "finish"',
  "eduai_voice_worker_claim","eduai_voice_worker_finish",
]) assert.ok(server.includes(name), "Missing secure GPU bridge: "+name)

for(const name of [
  'mode=compute','getVoiceGpuBridge(req)','postVoiceGpuBridge(req)'
]) assert.ok(endpoint.includes(name), "Must reuse existing Vercel Hobby function: "+name)
for(const name of ["Kaggle","Colab","pairing_code","navigator.clipboard",
  "Crear código de conexión","Generar audio","audio_url","MFA"])
  assert.ok(ui.includes(name), "UI missing "+name)
for(const name of ["extensions.digest","auth.users","public.admin_emails","pr.birth_date",
  "SKIP LOCKED","storage.objects","SECURITY DEFINER",
  "created_at>now()-interval '55 minutes'"])
  assert.ok(sql.includes(name), "SQL owner/worker guard missing "+name)
assert.ok(!server.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "Never send Supabase administrative credentials to notebooks")

for(const provider of ["kaggle","colab"]){
  const file="notebooks/eduai_chatterbox_"+provider+"_bridge.ipynb"
  const notebook=JSON.parse(source(file))
  assert.equal(notebook.nbformat,4)
  assert.equal(notebook.cells.length,5)
  const script=notebook.cells.map(cell=>cell.source.join("")).join("\n")
  for(const needed of [
    "ChatterboxMultilingualTTS", "from_local", "modelscope",
    "ResembleAI/chatterbox","t3_mtl23ls_v3.safetensors",
    "setuptools<81","getpass.getpass","EDUAI_PAIR_CODE",
    "cuda","requests.put","audio_prompt_path","language_id=",
    "PerthImplicitWatermarker","torch==2.6.0",
  ]) assert.ok(script.includes(needed),provider+" missing "+needed)
  assert.ok(!script.includes("SUPABASE_SERVICE_ROLE_KEY") && !script.includes("ngrok") &&
    !script.includes("cloudflared") && !script.includes("huggingface.co"),
    "No permanent credentials, public tunnels or HF inference")
  for(const cell of notebook.cells.filter(cell=>cell.cell_type==="code")){
    assert.equal(cell.outputs.length,0)
    const py=cell.source.join("")
    const compilation=spawnSync("python",["-c","import sys; compile(sys.stdin.read(),'<cell>','exec')"],
       {input:py,encoding:"utf8"})
    assert.equal(compilation.status,0,provider+" notebook syntax: "+compilation.stderr)
    if(py.startsWith("WORKER_CODE = ")){
      const worker=JSON.parse(py.slice("WORKER_CODE = ".length).trim().replace(/\nprint\([^\n]*\)\s*$/,""))
      const check=spawnSync("python",["-c","import sys; compile(sys.stdin.read(),'<worker>','exec')"],
        {input:worker,encoding:"utf8"})
      assert.equal(check.status,0,provider+" worker syntax: "+check.stderr)
    }
  }
}
console.log("EDUAI Kaggle/Colab private voice GPU bridge security and syntax: OK")
