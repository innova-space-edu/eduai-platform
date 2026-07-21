import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const filePath = path.join(process.cwd(), "app", "traductor", "page.tsx")
let source = await readFile(filePath, "utf8")
const original = source

if (!source.includes('import MiraVoiceMode from "./MiraVoiceMode"')) {
  const importAnchor = 'import Link from "next/link"\n'
  if (!source.includes(importAnchor)) throw new Error("No se encontró el punto de importación del traductor.")
  source = source.replace(importAnchor, `${importAnchor}import MiraVoiceMode from "./MiraVoiceMode"\n`)
}

source = source
  .replaceAll("PolyAvatar", "MiraAvatar")
  .replace("// ─── Poly Avatar", "// ─── MIRA Avatar")
  .replace("Poly · Traductor", "MIRA · Traductor")
  .replace("Hola, soy Poly", "Hola, soy MIRA")

if (!source.includes("<MiraVoiceMode />")) {
  const renderAnchor = "      <style jsx global>{`"
  if (!source.includes(renderAnchor)) throw new Error("No se encontró el punto de montaje del modo voz.")
  source = source.replace(renderAnchor, `      <MiraVoiceMode />\n\n${renderAnchor}`)
}

if (source !== original) {
  await writeFile(filePath, source, "utf8")
  console.log("MIRA live voice aplicado al traductor.")
} else {
  console.log("MIRA live voice ya estaba aplicado.")
}
