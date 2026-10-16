import assert from "node:assert/strict"
import { zipSync } from "fflate"
import { prepareKaggleVoiceUpload } from "../lib/audio/kaggle-zip"

async function run() {
  // Synthetic PCM WAV; never commit user voice samples into the repository.
  const data = new Uint8Array(44 + 16000)
  const view = new DataView(data.buffer)
  for (const [p, text] of [[0, "RIFF"], [8, "WAVE"], [12, "fmt "], [36, "data"]] as const) {
    for (let i = 0; i < text.length; i++) data[p + i] = text.charCodeAt(i)
  }
  view.setUint32(4, data.byteLength - 8, true)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 24000, true)
  view.setUint32(28, 48000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  view.setUint32(40, 16000, true)

  const wav = new File([data], "voz.wav", { type: "audio/wav" })
  const raw = await prepareKaggleVoiceUpload(wav)
  assert.equal(raw, wav)
  const zipped = zipSync({ "eduai_voz_kaggle.wav": data })
  const out = await prepareKaggleVoiceUpload(new File([zipped], "eduai_mi_voz.zip", { type: "application/zip" }))
  assert.equal(out.name, "eduai_voz_kaggle.wav")
  assert.deepEqual(new Uint8Array(await out.arrayBuffer()), data)
  await assert.rejects(
    prepareKaggleVoiceUpload(new File([zipSync({ "voz-1.wav": data, "voz-2.wav": data })], "dos.zip")),
    /único archivo WAV/
  )
  await assert.rejects(
    prepareKaggleVoiceUpload(new File([zipSync({ "folder/voz.wav": data })], "ruta.zip")),
    /carpeta raíz/
  )
  await assert.rejects(
    prepareKaggleVoiceUpload(new File([zipSync({ "nota.txt": new TextEncoder().encode("hola") })], "vacío.zip")),
    /único archivo WAV/
  )
  console.log("EDUAI Kaggle secure ZIP/WAV import regression: OK")
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
