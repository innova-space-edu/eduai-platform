import { readFileSync } from "node:fs"

function assert(condition, message) {
  if (!condition) throw new Error(`[test-claw-voice] ${message}`)
}

const claw = readFileSync("components/dashboard/ClawStudyConsole.tsx", "utf8")
const types = readFileSync("lib/audio/types.ts", "utf8")
const pipeline = readFileSync("lib/audio/pipeline.ts", "utf8")

assert(claw.includes("CLAW_SPANISH_VOICE_WAVEFORM_V1"), "falta el parche de voz en Claw")
assert(claw.includes('language: "es"'), "Claw debe forzar español para mensajes de voz")
assert(claw.includes("detectLanguage: false"), "el dictado corto no debe depender de autodetección de idioma")
assert(claw.includes("Transcribe fielmente este mensaje corto hablado en español de Chile"), "falta contexto de español chileno/latino")
assert(claw.includes("getByteTimeDomainData"), "la onda debe reaccionar al audio real del micrófono")
assert(claw.includes("setWaveform((current) => [...current.slice(1), level])"), "la onda debe desplazarse mientras se graba")
assert(claw.includes("onClick={cancelRecording}"), "falta cancelar grabación")
assert(claw.includes("onClick={confirmRecording}"), "falta confirmar grabación")
assert(claw.includes("Transcribiendo en español…"), "falta estado visible de transcripción")
assert(types.includes("language?:        string"), "el pipeline debe aceptar idioma")
assert(types.includes("transcriptionPrompt?: string"), "el pipeline debe aceptar contexto de transcripción")
assert(pipeline.includes('formData.append("language", options.language.slice(0, 8))'), "Whisper debe recibir el idioma")
assert(pipeline.includes('formData.append("prompt", options.transcriptionPrompt.slice(0, 900))'), "Whisper debe recibir el prompt de contexto")

console.log("[test-claw-voice] español fijo, Whisper y onda de grabación verificados")
