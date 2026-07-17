import { readFileSync, writeFileSync } from "node:fs"

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`[educador-dual-submit] missing anchor: ${label}`)
  }
  return source.replace(search, replacement)
}

function replacePattern(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`[educador-dual-submit] missing pattern: ${label}`)
  }
  return source.replace(pattern, replacement)
}

const pagePath = "app/educador/page.tsx"
let page = readFileSync(pagePath, "utf8")

if (!page.includes("const PLANNER_ADDON_LABELS")) {
  page = replaceOnce(
    page,
    String.raw`interface Message {
  role: "user" | "assistant"
  content: string
  provider?: string
}
`,
    String.raw`interface Message {
  role: "user" | "assistant"
  content: string
  provider?: string
}

type SendModeOptions = {
  requestMode?: "structured" | "free"
  useStructuredContext?: boolean
  sourceLabel?: "Generador estructurado" | "Consulta libre"
}

const PLANNER_ADDON_LABELS = new Set(["Adaptación NEE", "Interdisciplinario", "Sala heterogénea"])
`,
    "message interface",
  )

  page = replaceOnce(
    page,
    "  const [regenerating, setRegenerating] = useState(false)\n",
    String.raw`  const [regenerating, setRegenerating] = useState(false)
  const [selectedPromptLabel, setSelectedPromptLabel] = useState("Planificación completa")
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [useContextForFree, setUseContextForFree] = useState(false)
`,
    "planner states",
  )

  page = replaceOnce(
    page,
    "  const latestAssistantMessage = [...messages].reverse().find((msg) => msg.role === \"assistant\")\n",
    String.raw`  const latestAssistantMessage = [...messages].reverse().find((msg) => msg.role === "assistant")
  const primaryPrompts = QUICK_PROMPTS.filter((item) => !PLANNER_ADDON_LABELS.has(item.label))
  const addonPrompts = QUICK_PROMPTS.filter((item) => PLANNER_ADDON_LABELS.has(item.label))
`,
    "prompt groups",
  )

  page = replaceOnce(
    page,
    String.raw`  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    setInput("")
    setShowWelcome(false)
    setConfigOpen(false)

    const userMsg: Message = { role: "user", content: text }
`,
    String.raw`  async function sendMessage(text: string, options: SendModeOptions = {}) {
    if (!text.trim() || loading) return

    setInput("")
    setShowWelcome(false)
    setConfigOpen(false)

    const requestMode = options.requestMode || "structured"
    const shouldUseContext = requestMode === "structured" || options.useStructuredContext === true
    const requestConfig = shouldUseContext
      ? config
      : {
          ...config,
          contexto: "",
          unidadId: "",
          selectedOAIds: [],
          selectedOATIds: [],
          parvulariaHeterogenea: false,
          parvulariaMotivoFusion: "",
        }
    const visibleText = options.sourceLabel ? options.sourceLabel + ": " + text : text
    const userMsg: Message = { role: "user", content: visibleText }
`,
    "sendMessage signature",
  )

  page = replaceOnce(
    page,
    String.raw`          message: text,
          history: messages.slice(-10),
          config,
`,
    String.raw`          message: text,
          history: messages.slice(-10),
          config: requestConfig,
          requestMode,
          useStructuredContext: shouldUseContext,
`,
    "request payload",
  )

  page = replaceOnce(
    page,
    "  function buildPlanningTitle() {\n",
    String.raw`  function togglePlannerAddon(label: string) {
    setSelectedAddons((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    )
  }

  async function handleStructuredGenerate() {
    const product = QUICK_PROMPTS.find((item) => item.label === selectedPromptLabel) || QUICK_PROMPTS[0]
    const addonInstructions = selectedAddons
      .map((label) => QUICK_PROMPTS.find((item) => item.label === label)?.prompt)
      .filter((prompt): prompt is string => Boolean(prompt))

    const structuredRequest = [
      "PRODUCTO PRINCIPAL: " + product.label + ".",
      product.prompt,
      config.contexto.trim()
        ? "DESCRIPCIÓN O IDEA DEL DOCENTE: " + config.contexto.trim()
        : "Usa la configuración curricular seleccionada y crea una propuesta completa y directamente aplicable.",
      addonInstructions.length
        ? "COMPLEMENTOS OBLIGATORIOS:\n" + addonInstructions.map((item) => "- " + item).join("\n")
        : "",
    ].filter(Boolean).join("\n\n")

    await sendMessage(structuredRequest, {
      requestMode: "structured",
      useStructuredContext: true,
      sourceLabel: "Generador estructurado",
    })
  }

  function buildPlanningTitle() {
`,
    "structured handler",
  )

  page = replacePattern(
    page,
    /  async function handleRegenerate\(\) \{[\s\S]*?\n  \}\n\n    return \(/,
    String.raw`  async function handleRegenerate() {
    const lastUser = [...messages].reverse().find(m => m.role === "user")
    if (!lastUser || loading) return
    const isFree = lastUser.content.startsWith("Consulta libre:")
    const isStructured = lastUser.content.startsWith("Generador estructurado:")
    const rawText = lastUser.content
      .replace(/^Consulta libre:\s*/, "")
      .replace(/^Generador estructurado:\s*/, "")
    setRegenerating(true)
    setMessages(prev => prev.filter((_, i) => i < prev.length - 1))
    await sendMessage(rawText, {
      requestMode: isFree ? "free" : "structured",
      useStructuredContext: isFree ? useContextForFree : true,
      sourceLabel: isFree ? "Consulta libre" : isStructured ? "Generador estructurado" : undefined,
    })
    setRegenerating(false)
  }

    return (`,
    "regenerate mode",
  )

  page = replacePattern(
    page,
    /                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">[\s\S]*?                  \}\)\}\n                <\/div>/,
    String.raw`                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">2. Elige qué quieres generar</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">Selecciona un producto principal. Los botones solo preparan la solicitud; la generación comienza con el botón verde.</p>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] font-semibold text-emerald-700">1 producto</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {primaryPrompts.map((qp) => {
                      const clr = PROMPT_COLORS[qp.color] || PROMPT_COLORS.emerald
                      const selected = selectedPromptLabel === qp.label
                      return (
                        <button
                          key={qp.label}
                          type="button"
                          onClick={() => setSelectedPromptLabel(qp.label)}
                          aria-pressed={selected}
                          className={"relative rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 " + (selected ? clr.bg + " " + clr.border + " shadow-md" : "border-slate-200 bg-white hover:border-emerald-300")}
                        >
                          {selected && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-emerald-700">✓</span>}
                          <div className="mb-1 text-base">{qp.icon}</div>
                          <div className={"text-xs font-semibold leading-tight " + (selected ? clr.text : "text-slate-700")}>{qp.label}</div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-5 border-t border-emerald-200 pt-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Complementos opcionales</p>
                    <p className="mt-1 text-xs text-slate-500">Puedes combinar varios con el producto principal.</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {addonPrompts.map((qp) => {
                        const selected = selectedAddons.includes(qp.label)
                        return (
                          <button
                            key={qp.label}
                            type="button"
                            onClick={() => togglePlannerAddon(qp.label)}
                            aria-pressed={selected}
                            className={"flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-xs font-semibold transition " + (selected ? "border-teal-700 bg-teal-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-teal-300")}
                          >
                            <span>{qp.icon}</span>
                            <span className="flex-1">{qp.label}</span>
                            <span>{selected ? "✓" : "+"}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Solicitud preparada</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{selectedPromptLabel}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {config.curso} · {config.asignatura} · {config.selectedOAIds.length} OA · {config.selectedOATIds.length} OAT
                      {selectedAddons.length ? " · Complementos: " + selectedAddons.join(", ") : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleStructuredGenerate}
                    disabled={loading}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Generando..." : "✨ Generar con esta configuración"}
                  </button>
                </div>`,
    "quick prompt selector",
  )

  page = replaceOnce(
    page,
    "                  Tu proyecto o idea 💡 <span className=\"text-emerald-700\">(el agente lo usará como eje central)</span>\n",
    "                  1. Describe tu proyecto o idea 💡 <span className=\"text-emerald-700\">(se conectará con curso, OA, OAT y producto elegido)</span>\n",
    "context label",
  )

  page = replacePattern(
    page,
    /      <div className="sticky bottom-0 bg-white\/90[\s\S]*?      <\/div>\n    <\/div>\n  \)\n\}/,
    String.raw`      <div className="sticky bottom-0 border-t border-blue-100 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl rounded-3xl border border-blue-100 bg-blue-50/60 p-3 sm:p-4">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-blue-800">💬 Consulta libre al Agente Planificador</p>
              <p className="mt-0.5 text-[11px] text-slate-600">Escribe cualquier solicitud. Esta zona tiene su propio botón de envío.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-600">
              <input
                type="checkbox"
                checked={useContextForFree}
                onChange={(event) => setUseContextForFree(event.target.checked)}
                className="h-4 w-4 rounded border-blue-300 text-blue-600"
              />
              Usar también curso, OA y contexto superior
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(input, {
                    requestMode: "free",
                    useStructuredContext: useContextForFree,
                    sourceLabel: "Consulta libre",
                  })
                }
              }}
              placeholder="Ej.: Crea una actividad de 20 minutos, redacta un comunicado o explícame un concepto..."
              className="min-h-[64px] max-h-40 flex-1 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm text-main placeholder-slate-400 outline-none transition focus:border-blue-500"
            />

            <button
              type="button"
              onClick={() => sendMessage(input, {
                requestMode: "free",
                useStructuredContext: useContextForFree,
                sourceLabel: "Consulta libre",
              })}
              disabled={!input.trim() || loading}
              className="self-stretch rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40 sm:self-end"
            >
              {loading ? "Enviando..." : "Enviar consulta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}`,
    "free chat footer",
  )

  writeFileSync(pagePath, page)
  console.log("[educador-dual-submit] page updated")
} else {
  console.log("[educador-dual-submit] page already applied")
}

const routePath = "app/api/agents/educador/route.ts"
let route = readFileSync(routePath, "utf8")

if (!route.includes("CONSULTA LIBRE DEL DOCENTE")) {
  route = replaceOnce(
    route,
    String.raw`  const mode = cfg.mode === "sugerir_parvularia" ? "sugerir_parvularia" : "planificar"

  const nivel: NivelKey = cfg.nivel === "parvularia" || cfg.nivel === "basica" || cfg.nivel === "media"
`,
    String.raw`  const mode = cfg.mode === "sugerir_parvularia" ? "sugerir_parvularia" : "planificar"
  const requestMode = body.requestMode === "free" ? "free" : "structured"

  if (requestMode === "free") {
    const includeContext = body.useStructuredContext === true
    const freeContext = includeContext
      ? [
          typeof cfg.curso === "string" && cfg.curso.trim() ? "Curso o subnivel: " + cfg.curso.trim() : "",
          typeof cfg.asignatura === "string" && cfg.asignatura.trim() ? "Asignatura o nucleo: " + cfg.asignatura.trim() : "",
          typeof cfg.contexto === "string" && cfg.contexto.trim() ? "Contexto del docente: " + truncateForPrompt(cfg.contexto.trim(), 1200) : "",
          ensureArray(cfg.selectedOAIds).length ? "OA seleccionados: " + ensureArray(cfg.selectedOAIds).join(", ") : "",
          ensureArray(cfg.selectedOATIds).length ? "OAT seleccionados: " + ensureArray(cfg.selectedOATIds).join(", ") : "",
        ].filter(Boolean).join("\n")
      : ""

    const freeSystemPrompt = [
      "Eres APl, asistente educativo general de EduAI para docentes de Chile.",
      "",
      "CONSULTA LIBRE DEL DOCENTE:",
      "- Responde exactamente lo solicitado en el mensaje.",
      "- No conviertas automáticamente la petición en una planificación completa.",
      "- No impongas OA, tablas, sesiones ni estructura curricular salvo que el docente lo solicite.",
      "- Puedes crear, explicar, redactar, resumir, proponer, revisar o adaptar materiales educativos.",
      "- Responde en español claro, útil, formal y directamente aplicable.",
      freeContext
        ? "\nCONTEXTO SUPERIOR ACTIVADO VOLUNTARIAMENTE:\n" + freeContext
        : "\nEl contexto pedagógico superior está desactivado; usa solamente la consulta escrita y el historial reciente.",
    ].join("\n")

    const freeMessages = [
      { role: "system" as const, content: freeSystemPrompt },
      ...history.slice(-6).filter(isChatHistoryItem).map((msg: ChatHistoryItem) => ({
        role: msg.role,
        content: truncateForPrompt(msg.content, msg.role === "assistant" ? 1400 : 1800),
      })),
      { role: "user" as const, content: message },
    ]

    try {
      const strategy = getEducadorModelStrategy("planning_short")
      const result = await callAI(freeMessages, {
        maxTokens: Math.min(strategy.maxTokens, 3600),
        preferProvider: strategy.preferProvider,
        openrouterModel: strategy.openrouterModel,
      })
      return NextResponse.json({
        text: result.text,
        provider: result.provider,
        model: result.model,
        requestMode: "free",
        usedStructuredContext: includeContext,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No fue posible responder la consulta libre"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  }

  const nivel: NivelKey = cfg.nivel === "parvularia" || cfg.nivel === "basica" || cfg.nivel === "media"
`,
    "free request branch",
  )

  writeFileSync(routePath, route)
  console.log("[educador-dual-submit] route updated")
} else {
  console.log("[educador-dual-submit] route already applied")
}
