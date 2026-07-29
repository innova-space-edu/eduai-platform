"use client"

import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ImagePlus,
  PanelLeftOpen,
  Printer,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react"
import {
  PLANNING_PREVIEW_DRAFT_KEY,
  PLANNING_PREVIEW_SESSION_KEY,
  createPlanningBlock,
  createPlanningPreviewDocument,
  planningDocumentToText,
  type PlanningBlockStyle,
  type PlanningBlockType,
  type PlanningPreviewBlock,
  type PlanningPreviewDocument,
  type PlanningPreviewPayload,
  type PlanningShapeKind,
  type PlanningTextAlign,
  type PlanningTheme,
} from "@/lib/planning-preview"
import styles from "./editor.module.css"

const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

const TRANSPARENT = "#ffffff00"

const ELEMENTS: Array<{
  label: string
  icon: string
  type: PlanningBlockType
  overrides?: Partial<PlanningPreviewBlock>
}> = [
  { label: "Título", icon: "T", type: "heading", overrides: { level: 2 } },
  { label: "Texto", icon: "¶", type: "paragraph" },
  { label: "Lista", icon: "☷", type: "list", overrides: { items: ["Nuevo elemento"], ordered: false } },
  {
    label: "Tabla",
    icon: "▦",
    type: "table",
    overrides: { rows: [["Encabezado 1", "Encabezado 2"], ["Contenido", "Contenido"]] },
  },
  { label: "Nota", icon: "❝", type: "quote" },
  {
    label: "Rectángulo",
    icon: "▭",
    type: "shape",
    overrides: { shapeKind: "rectangle", text: "Figura" },
  },
  {
    label: "Círculo",
    icon: "○",
    type: "shape",
    overrides: { shapeKind: "circle", text: "Figura", style: { width: 40, minHeight: 180 } as Partial<PlanningBlockStyle> },
  },
  {
    label: "Etiqueta",
    icon: "▰",
    type: "shape",
    overrides: { shapeKind: "pill", text: "Etiqueta", style: { width: 55, minHeight: 58 } as Partial<PlanningBlockStyle> },
  },
  {
    label: "Llamado",
    icon: "▱",
    type: "shape",
    overrides: { shapeKind: "callout", text: "Idea importante" },
  },
  { label: "Línea", icon: "—", type: "divider" },
]

const FONT_OPTIONS = [
  "Arial, sans-serif",
  "Aptos, Arial, sans-serif",
  "Trebuchet MS, sans-serif",
  "Verdana, sans-serif",
  "Georgia, serif",
  "Times New Roman, serif",
]

const BLOCK_LABELS: Record<PlanningBlockType, string> = {
  heading: "Título",
  paragraph: "Texto",
  list: "Lista",
  table: "Tabla",
  quote: "Nota destacada",
  shape: "Figura",
  image: "Imagen",
  divider: "Separador",
}

function asPayload(value: unknown): PlanningPreviewPayload | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Partial<PlanningPreviewPayload>
  if (
    candidate.version !== 1 ||
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.content !== "string" ||
    !candidate.config ||
    typeof candidate.config !== "object"
  ) {
    return null
  }
  return {
    version: 1,
    id: candidate.id,
    title: candidate.title,
    subtitle: typeof candidate.subtitle === "string" ? candidate.subtitle : "Vista previa editable",
    content: candidate.content,
    config: candidate.config as Record<string, unknown>,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
  }
}

function asDocument(value: unknown): PlanningPreviewDocument | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Partial<PlanningPreviewDocument>
  if (
    candidate.version !== 1 ||
    typeof candidate.sourceId !== "string" ||
    typeof candidate.title !== "string" ||
    !Array.isArray(candidate.blocks) ||
    !candidate.page
  ) {
    return null
  }
  return candidate as PlanningPreviewDocument
}

function visibleColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"
}

function metadataText(value: unknown) {
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "string" || typeof value === "number") return String(value)
  return ""
}

