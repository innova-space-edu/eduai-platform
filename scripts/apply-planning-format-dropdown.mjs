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
    "  const [regenerating, setRegenerating] = useState(false)\n  const [planningFormat, setPlanningFormat] = useState(\"colegio\")"
  )
  changed = true
}

if (!page.includes("function getPlanningFormatPrompt")) {
  const formatHelper = [
    "  function getPlanningFormatPrompt(formatId: string) {",
    "    switch (formatId || \"colegio\") {",
    "      case \"utp\":",
    "        return \"Usa estilo UTP institucional. Respeta siempre el tipo de planificación elegido en el selector principal. Si es semanal, organiza por semana o bloques de la semana. Si es mensual, organiza por meses y semanas según el rango que indique el docente. Si es semestral, organiza por meses y semanas del semestre. Incluye unidad, OA, indicadores, objetivos de clase o actividades generales, evaluación/evidencia y recursos. Si no es diaria, no uses inicio, desarrollo, cierre ni minutos.\"",
    "      case \"canva\":",
    "        return \"Usa estilo Canva, visual, limpio y ordenado, pero respeta el tipo de planificación elegido. Si es mensual, debe salir por meses y semanas del rango indicado por el docente. Incluye unidad, OA, indicadores, objetivos de clase o actividades generales, evaluación/evidencia y recursos. Si no es diaria, no uses inicio, desarrollo, cierre ni minutos.\"",
    "      case \"diaria_detallada\":",
    "        return \"Usa formato de clase diaria detallada solo si el tipo elegido es diaria. Incluye OA, indicadores, objetivo de clase, inicio, desarrollo, cierre, evaluación, recursos, adecuaciones PIE y ticket de salida. Si el tipo elegido no es diaria, no cambies el tipo: conserva semanal, mensual o semestral y solo usa un estilo más detallado sin minutos ni inicio-desarrollo-cierre.\"",
    "      case \"colegio\":",
    "      default:",
    "        return \"Usa estilo colegio institucional como prefijo por defecto. Respeta siempre el tipo de planificación elegido en el selector principal: diaria, semanal, mensual, semestral o anual. Si es mensual, debe organizarse por los meses y semanas que indique el docente, por ejemplo marzo, abril, mayo y junio con sus semanas correspondientes. Debe incluir unidad, OA, indicadores de evaluación, objetivos de clase o actividades generales, evaluación/evidencia y recursos. Si no es diaria, no uses inicio, desarrollo ni cierre y no coloques minutos por clase.\"",
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
    "    const defaultFormatPrompt = getPlanningFormatPrompt(planningFormat || \"colegio\")\n    const isGeneralPlanning = basePrompt.toLowerCase().includes(\"planificación docente completa\")\n    const effectivePrompt = isGeneralPlanning ? `${defaultFormatPrompt}\\n\\n${basePrompt}` : basePrompt\n\n    return [\n      effectivePrompt,"
  )
  changed = true
}

if (!page.includes("Generar con formato")) {
  const dropdownUi = [
    "                {config.nivel !== \"parvularia\" && (",
    "                  <div className=\"rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4\">",
    "                    <div className=\"flex flex-col gap-3 sm:flex-row sm:items-end\">",
    "                      <div className=\"flex-1\">",
    "                        <label className=\"text-emerald-800 text-xs font-semibold mb-1.5 block\">Estilo de planificación</label>",
    "                        <select value={planningFormat} onChange={(e) => setPlanningFormat(e.target.value)} className=\"w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500\">",
    "                          <option value=\"colegio\">🏫 Estilo colegio — por defecto</option>",
    "                          <option value=\"utp\">🗓️ Estilo UTP institucional</option>",
    "                          <option value=\"canva\">🎨 Estilo Canva ordenado</option>",
    "                          <option value=\"diaria_detallada\">🧾 Detallada, respetando el tipo elegido</option>",
    "                        </select>",
    "                      </div>",
    "                      <button onClick={() => sendMessage(buildPromptWithContext(getPlanningFormatPrompt(planningFormat)))} disabled={loading} className=\"rounded-2xl border border-emerald-800 bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-800 disabled:opacity-50\">",
    "                        Generar con estilo",
    "                      </button>",
    "                    </div>",
    "                    <p className=\"mt-2 text-xs text-emerald-800\">Si no eliges otro estilo, se usará estilo colegio. El estilo no cambia el tipo: diaria, semanal o mensual se respeta desde el selector principal.</p>",
    "                  </div>",
    "                )}",
    "",
  ].join("\n")

  page = page.replace(
    "                <div className=\"grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2\">",
    `${dropdownUi}                <div className=\"grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">`
  )
  changed = true
}

if (changed) {
  fs.writeFileSync(pagePath, page, "utf8")
  console.log("[planning-format-dropdown] dropdown/default style applied")
} else {
  console.log("[planning-format-dropdown] no changes required")
}
