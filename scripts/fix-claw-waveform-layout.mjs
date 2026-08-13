import { readFileSync, writeFileSync } from "node:fs"

const path = "components/dashboard/ClawStudyConsole.tsx"
let source = readFileSync(path, "utf8")

const broken = `              )}\n\n            <button\n              type="button"\n              onClick={() => send()}`
const fixed = `              )}\n            </div>\n\n            <button\n              type="button"\n              onClick={() => send()}`

if (source.includes(broken)) {
  source = source.replace(broken, fixed)
  writeFileSync(path, source)
  console.log("[claw-voice-layout] contenedor de controles cerrado correctamente")
} else if (source.includes(fixed)) {
  console.log("[claw-voice-layout] estructura ya corregida")
} else {
  throw new Error("[claw-voice-layout] no se encontró el bloque de controles de voz")
}