export default function PlanningPreviewEditorPage() {
  const router = useRouter()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [documentState, setDocumentState] = useState<PlanningPreviewDocument | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [status, setStatus] = useState("")
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  const flash = useCallback((message: string) => {
    setStatus(message)
    window.setTimeout(() => setStatus(""), 2400)
  }, [])

  useEffect(() => {
    try {
      const rawPayload = sessionStorage.getItem(PLANNING_PREVIEW_SESSION_KEY)
      const rawDraft = localStorage.getItem(PLANNING_PREVIEW_DRAFT_KEY)
      const payload = rawPayload ? asPayload(JSON.parse(rawPayload)) : null
      const draft = rawDraft ? asDocument(JSON.parse(rawDraft)) : null

      const nextDocument =
        payload && draft?.sourceId === payload.id
          ? draft
          : payload
            ? createPlanningPreviewDocument(payload)
            : draft

      setDocumentState(nextDocument)
      setSelectedId(nextDocument?.blocks[0]?.id || "")
    } catch {
      setDocumentState(null)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    if (!documentState) return
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(PLANNING_PREVIEW_DRAFT_KEY, JSON.stringify(documentState))
      } catch {
        // El guardado manual informará si el navegador no tiene espacio.
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [documentState])

  const selectedBlock = useMemo(
    () => documentState?.blocks.find((block) => block.id === selectedId) || null,
    [documentState, selectedId]
  )

  const pageDimensions = useMemo(() => {
    const portrait = documentState?.page.orientation !== "landscape"
    const isLetter = documentState?.page.paper === "letter"
    const width = isLetter ? 816 : 794
    const height = isLetter ? 1056 : 1123
    return portrait ? { width, height } : { width: height, height: width }
  }, [documentState?.page.orientation, documentState?.page.paper])

  const commit = useCallback(
    (updater: (current: PlanningPreviewDocument) => PlanningPreviewDocument) => {
      setDocumentState((current) => {
        if (!current) return current
        return { ...updater(current), updatedAt: new Date().toISOString() }
      })
    },
    []
  )

  const updateBlock = useCallback(
    (id: string, updater: (block: PlanningPreviewBlock) => PlanningPreviewBlock) => {
      commit((current) => ({
        ...current,
        blocks: current.blocks.map((block) => (block.id === id ? updater(block) : block)),
      }))
    },
    [commit]
  )

  const updateBlockStyle = useCallback(
    (id: string, patch: Partial<PlanningBlockStyle>) => {
      updateBlock(id, (block) => ({ ...block, style: { ...block.style, ...patch } }))
    },
    [updateBlock]
  )

  function insertBlock(type: PlanningBlockType, overrides: Partial<PlanningPreviewBlock> = {}) {
    const nextBlock = createPlanningBlock(type, overrides)
    commit((current) => {
      const selectedIndex = current.blocks.findIndex((block) => block.id === selectedId)
      const insertAt = selectedIndex >= 0 ? selectedIndex + 1 : current.blocks.length
      const blocks = [...current.blocks]
      blocks.splice(insertAt, 0, nextBlock)
      return { ...current, blocks }
    })
    setSelectedId(nextBlock.id)
    setLeftOpen(false)
  }

  function moveSelected(direction: -1 | 1) {
    if (!selectedBlock) return
    commit((current) => {
      const index = current.blocks.findIndex((block) => block.id === selectedBlock.id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.blocks.length) return current
      const blocks = [...current.blocks]
      ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
      return { ...current, blocks }
    })
  }

  function duplicateSelected() {
    if (!selectedBlock) return
    const duplicate = createPlanningBlock(selectedBlock.type, {
      ...selectedBlock,
      id: undefined,
      style: { ...selectedBlock.style },
      items: selectedBlock.items ? [...selectedBlock.items] : undefined,
      rows: selectedBlock.rows?.map((row) => [...row]),
    })
    commit((current) => {
      const index = current.blocks.findIndex((block) => block.id === selectedBlock.id)
      const blocks = [...current.blocks]
      blocks.splice(index + 1, 0, duplicate)
      return { ...current, blocks }
    })
    setSelectedId(duplicate.id)
  }

  function deleteSelected() {
    if (!selectedBlock || !documentState) return
    const index = documentState.blocks.findIndex((block) => block.id === selectedBlock.id)
    const nextSelection = documentState.blocks[index + 1]?.id || documentState.blocks[index - 1]?.id || ""
    commit((current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== selectedBlock.id),
    }))
    setSelectedId(nextSelection)
  }

  function updateListItem(block: PlanningPreviewBlock, index: number, text: string) {
    const items = [...(block.items || [])]
    items[index] = text
    updateBlock(block.id, (current) => ({ ...current, items }))
  }

  function updateTableCell(block: PlanningPreviewBlock, rowIndex: number, columnIndex: number, text: string) {
    const rows = (block.rows || []).map((row) => [...row])
    if (!rows[rowIndex]) rows[rowIndex] = []
    rows[rowIndex][columnIndex] = text
    updateBlock(block.id, (current) => ({ ...current, rows }))
  }

  function addTableRow() {
    if (!selectedBlock || selectedBlock.type !== "table") return
    const rows = selectedBlock.rows || [["Encabezado"]]
    const columns = Math.max(1, rows[0]?.length || 1)
    updateBlock(selectedBlock.id, (block) => ({
      ...block,
      rows: [...rows.map((row) => [...row]), Array.from({ length: columns }, () => "Contenido")],
    }))
  }

  function addTableColumn() {
    if (!selectedBlock || selectedBlock.type !== "table") return
    const rows = selectedBlock.rows || [["Encabezado"]]
    updateBlock(selectedBlock.id, (block) => ({
      ...block,
      rows: rows.map((row, index) => [...row, index === 0 ? "Encabezado" : "Contenido"]),
    }))
  }

  function addListItem() {
    if (!selectedBlock || selectedBlock.type !== "list") return
    updateBlock(selectedBlock.id, (block) => ({
      ...block,
      items: [...(block.items || []), "Nuevo elemento"],
    }))
  }

  function applyTheme(theme: PlanningTheme) {
    const presets: Record<
      PlanningTheme,
      { accent: string; background: string; font: string; heading: string; quote: string }
    > = {
      professional: {
        accent: "#0f766e",
        background: "#ffffff",
        font: "Arial, sans-serif",
        heading: "#0f172a",
        quote: "#ecfdf5",
      },
      colorful: {
        accent: "#7c3aed",
        background: "#fffaf5",
        font: "Trebuchet MS, sans-serif",
        heading: "#5b21b6",
        quote: "#f5f3ff",
      },
      preschool: {
        accent: "#db2777",
        background: "#fffdf5",
        font: "Trebuchet MS, sans-serif",
        heading: "#be185d",
        quote: "#fdf2f8",
      },
      minimal: {
        accent: "#111827",
        background: "#ffffff",
        font: "Georgia, serif",
        heading: "#111827",
        quote: "#f8fafc",
      },
    }
    const preset = presets[theme]
    commit((current) => ({
      ...current,
      page: {
        ...current.page,
        theme,
        accent: preset.accent,
        background: preset.background,
        fontFamily: preset.font,
      },
      blocks: current.blocks.map((block) => ({
        ...block,
        style: {
          ...block.style,
          color: block.type === "heading" ? preset.heading : block.style.color,
          background: block.type === "quote" ? preset.quote : block.style.background,
        },
      })),
    }))
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") return
      insertBlock("image", {
        src: reader.result,
        alt: file.name,
        text: file.name,
        style: {
          width: 75,
          background: TRANSPARENT,
          borderRadius: 14,
          padding: 0,
          minHeight: 180,
        } as Partial<PlanningBlockStyle>,
      })
    }
    reader.readAsDataURL(file)
  }

  function saveDraft() {
    if (!documentState) return
    try {
      localStorage.setItem(PLANNING_PREVIEW_DRAFT_KEY, JSON.stringify(documentState))
      flash("Borrador visual guardado en este dispositivo.")
    } catch {
      flash("No fue posible guardar: el navegador no tiene espacio disponible.")
    }
  }

  async function copyEditedContent() {
    if (!documentState) return
    try {
      await navigator.clipboard.writeText(planningDocumentToText(documentState))
      flash("Contenido editado copiado.")
    } catch {
      flash("No fue posible copiar el contenido.")
    }
  }

  function blockCss(block: PlanningPreviewBlock): CSSProperties {
    const fontFamily = block.style.fontFamily === "inherit"
      ? documentState?.page.fontFamily
      : block.style.fontFamily
    return {
      width: `${block.style.width}%`,
      minHeight: block.style.minHeight || undefined,
      marginInline: "auto",
      marginBottom: block.style.marginBottom,
      padding: block.style.padding,
      color: block.style.color,
      backgroundColor: block.style.background === TRANSPARENT ? "transparent" : block.style.background,
      fontFamily,
      fontSize: block.style.fontSize,
      fontWeight: block.style.fontWeight,
      fontStyle: block.style.fontStyle,
      textDecoration: block.style.textDecoration,
      textAlign: block.style.textAlign,
      borderColor: block.style.borderColor,
      borderWidth: block.style.borderWidth,
      borderStyle: block.style.borderWidth ? "solid" : undefined,
      borderRadius: block.style.borderRadius,
    }
  }

  function editableText(
    block: PlanningPreviewBlock,
    className = "",
    tag: "div" | "p" = "div"
  ) {
    const Tag = tag
    return (
      <Tag
        className={`${styles.editable} ${className}`}
        contentEditable
        suppressContentEditableWarning
        onBlur={(event: FormEvent<HTMLElement>) => {
          const text = event.currentTarget.innerText.trim()
          updateBlock(block.id, (current) => ({ ...current, text }))
        }}
      >
        {block.text}
      </Tag>
    )
  }

  function renderBlock(block: PlanningPreviewBlock) {
    const selected = selectedId === block.id
    const commonClass = `${styles.block} ${selected ? styles.selectedBlock : ""}`
    const commonProps = {
      className: commonClass,
      style: blockCss(block),
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation()
        setSelectedId(block.id)
      },
    }

    if (block.type === "heading") {
      return (
        <section key={block.id} {...commonProps}>
          {editableText(block)}
        </section>
      )
    }

    if (block.type === "paragraph") {
      return (
        <section key={block.id} {...commonProps}>
          {editableText(block, "leading-relaxed", "p")}
        </section>
      )
    }

    if (block.type === "quote") {
      return (
        <blockquote key={block.id} {...commonProps}>
          {editableText(block, "leading-relaxed")}
        </blockquote>
      )
    }

    if (block.type === "list") {
      const ListTag = block.ordered ? "ol" : "ul"
      return (
        <section key={block.id} {...commonProps}>
          <ListTag className={`space-y-2 pl-6 ${block.ordered ? "list-decimal" : "list-disc"}`}>
            {(block.items || []).map((item, index) => (
              <li key={`${block.id}-${index}`}>
                <span
                  className={styles.editable}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => updateListItem(block, index, event.currentTarget.innerText.trim())}
                >
                  {item}
                </span>
              </li>
            ))}
          </ListTag>
        </section>
      )
    }

    if (block.type === "table") {
      const rows = block.rows || [["Encabezado 1", "Encabezado 2"], ["Contenido", "Contenido"]]
      return (
        <section key={block.id} {...commonProps}>
          <div className={styles.tableWrap}>
            <table className={styles.table} style={{ "--table-border": block.style.borderColor } as CSSProperties}>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`${block.id}-row-${rowIndex}`}>
                    {row.map((cell, columnIndex) => {
                      const Cell = rowIndex === 0 ? "th" : "td"
                      return (
                        <Cell
                          key={`${block.id}-${rowIndex}-${columnIndex}`}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(event) =>
                            updateTableCell(block, rowIndex, columnIndex, event.currentTarget.innerText.trim())
                          }
                        >
                          {cell}
                        </Cell>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )
    }

    if (block.type === "shape") {
      const shape = block.shapeKind || "rectangle"
      const shapeClass =
        shape === "circle"
          ? styles.circle
          : shape === "pill"
            ? styles.pill
            : shape === "callout"
              ? styles.callout
              : shape === "line"
                ? styles.line
                : ""
      return (
        <section key={block.id} {...commonProps} className={`${commonClass} ${styles.shape} ${shapeClass}`}>
          {shape !== "line" && editableText(block)}
        </section>
      )
    }

    if (block.type === "image") {
      return (
        <figure key={block.id} {...commonProps}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.src || ""} alt={block.alt || "Imagen"} className={styles.image} />
          <figcaption
            className={`${styles.editable} mt-2 text-center text-xs text-slate-500`}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) =>
              updateBlock(block.id, (current) => ({ ...current, alt: event.currentTarget.innerText.trim() }))
            }
          >
            {block.alt || "Descripción de la imagen"}
          </figcaption>
        </figure>
      )
    }

    return (
      <section
        key={block.id}
        {...commonProps}
        style={{ ...blockCss(block), minHeight: 0, height: Math.max(2, block.style.borderWidth || 2), padding: 0, background: block.style.borderColor }}
      />
    )
  }

  if (!ready) {
    return (
      <div className={`${styles.shell} flex items-center justify-center p-6`}>
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
          <p className="text-sm font-semibold text-slate-600">Preparando la vista previa editable…</p>
        </div>
      </div>
    )
  }

  if (!documentState) {
    return (
      <div className={`${styles.shell} flex items-center justify-center p-6`}>
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mb-4 text-5xl">📝</div>
          <h1 className="text-2xl font-black text-slate-900">No hay una planificación para previsualizar</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Regresa al Agente Planificador, genera una planificación y presiona el botón <strong>Vista previa</strong>.
          </p>
          <button onClick={() => router.push("/educador")} className={`${buttonClass} mt-6 bg-sky-600 text-white hover:bg-sky-700`}>
            <ArrowLeft size={16} /> Volver al planificador
          </button>
        </div>
      </div>
    )
  }

  const documentStyle = {
    width: pageDimensions.width,
    minHeight: pageDimensions.height,
    background: documentState.page.background,
    padding: documentState.page.padding,
    fontFamily: documentState.page.fontFamily,
    "--planning-accent": documentState.page.accent,
  } as CSSProperties

  const metadata = [
    ["Curso", metadataText(documentState.metadata.curso)],
    ["Asignatura / núcleo", metadataText(documentState.metadata.asignatura)],
    ["Nivel", metadataText(documentState.metadata.nivel)],
    ["Mes", metadataText(documentState.metadata.mes)],
  ].filter((entry) => entry[1])

  return (
    <div className={styles.shell}>
      <header className={`${styles.topbar} ${styles.screenOnly}`}>
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={() => router.back()} className={buttonClass} title="Volver">
            <ArrowLeft size={16} /> <span className="hidden sm:inline">Planificador</span>
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-black text-slate-900">Vista previa editable</h1>
            <p className="hidden truncate text-xs text-slate-500 sm:block">Edita textos, tablas, figuras, colores, fuentes y estilos antes de exportar.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={() => setLeftOpen(true)} className={`${buttonClass} xl:hidden`} title="Elementos">
            <PanelLeftOpen size={15} /> Elementos
          </button>
          <button onClick={() => setRightOpen(true)} className={`${buttonClass} xl:hidden`} title="Propiedades">
            <SlidersHorizontal size={15} /> Propiedades
          </button>
          <button onClick={copyEditedContent} className={buttonClass}>
            <Copy size={15} /> <span className="hidden md:inline">Copiar texto</span>
          </button>
          <button onClick={saveDraft} className={buttonClass}>
            <Save size={15} /> <span className="hidden md:inline">Guardar borrador</span>
          </button>
          <button onClick={() => window.print()} className={`${buttonClass} border-sky-700 bg-sky-600 text-white hover:bg-sky-700`}>
            <Printer size={15} /> Imprimir / PDF
          </button>
        </div>
      </header>

      {status && (
        <div className={`${styles.screenOnly} fixed left-1/2 top-20 z-[70] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xl`}>
          <Check className="mr-2 inline" size={14} /> {status}
        </div>
      )}

      {(leftOpen || rightOpen) && (
        <button
          type="button"
          className={`${styles.mobileBackdrop} ${styles.screenOnly}`}
          aria-label="Cerrar panel"
          onClick={() => {
            setLeftOpen(false)
            setRightOpen(false)
          }}
        />
      )}

      <main className={styles.workspace}>
        <aside className={`${styles.panel} ${styles.leftPanel} ${leftOpen ? styles.panelOpen : ""} ${styles.screenOnly}`}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div>
              <h2 className="text-sm font-black text-slate-900">Elementos</h2>
              <p className="text-[11px] text-slate-500">Añade contenido después del bloque seleccionado.</p>
            </div>
            <button onClick={() => setLeftOpen(false)} className="rounded-lg p-2 hover:bg-slate-100 xl:hidden" aria-label="Cerrar elementos">
              <X size={17} />
            </button>
          </div>

          <div className="space-y-5 p-4">
            <section>
              <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Insertar</h3>
              <div className="grid grid-cols-2 gap-2">
                {ELEMENTS.map((element) => (
                  <button
                    key={element.label}
                    onClick={() => insertBlock(element.type, element.overrides)}
                    className="flex min-h-16 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 text-center transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    <span className="text-xl font-black text-sky-700">{element.icon}</span>
                    <span className="mt-1 text-[11px] font-bold text-slate-700">{element.label}</span>
                  </button>
                ))}
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="flex min-h-16 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 text-center transition hover:border-sky-300 hover:bg-sky-50"
                >
                  <ImagePlus size={20} className="text-sky-700" />
                  <span className="mt-1 text-[11px] font-bold text-slate-700">Imagen</span>
                </button>
              </div>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </section>

            <section>
              <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Estructura del documento</h3>
              <div className="space-y-1.5">
                {documentState.blocks.map((block, index) => (
                  <button
                    key={block.id}
                    onClick={() => setSelectedId(block.id)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                      selectedId === block.id
                        ? "border-sky-400 bg-sky-50 font-bold text-sky-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-black">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{BLOCK_LABELS[block.type]} · {block.text || block.alt || "Sin texto"}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <section className={styles.canvasScroll} onClick={() => setSelectedId("")}>
          <article className={styles.document} style={documentStyle}>
            <header className={styles.documentHeader}>
              <input
                value={documentState.title}
                onChange={(event) =>
                  setDocumentState((current) => current ? { ...current, title: event.target.value, updatedAt: new Date().toISOString() } : current)
                }
                className={styles.titleInput}
                aria-label="Título de la planificación"
              />
              <input
                value={documentState.subtitle}
                onChange={(event) =>
                  setDocumentState((current) => current ? { ...current, subtitle: event.target.value, updatedAt: new Date().toISOString() } : current)
                }
                className={styles.subtitleInput}
                aria-label="Subtítulo de la planificación"
              />
              {metadata.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {metadata.map(([label, value]) => (
                    <span key={label} className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] text-slate-600">
                      <strong>{label}:</strong> {value}
                    </span>
                  ))}
                </div>
              )}
            </header>

            <div>
              {documentState.blocks.map(renderBlock)}
              {!documentState.blocks.length && (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    insertBlock("paragraph")
                  }}
                  className="w-full rounded-2xl border-2 border-dashed border-slate-300 p-8 text-sm font-bold text-slate-500 hover:border-sky-400 hover:text-sky-700"
                >
                  Añadir el primer bloque
                </button>
              )}
            </div>
          </article>
        </section>

        <aside className={`${styles.panel} ${styles.rightPanel} ${rightOpen ? styles.panelOpen : ""} ${styles.screenOnly}`}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div>
              <h2 className="text-sm font-black text-slate-900">Propiedades</h2>
              <p className="text-[11px] text-slate-500">Página y elemento seleccionado.</p>
            </div>
            <button onClick={() => setRightOpen(false)} className="rounded-lg p-2 hover:bg-slate-100 xl:hidden" aria-label="Cerrar propiedades">
              <X size={17} />
            </button>
          </div>

          <div className="space-y-5 p-4">
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Diseño de página</h3>
              <label className="block text-[11px] font-bold text-slate-600">
                Estilo general
                <select value={documentState.page.theme} onChange={(event) => applyTheme(event.target.value as PlanningTheme)} className={`${fieldClass} mt-1`}>
                  <option value="professional">Profesional</option>
                  <option value="colorful">Colorido</option>
                  <option value="preschool">Parvularia</option>
                  <option value="minimal">Minimalista</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] font-bold text-slate-600">
                  Papel
                  <select
                    value={documentState.page.paper}
                    onChange={(event) => commit((current) => ({ ...current, page: { ...current.page, paper: event.target.value as "a4" | "letter" } }))}
                    className={`${fieldClass} mt-1`}
                  >
                    <option value="a4">A4</option>
                    <option value="letter">Carta</option>
                  </select>
                </label>
                <label className="text-[11px] font-bold text-slate-600">
                  Orientación
                  <select
                    value={documentState.page.orientation}
                    onChange={(event) => commit((current) => ({ ...current, page: { ...current.page, orientation: event.target.value as "portrait" | "landscape" } }))}
                    className={`${fieldClass} mt-1`}
                  >
                    <option value="portrait">Vertical</option>
                    <option value="landscape">Horizontal</option>
                  </select>
                </label>
              </div>
              <label className="block text-[11px] font-bold text-slate-600">
                Fuente del documento
                <select
                  value={documentState.page.fontFamily}
                  onChange={(event) => commit((current) => ({ ...current, page: { ...current.page, fontFamily: event.target.value } }))}
                  className={`${fieldClass} mt-1`}
                >
                  {FONT_OPTIONS.map((font) => <option key={font} value={font}>{font.split(",")[0]}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] font-bold text-slate-600">
                  Fondo
                  <input
                    type="color"
                    value={visibleColor(documentState.page.background)}
                    onChange={(event) => commit((current) => ({ ...current, page: { ...current.page, background: event.target.value } }))}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white p-1"
                  />
                </label>
                <label className="text-[11px] font-bold text-slate-600">
                  Color principal
                  <input
                    type="color"
                    value={visibleColor(documentState.page.accent)}
                    onChange={(event) => commit((current) => ({ ...current, page: { ...current.page, accent: event.target.value } }))}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white p-1"
                  />
                </label>
              </div>
              <label className="block text-[11px] font-bold text-slate-600">
                Margen interior: {documentState.page.padding}px
                <input
                  type="range"
                  min={24}
                  max={90}
                  value={documentState.page.padding}
                  onChange={(event) => commit((current) => ({ ...current, page: { ...current.page, padding: Number(event.target.value) } }))}
                  className="mt-1 w-full"
                />
              </label>
            </section>

            {selectedBlock ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-sky-700">Elemento seleccionado</p>
                    <h3 className="text-sm font-black text-slate-900">{BLOCK_LABELS[selectedBlock.type]}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => moveSelected(-1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" title="Subir"><ChevronUp size={15} /></button>
                    <button onClick={() => moveSelected(1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" title="Bajar"><ChevronDown size={15} /></button>
                  </div>
                </div>

                {selectedBlock.type !== "image" && selectedBlock.type !== "divider" && (
                  <>
                    <label className="block text-[11px] font-bold text-slate-600">
                      Fuente
                      <select
                        value={selectedBlock.style.fontFamily}
                        onChange={(event) => updateBlockStyle(selectedBlock.id, { fontFamily: event.target.value })}
                        className={`${fieldClass} mt-1`}
                      >
                        <option value="inherit">Usar fuente del documento</option>
                        {FONT_OPTIONS.map((font) => <option key={font} value={font}>{font.split(",")[0]}</option>)}
                      </select>
                    </label>
                    <label className="block text-[11px] font-bold text-slate-600">
                      Tamaño: {selectedBlock.style.fontSize}px
                      <input
                        type="range"
                        min={10}
                        max={64}
                        value={selectedBlock.style.fontSize}
                        onChange={(event) => updateBlockStyle(selectedBlock.id, { fontSize: Number(event.target.value) })}
                        className="mt-1 w-full"
                      />
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => updateBlockStyle(selectedBlock.id, { fontWeight: selectedBlock.style.fontWeight >= 700 ? 400 : 800 })}
                        className={`${buttonClass} ${selectedBlock.style.fontWeight >= 700 ? "border-sky-400 bg-sky-50 text-sky-700" : ""}`}
                      >B</button>
                      <button
                        onClick={() => updateBlockStyle(selectedBlock.id, { fontStyle: selectedBlock.style.fontStyle === "italic" ? "normal" : "italic" })}
                        className={`${buttonClass} italic ${selectedBlock.style.fontStyle === "italic" ? "border-sky-400 bg-sky-50 text-sky-700" : ""}`}
                      >I</button>
                      <button
                        onClick={() => updateBlockStyle(selectedBlock.id, { textDecoration: selectedBlock.style.textDecoration === "underline" ? "none" : "underline" })}
                        className={`${buttonClass} underline ${selectedBlock.style.textDecoration === "underline" ? "border-sky-400 bg-sky-50 text-sky-700" : ""}`}
                      >U</button>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {(["left", "center", "right", "justify"] as PlanningTextAlign[]).map((align) => (
                        <button
                          key={align}
                          onClick={() => updateBlockStyle(selectedBlock.id, { textAlign: align })}
                          className={`rounded-lg border px-2 py-2 text-[10px] font-bold ${selectedBlock.style.textAlign === align ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600"}`}
                        >
                          {align === "left" ? "Izq." : align === "center" ? "Centro" : align === "right" ? "Der." : "Just."}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-bold text-slate-600">
                    Texto
                    <input
                      type="color"
                      value={visibleColor(selectedBlock.style.color)}
                      onChange={(event) => updateBlockStyle(selectedBlock.id, { color: event.target.value })}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white p-1"
                    />
                  </label>
                  <label className="text-[11px] font-bold text-slate-600">
                    Fondo
                    <input
                      type="color"
                      value={visibleColor(selectedBlock.style.background)}
                      onChange={(event) => updateBlockStyle(selectedBlock.id, { background: event.target.value })}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white p-1"
                    />
                  </label>
                </div>
                <button onClick={() => updateBlockStyle(selectedBlock.id, { background: TRANSPARENT })} className={`${buttonClass} w-full`}>
                  Fondo transparente
                </button>

                <label className="block text-[11px] font-bold text-slate-600">
                  Ancho: {selectedBlock.style.width}%
                  <input type="range" min={30} max={100} value={selectedBlock.style.width} onChange={(event) => updateBlockStyle(selectedBlock.id, { width: Number(event.target.value) })} className="mt-1 w-full" />
                </label>
                {(selectedBlock.type === "shape" || selectedBlock.type === "image") && (
                  <label className="block text-[11px] font-bold text-slate-600">
                    Alto mínimo: {selectedBlock.style.minHeight}px
                    <input type="range" min={40} max={420} value={Math.max(40, selectedBlock.style.minHeight)} onChange={(event) => updateBlockStyle(selectedBlock.id, { minHeight: Number(event.target.value) })} className="mt-1 w-full" />
                  </label>
                )}
                <label className="block text-[11px] font-bold text-slate-600">
                  Espacio interior: {selectedBlock.style.padding}px
                  <input type="range" min={0} max={42} value={selectedBlock.style.padding} onChange={(event) => updateBlockStyle(selectedBlock.id, { padding: Number(event.target.value) })} className="mt-1 w-full" />
                </label>
                <label className="block text-[11px] font-bold text-slate-600">
                  Redondeado: {selectedBlock.style.borderRadius}px
                  <input type="range" min={0} max={48} value={selectedBlock.style.borderRadius} onChange={(event) => updateBlockStyle(selectedBlock.id, { borderRadius: Number(event.target.value) })} className="mt-1 w-full" />
                </label>
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <label className="text-[11px] font-bold text-slate-600">
                    Borde: {selectedBlock.style.borderWidth}px
                    <input type="range" min={0} max={8} value={selectedBlock.style.borderWidth} onChange={(event) => updateBlockStyle(selectedBlock.id, { borderWidth: Number(event.target.value) })} className="mt-2 w-full" />
                  </label>
                  <label className="text-[11px] font-bold text-slate-600">
                    Color
                    <input type="color" value={visibleColor(selectedBlock.style.borderColor)} onChange={(event) => updateBlockStyle(selectedBlock.id, { borderColor: event.target.value })} className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white p-1" />
                  </label>
                </div>

                {selectedBlock.type === "shape" && (
                  <label className="block text-[11px] font-bold text-slate-600">
                    Tipo de figura
                    <select
                      value={selectedBlock.shapeKind || "rectangle"}
                      onChange={(event) => updateBlock(selectedBlock.id, (block) => ({ ...block, shapeKind: event.target.value as PlanningShapeKind }))}
                      className={`${fieldClass} mt-1`}
                    >
                      <option value="rectangle">Rectángulo</option>
                      <option value="circle">Círculo</option>
                      <option value="pill">Etiqueta</option>
                      <option value="callout">Llamado</option>
                      <option value="line">Línea</option>
                    </select>
                  </label>
                )}

                {selectedBlock.type === "table" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={addTableRow} className={buttonClass}>+ Fila</button>
                    <button onClick={addTableColumn} className={buttonClass}>+ Columna</button>
                  </div>
                )}

                {selectedBlock.type === "list" && (
                  <div className="space-y-2">
                    <button onClick={addListItem} className={`${buttonClass} w-full`}>+ Elemento</button>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedBlock.ordered)}
                        onChange={(event) => updateBlock(selectedBlock.id, (block) => ({ ...block, ordered: event.target.checked }))}
                      />
                      Lista numerada
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
                  <button onClick={duplicateSelected} className={buttonClass}><Copy size={14} /> Duplicar</button>
                  <button onClick={deleteSelected} className={`${buttonClass} border-rose-200 text-rose-700 hover:bg-rose-50`}><Trash2 size={14} /> Eliminar</button>
                </div>
              </section>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center text-xs leading-relaxed text-slate-500">
                Selecciona un texto, tabla, figura o imagen en la hoja para editar sus propiedades.
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}
