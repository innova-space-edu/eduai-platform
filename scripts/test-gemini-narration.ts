import assert from "node:assert/strict"
import { buildGeminiTtsRequest, generateGeminiNarration, GeminiTtsError } from "../lib/audio/gemini-narration"

async function main() {
const narr = [{ speaker: "A" as const, text: "Hola, este es un audio educativo." }]
const one = buildGeminiTtsRequest(narr, "narration", "es-CL-LorenzoNeural", "es-ES-ElviraNeural")
assert.equal(one.generationConfig.responseModalities[0], "AUDIO")
assert.equal("multiSpeakerVoiceConfig" in one.generationConfig.speechConfig, false)
assert.equal(one.contents[0].parts[0].text, narr[0].text)
const both = buildGeminiTtsRequest([
  ...narr,
  { speaker: "B", text: "Y esta es la segunda voz." },
], "dialogue", "es-ES-AlvaroNeural", "es-CL-CatalinaNeural")
assert.equal(both.contents[0].parts[1].speech_metadata.speaker, "B")
assert.equal((both.generationConfig.speechConfig as {multiSpeakerVoiceConfig: {speakerVoiceConfigs: unknown[]}}).multiSpeakerVoiceConfig.speakerVoiceConfigs.length, 2)

// Simulador de Google (sin enviar textos ni claves a un proveedor externo).
const originalFetch = globalThis.fetch
const audio = Buffer.alloc(160)
audio.write("RIFF", 0, "ascii")
audio.write("WAVE", 8, "ascii")
let sent: any
globalThis.fetch = async (_url, options) => {
  sent = JSON.parse(String(options?.body))
  return Response.json({
    candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/wav", data: audio.toString("base64") } }] } }],
  })
}
try {
  const result = await generateGeminiNarration(narr, "narration", "es-CL-LorenzoNeural", "", "fake-key")
  assert.equal(result.mime, "audio/wav")
  assert.equal(result.audio.byteLength, 160)
  assert.equal(sent.generationConfig.speechConfig.voiceConfig.voice, "Puck")
  assert.equal(sent.contents[0].parts[0].text, narr[0].text)

  globalThis.fetch = async () => Response.json({ error: { code: 403 } }, { status: 403 })
  await assert.rejects(
    () => generateGeminiNarration(narr, "narration", "es-CL-LorenzoNeural", "", "fake-key"),
    (err: unknown) => err instanceof GeminiTtsError && err.message.includes("no autorizó"),
  )
  globalThis.fetch = async () => Response.json({ candidates: [] })
  await assert.rejects(
    () => generateGeminiNarration(narr, "narration", "es-CL-LorenzoNeural", "", "fake-key"),
    (err: unknown) => err instanceof GeminiTtsError && err.message.includes("sin audio"),
  )
} finally {
  globalThis.fetch = originalFetch
}
console.log("Audio Lab Gemini TTS request, accents, dialogue and WAV regression: OK")

}

void main().catch((error) => { console.error(error); process.exitCode = 1 })
