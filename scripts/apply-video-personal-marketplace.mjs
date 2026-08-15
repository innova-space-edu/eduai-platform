import fs from "node:fs"
import path from "node:path"

const target = path.join(process.cwd(), "components/video/VideoStudioClient.tsx")
if (!fs.existsSync(target)) throw new Error("[video-personal-marketplace] VideoStudioClient no encontrado")

let source = fs.readFileSync(target, "utf8")
let changed = false

if (!source.includes('import PersonalAIMarketplace from "@/components/video/PersonalAIMarketplace"')) {
  const marker = 'import { useCallback, useEffect, useMemo, useRef, useState } from "react"\n'
  if (!source.includes(marker)) throw new Error("[video-personal-marketplace] import marker no encontrado")
  source = source.replace(marker, marker + 'import PersonalAIMarketplace from "@/components/video/PersonalAIMarketplace"\n')
  changed = true
}

if (!source.includes("<PersonalAIMarketplace")) {
  const descriptions = [
    "Genera videos con cola de trabajos. EduAI reutiliza primero y selecciona proveedor automáticamente priorizando ahorro.",
    "Genera videos con cola de trabajos. Modo actual: texto a video e imagen a video.",
  ]
  const text = descriptions.find(value => source.includes(value))
  if (!text) throw new Error("[video-personal-marketplace] encabezado de Video Studio no encontrado")
  const textIndex = source.indexOf(text)
  const paragraphEnd = source.indexOf("</p>", textIndex)
  if (paragraphEnd < 0) throw new Error("[video-personal-marketplace] cierre de descripción no encontrado")
  const insertion = `\n          <div className="mt-2 flex flex-wrap items-center gap-3">\n            <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-200">Automático · ahorro primero</span>\n            <PersonalAIMarketplace\n              prompt={prompt}\n              style={style}\n              duration={duration}\n              withAudio={withAudio}\n              mode={mode}\n              imageUrl={imageUrl}\n            />\n          </div>`
  source = source.slice(0, paragraphEnd + 4) + insertion + source.slice(paragraphEnd + 4)
  changed = true
}

if (changed) {
  fs.writeFileSync(target, source)
  console.log("[video-personal-marketplace] Premium Personal integrado en Video Studio")
} else {
  console.log("[video-personal-marketplace] ya aplicado")
}
