import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

async function patchTranslatorPage() {
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

  if (source !== original) await writeFile(filePath, source, "utf8")
  return source !== original
}

async function patchVoiceComponent() {
  const filePath = path.join(process.cwd(), "app", "traductor", "MiraVoiceMode.tsx")
  let source = await readFile(filePath, "utf8")
  const original = source

  source = source.replace("bg-slate-950/94", "bg-slate-950/[0.94]")

  const successAnchor = '      if (!response.ok) throw new Error(data.error || "No se pudo traducir el audio.")\n\n      const nextTurn: VoiceTurn = {'
  if (!source.includes("if (!openRef.current) return\n\n      const nextTurn: VoiceTurn")) {
    if (!source.includes(successAnchor)) throw new Error("No se encontró el control de respuesta del modo voz.")
    source = source.replace(
      successAnchor,
      '      if (!response.ok) throw new Error(data.error || "No se pudo traducir el audio.")\n      if (!openRef.current) return\n\n      const nextTurn: VoiceTurn = {',
    )
  }

  const errorAnchor = '    } catch (cause) {\n      setError(cause instanceof Error ? cause.message : "No se pudo procesar la conversación.")'
  if (!source.includes('    } catch (cause) {\n      if (!openRef.current) return\n      setError(cause instanceof Error ? cause.message : "No se pudo procesar la conversación.")')) {
    if (!source.includes(errorAnchor)) throw new Error("No se encontró el manejo de errores del modo voz.")
    source = source.replace(
      errorAnchor,
      '    } catch (cause) {\n      if (!openRef.current) return\n      setError(cause instanceof Error ? cause.message : "No se pudo procesar la conversación.")',
    )
  }

  if (source !== original) await writeFile(filePath, source, "utf8")
  return source !== original
}

async function patchAgentCard() {
  const filePath = path.join(process.cwd(), "app", "agentes", "page.tsx")
  let source = await readFile(filePath, "utf8")
  const original = source

  const miraCard = `  {
    id: "mira",
    icon: "✨",
    name: "MIRA",
    description: "Asistente general de EduAI para conversar, organizar, explicar y encontrar la herramienta adecuada.",
    color: "from-violet-500 to-cyan-500",
    glow: "rgba(34,211,238,0.14)",
    border: "rgba(139,92,246,0.24)",
    href: "/mira",
    tag: "General",
    status: "active",
    ctaLabel: "Hablar con MIRA",
  },
`

  if (!source.includes('id: "mira"')) {
    const traductorAnchor = `  {
    id: "traductor",`
    if (!source.includes(traductorAnchor)) throw new Error("No se encontró la tarjeta Traductor para insertar MIRA.")
    source = source.replace(traductorAnchor, `${miraCard}${traductorAnchor}`)
  }

  source = source.replace(
    'description: "Traducción con explicación lingüística y cultural",',
    'description: "Traducción de textos, documentos y conversación de voz en vivo con MIRA",',
  )

  if (source !== original) await writeFile(filePath, source, "utf8")
  return source !== original
}

const changed = await Promise.all([
  patchTranslatorPage(),
  patchVoiceComponent(),
  patchAgentCard(),
])

console.log(changed.some(Boolean)
  ? "MIRA general + live voice integradas en EduAI."
  : "MIRA general + live voice ya estaban integradas.")
