import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const educatorPagePath = path.join(root, "app/educador/page.tsx")
const previewPagePath = path.join(root, "app/educador/vista-previa/page.tsx")
let changed = false

if (fs.existsSync(educatorPagePath)) {
  let source = fs.readFileSync(educatorPagePath, "utf8")

  if (!source.includes("function handleOpenPlanningPreview")) {
    const helper = `  function handleOpenPlanningPreview() {
    const content = latestAssistantMessage?.content?.trim()
    if (!content) {
      setSaveStatus("Primero genera una planificación para abrir la vista previa.")
      return
    }

    try {
      const previewPayload = {
        version: 1 as const,
        id: globalThis.crypto?.randomUUID?.() || \`planning-\${Date.now()}\`,
        title: buildPlanningTitle(),
        subtitle: "Planificación generada desde el Agente Planificador",
        content,
        config: {
          nivel: config.nivel,
          curso: config.curso,
          asignatura: config.asignatura,
          contexto: config.contexto,
          mes: config.mes,
          unidadId: config.unidadId,
          selectedOAIds: config.selectedOAIds,
          selectedOATIds: config.selectedOATIds,
          selectedOA: selectedOAObjects.map((oa) => ({
            id: oa.id,
            codigo: oa.codigoOficial || oa.id,
            texto: oa.texto,
          })),
          tiempoPlanificacion: config.tiempoPlanificacion,
          sesiones: config.sesiones,
          duracionMinutos: config.duracionMinutos,
          parvulariaHeterogenea: config.parvulariaHeterogenea,
          parvulariaSegundoCurso: config.parvulariaSegundoCurso,
          planningProfile: config.planningProfile,
        },
        createdAt: new Date().toISOString(),
      }
      sessionStorage.setItem("eduai-planning-preview-v1", JSON.stringify(previewPayload))
      router.push("/educador/vista-previa")
    } catch {
      setSaveStatus("No fue posible preparar la vista previa en este navegador.")
    }
  }

`
    source = source.replace("  function handleCopyPlanning() {", `${helper}  function handleCopyPlanning() {`)
    changed = true
  }

  if (!source.includes("onClick={handleOpenPlanningPreview}")) {
    const previewButton = `            <button
              onClick={handleOpenPlanningPreview}
              disabled={!latestAssistantMessage}
              className="rounded-xl border border-sky-800 bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-sky-800 disabled:opacity-40"
            >
              👁️ Vista previa
            </button>
`
    source = source.replace(
      "            <button\n              onClick={handleCopyPlanning}",
      `${previewButton}            <button\n              onClick={handleCopyPlanning}`
    )
    changed = true
  }

  fs.writeFileSync(educatorPagePath, source, "utf8")
}

if (fs.existsSync(previewPagePath)) {
  let source = fs.readFileSync(previewPagePath, "utf8")
  const replacements = [
    [
      "  type PlanningBlockStyle,\n  type PlanningBlockType,",
      "  type PlanningBlockOverrides,\n  type PlanningBlockStyle,\n  type PlanningBlockType,",
    ],
    ["  type FormEvent,\n}", "  type FormEvent,\n  type MouseEvent,\n}"],
    ["  overrides?: Partial<PlanningPreviewBlock>", "  overrides?: PlanningBlockOverrides"],
    [
      "  function insertBlock(type: PlanningBlockType, overrides: Partial<PlanningPreviewBlock> = {}) {",
      "  function insertBlock(type: PlanningBlockType, overrides: PlanningBlockOverrides = {}) {",
    ],
    ["React.MouseEvent<HTMLElement>", "MouseEvent<HTMLElement>"],
    [
      "        <section key={block.id} {...commonProps} className={`${commonClass} ${styles.shape} ${shapeClass}`}>",
      "        <section key={block.id} className={`${commonClass} ${styles.shape} ${shapeClass}`} style={blockCss(block)} onClick={commonProps.onClick}>",
    ],
    [
      "        {...commonProps}\n        style={{ ...blockCss(block), minHeight: 0, height: Math.max(2, block.style.borderWidth || 2), padding: 0, background: block.style.borderColor }}",
      "        className={commonClass}\n        onClick={commonProps.onClick}\n        style={{ ...blockCss(block), minHeight: 0, height: Math.max(2, block.style.borderWidth || 2), padding: 0, background: block.style.borderColor }}",
    ],
  ]

  for (const [before, after] of replacements) {
    if (source.includes(before)) {
      source = source.replaceAll(before, after)
      changed = true
    }
  }

  fs.writeFileSync(previewPagePath, source, "utf8")
}

console.log(changed ? "[planning-preview] editor connected" : "[planning-preview] already connected")
