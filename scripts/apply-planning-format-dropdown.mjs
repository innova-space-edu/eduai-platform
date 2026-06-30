import fs from "node:fs"
import path from "node:path"

const pagePath = path.join(process.cwd(), "app/educador/page.tsx")
if (!fs.existsSync(pagePath)) {
  console.log("[planning-format-dropdown] educator page not found")
  process.exit(0)
}

let page = fs.readFileSync(pagePath, "utf8")
let changed = false

if (!page.includes("planningFormat, setPlanningFormat")) {
  page = page.replace(
    "  const [regenerating, setRegenerating] = useState(false)",
    "  const [regenerating, setRegenerating] = useState(false)\n  const [planningFormat, setPlanningFormat] = useState(\"colegio_mensual\")"
  )
  changed = true
}

if (!page.includes("function getPlanningFormatPrompt")) {
  const formatHelper = [
    "  function getPlanningFormatPrompt(formatId: string) {",
    "    switch (formatId || \"colegio_mensual\") {",
    "      case \"semestral_colegio\":",
    "        return \"Crea una planificación semestral estilo colegio para UTP. Debe organizarse por meses y semanas, indicando semestre, unidad o unidades, OA, indicadores de evaluación, objetivos de clase o actividades generales, evaluación/evidencia y recursos. No usar inicio, desarrollo ni cierre. No colocar minutos por clase. Debe quedar como cronograma institucional.\"",
    "      case \"semanal_utp\":",
    "        return \"Crea una planificación semanal estilo UTP. Debe organizar la semana por clases o bloques generales, incluyendo unidad, OA, indicadores de evaluación, objetivos de clase o actividades generales, evaluación/evidencia y recursos. Si no es planificación diaria, no usar inicio, desarrollo ni cierre y no colocar minutos por clase.\"",
    "      case \"diaria_detallada\":",
    "        return \"Crea una planificación diaria detallada para una clase. Incluye OA, indicadores, objetivo de clase, inicio, desarrollo, cierre, evaluación, recursos, adecuaciones PIE y ticket de salida. En este formato sí puedes usar tiempos por momento de la clase.\"",
    "      case \"colegio_mensual\":",
    "      default:",
    "        return \"Necesito una planificación mensual del primer semestre, desde marzo a junio. Debe estar organizada por meses y semanas. Debe incluir unidad, OA, indicadores de evaluación, objetivos de clase o actividades generales, evaluación/evidencia y recursos. No usar inicio, desarrollo ni cierre. No colocar minutos por clase. Usa formato cronograma institucional estilo colegio.\"",
    "    }",
    "  }",
    "",
  ].join("\n")

  page = page.replace("  function buildPromptWithContext(basePrompt: string) {", `${formatHelper}  function buildPromptWithContext(basePrompt: string) {`)
  changed = true
}

if (page.includes("function buildPromptWithContext") && !page.includes("effectivePrompt")) {
  page = page.replace(
    "    return [\n      basePrompt,",
    "    const defaultFormatPrompt = getPlanningFormatPrompt(planningFormat || \"colegio_mensual\")\n    const isGeneralPlanning = basePrompt.toLowerCase().includes(\"planificación docente completa\")\n    const effectivePrompt = isGeneralPlanning ? `${defaultFormatPrompt}\\n\\n${basePrompt}` : basePrompt\n\n    return [\n      effectivePrompt,"
  )
  changed = true
}

if (!page.includes("Generar con formato")) {
  const dropdownUi = [
    "                {config.nivel !== \"parvularia\" && (",
    "                  <div className=\"rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4\">",
    "                    <div className=\"flex flex-col gap-3 sm:flex-row sm:items-end\">",
    "                      <div className=\"flex-1\">",
    "                        <label className=\"text-emerald-800 text-xs font-semibold mb-1.5 block\">Formato de planificación</label>",
    "                        <select value={planningFormat} onChange={(e) => setPlanningFormat(e.target.value)} className=\"w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500\">",
    "                          <option value=\"colegio_mensual\">🏫 Plani colegio mensual — por defecto</option>",
    "                          <option value=\"semestral_colegio\">🗓️ Plani semestral colegio</option>",
    "                          <option value=\"semanal_utp\">📆 Plani semanal UTP</option>",
    "                          <option value=\"diaria_detallada\">🧾 Clase diaria detallada</option>",
    "                        </select>",
    "                      </div>",
    "                      <button onClick={() => sendMessage(buildPromptWithContext(getPlanningFormatPrompt(planningFormat)))} disabled={loading} className=\"rounded-2xl border border-emerald-800 bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-800 disabled:opacity-50\">",
    "                        Generar con formato",
    "                      </button>",
    "                    </div>",
    "                    <p className=\"mt-2 text-xs text-emerald-800\">Si no eliges otro formato, se usará Plani colegio mensual como prefijo base.</p>",
    "                  </div>",
    "                )}",
    "",
  ].join("\n")

  page = page.replace(
    "                <div className=\"grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2\">",
    `${dropdownUi}                <div className=\"grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2\">`
  )
  changed = true
}

if (changed) {
  fs.writeFileSync(pagePath, page, "utf8")
  console.log("[planning-format-dropdown] dropdown/default format applied")
} else {
  console.log("[planning-format-dropdown] no changes required")
}
