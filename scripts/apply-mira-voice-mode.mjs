import { readFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()

async function requireText(filePath, needle, label) {
  const source = await readFile(path.join(root, filePath), "utf8")
  if (!source.includes(needle)) {
    throw new Error(`[mira-voice] Falta ${label} en ${filePath}: ${needle}`)
  }
}

await Promise.all([
  requireText("app/traductor/page.tsx", 'MiraVoicePopup', "popup compacto en Traductor"),
  requireText("app/traductor/page.tsx", 'MIRA · Traductor', "identidad MIRA en Traductor"),
  requireText("components/dashboard/ClawStudyConsole.tsx", 'onConversationTurn={sendVoiceConversation}', "voz conectada al chat del dashboard"),
  requireText("components/mira/MiraVoicePopup.tsx", 'MIRA · conversación en vivo', "ventana emergente de conversación"),
  requireText("app/api/agents/traductor/voice/route.ts", 'mode === "transcribe"', "modo de transcripción rápida"),
])

console.log("MIRA compact voice: Traductor + dashboard integrados y validados.")
