"use client"

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  BringToFront,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Italic,
  Layers3,
  Lock,
  Minus,
  Move,
  Palette,
  PanelRightClose,
  Plus,
  Redo2,
  RotateCw,
  SendToBack,
  Square,
  Trash2,
  Type,
  Underline,
  Undo2,
  Unlock,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import {
  addCanvasElement,
  createImageCanvasElement,
  createShapeCanvasElement,
  createTextCanvasElement,
  duplicateCanvasElement,
  removeCanvasElement,
  reorderCanvasElement,
  updateCanvasElement,
  updateCanvasPage,
  type CreatorCanvasElement,
  type CreatorCanvasElementStyle,
  type CreatorCanvasPage,
  type CreatorCanvasShape,
} from "@/lib/creator-canvas"
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"

const FONT_OPTIONS = [
  "Arial",
  "Inter",
  "Roboto",
  "Poppins",
  "Montserrat",
  "Georgia",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "Courier New",
]

const toolButton = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-sub transition hover:text-main disabled:cursor-not-allowed disabled:opacity-30"
const iconButton = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted2 transition hover:text-main disabled:cursor-not-allowed disabled:opacity-25"
const fieldClass = "h-9 rounded-lg border border-soft bg-card-theme px-2.5 text-xs text-main outline-none focus:border-blue-500/35"

function styleValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function fitStyle(value?: string) {
  if (value === "contain") return "contain"
  if (value === "cover") return "cover"
  return "100% 100%"
}

function elementCss(element: CreatorCanvasElement): CSSProperties {
  const style = element.style || {}
  const isLine = element.type === "shape" && element.shape === "line"
  return {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: Math.max(8, element.width),
    height: Math.max(8, element.height),
    transform: `rotate(${element.rotation || 0}deg)`,
    transformOrigin: "center",
    zIndex: element.zIndex,
    opacity: style.opacity ?? 1,
    display: element.hidden ? "none" : "flex",
    alignItems: isLine ? "stretch" : "center",
    justifyContent: style.textAlign === "center" ? "center" : style.textAlign === "right" ? "flex-end" : "flex-start",
    overflow: "hidden",
    color: style.color || "#172033",
    backgroundColor: style.backgroundColor || "transparent",
    borderColor: style.borderColor || "transparent",
    borderStyle: "solid",
    borderWidth: style.borderWidth ?? 0,
    borderRadius: style.borderRadius ?? (element.shape === "circle" ? 999 : 0),
    fontFamily: style.fontFamily || "Arial",
    fontSize: style.fontSize || 24,
    fontWeight: style.fontWeight || 400,
    fontStyle: style.fontStyle || "normal",
    textDecoration: style.textDecoration || "none",
    textAlign: style.textAlign || "left",
    lineHeight: style.lineHeight || 1.25,
    padding: style.padding ?? 0,
    letterSpacing: style.letterSpacing ?? 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    userSelect: "none",
  }
}

function RenderElement({
  element,
  selected,
  editing,
  onSelect,
  onStartMove,
  onStartResize,
  onStartRotate,
  onStartEditing,
  onTextCommit,
}: {
  element: CreatorCanvasElement
  selected: boolean
  editing: boolean
  onSelect: () => void
  onStartMove: (event: ReactPointerEvent) => void
  onStartResize: (event: ReactPointerEvent) => void
  onStartRotate: (event: ReactPointerEvent) => void
  onStartEditing: () => void
  onTextCommit: (text: string) => void
}) {
  const isText = element.type === "text"
  const isShape = element.type === "shape"
  const css = elementCss(element)

  return (
    <div
      data-canvas-element={element.id}
      style={{ ...css, cursor: element.locked ? "default" : editing ? "text" : "move", outline: selected ? "2px solid #2563eb" : "none", outlineOffset: 2 }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect()
        if (!element.locked && !editing) onStartMove(event)
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        if (isText && !element.locked) onStartEditing()
      }}
    >
      {element.type === "image" && element.src ? (
        <img src={element.src} alt={element.name} crossOrigin="anonymous" className="pointer-events-none h-full w-full object-cover" draggable={false} />
      ) : isText ? (
        <div
          contentEditable={editing}
          suppressContentEditableWarning
          spellCheck
          className="h-full w-full outline-none"
          style={{ cursor: editing ? "text" : "inherit", userSelect: editing ? "text" : "none" }}
          onBlur={(event) => onTextCommit(event.currentTarget.innerText)}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.currentTarget.blur()
            event.stopPropagation()
          }}
        >
          {element.text || ""}
        </div>
      ) : isShape ? (
        <div className="h-full w-full" />
      ) : null}

      {selected && !editing && !element.locked && (
        <>
          <button
            type="button"
            aria-label="Redimensionar"
            onPointerDown={(event) => {
              event.stopPropagation()
              onStartResize(event)
            }}
            className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow"
          />
          <button
            type="button"
            aria-label="Rotar"
            onPointerDown={(event) => {
              event.stopPropagation()
              onStartRotate(event)
            }}
            className="absolute -top-8 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-blue-300 bg-white text-blue-600 shadow"
          >
            <RotateCw size={12} />
          </button>
        </>
      )}
    </div>
  )
}

function StylePanel({
  page,
  selected,
  onUpdateElement,
  onUpdatePage,
  onClose,
}: {
  page: CreatorCanvasPage
  selected?: CreatorCanvasElement
  onUpdateElement: (patch: Partial<CreatorCanvasElement>) => void
  onUpdatePage: (patch: Partial<CreatorCanvasPage>) => void
  onClose: () => void
}) {
  const patchStyle = (patch: Partial<CreatorCanvasElementStyle>) => {
    if (!selected) return
    onUpdateElement({ style: { ...selected.style, ...patch } })
  }

  return (
    <aside className="absolute right-3 top-14 z-[120] w-[310px] max-w-[calc(100%-24px)] rounded-2xl border border-soft bg-header-theme/95 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-bold text-main">Diseño</p><p className="text-[10px] text-muted2">{selected ? selected.name : "Lienzo"}</p></div>
        <button type="button" onClick={onClose} className={iconButton}><PanelRightClose size={15} /></button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted2">Lienzo</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-[10px] text-muted2">Fondo<input type="color" value={page.backgroundColor || "#ffffff"} onChange={(event) => onUpdatePage({ backgroundColor: event.target.value })} className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-soft bg-transparent p-1" /></label>
            <label className="text-[10px] text-muted2">Ajuste<select value={page.backgroundFit || "stretch"} onChange={(event) => onUpdatePage({ backgroundFit: event.target.value as CreatorCanvasPage["backgroundFit"] })} className={`mt-1 w-full ${fieldClass}`}><option value="stretch">Estirar</option><option value="cover">Cubrir</option><option value="contain">Contener</option></select></label>
          </div>
        </div>

        {selected && (
          <>
            <div className="border-t border-soft pt-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted2">Posición y tamaño</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["x", "y", "width", "height", "rotation"] as const).map((key) => (
                  <label key={key} className="text-[10px] text-muted2">{key.toUpperCase()}<input type="number" value={Math.round((selected as any)[key] || 0)} onChange={(event) => onUpdateElement({ [key]: Number(event.target.value) } as Partial<CreatorCanvasElement>)} className={`mt-1 w-full ${fieldClass}`} /></label>
                ))}
              </div>
            </div>

            {selected.type === "text" && (
              <div className="border-t border-soft pt-4">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted2">Tipografía</p>
                <select value={selected.style?.fontFamily || "Arial"} onChange={(event) => patchStyle({ fontFamily: event.target.value })} className={`mt-2 w-full ${fieldClass}`}>{FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}</select>
                <div className="mt-2 flex items-center gap-1">
                  <input type="number" min={8} max={180} value={styleValue(selected.style?.fontSize, 24)} onChange={(event) => patchStyle({ fontSize: Number(event.target.value) })} className={`w-20 ${fieldClass}`} />
                  <button type="button" onClick={() => patchStyle({ fontWeight: styleValue(selected.style?.fontWeight, 400) >= 700 ? 400 : 800 })} className={`${iconButton} ${styleValue(selected.style?.fontWeight, 400) >= 700 ? "text-blue-600" : ""}`}><Bold size={14} /></button>
                  <button type="button" onClick={() => patchStyle({ fontStyle: selected.style?.fontStyle === "italic" ? "normal" : "italic" })} className={`${iconButton} ${selected.style?.fontStyle === "italic" ? "text-blue-600" : ""}`}><Italic size={14} /></button>
                  <button type="button" onClick={() => patchStyle({ textDecoration: selected.style?.textDecoration === "underline" ? "none" : "underline" })} className={`${iconButton} ${selected.style?.textDecoration === "underline" ? "text-blue-600" : ""}`}><Underline size={14} /></button>
                  <button type="button" onClick={() => patchStyle({ textAlign: "left" })} className={`${iconButton} ${selected.style?.textAlign === "left" ? "text-blue-600" : ""}`}><AlignLeft size={14} /></button>
                  <button type="button" onClick={() => patchStyle({ textAlign: "center" })} className={`${iconButton} ${selected.style?.textAlign === "center" ? "text-blue-600" : ""}`}><AlignCenter size={14} /></button>
                  <button type="button" onClick={() => patchStyle({ textAlign: "right" })} className={`${iconButton} ${selected.style?.textAlign === "right" ? "text-blue-600" : ""}`}><AlignRight size={14} /></button>
                </div>
              </div>
            )}

            <div className="border-t border-soft pt-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted2">Colores y borde</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {selected.type === "text" && <label className="text-[10px] text-muted2">Texto<input type="color" value={selected.style?.color || "#172033"} onChange={(event) => patchStyle({ color: event.target.value })} className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-soft bg-transparent p-1" /></label>}
                <label className="text-[10px] text-muted2">Relleno<input type="color" value={(selected.style?.backgroundColor || "#ffffff").startsWith("#") ? selected.style?.backgroundColor || "#ffffff" : "#ffffff"} onChange={(event) => patchStyle({ backgroundColor: event.target.value })} className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-soft bg-transparent p-1" /></label>
                <label className="text-[10px] text-muted2">Borde<input type="color" value={(selected.style?.borderColor || "#d7dee8").startsWith("#") ? selected.style?.borderColor || "#d7dee8" : "#d7dee8"} onChange={(event) => patchStyle({ borderColor: event.target.value })} className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-soft bg-transparent p-1" /></label>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-[10px] text-muted2">Opacidad<input type="number" min={0} max={100} value={Math.round((selected.style?.opacity ?? 1) * 100)} onChange={(event) => patchStyle({ opacity: Number(event.target.value) / 100 })} className={`mt-1 w-full ${fieldClass}`} /></label>
                <label className="text-[10px] text-muted2">Borde<input type="number" min={0} max={20} value={selected.style?.borderWidth || 0} onChange={(event) => patchStyle({ borderWidth: Number(event.target.value) })} className={`mt-1 w-full ${fieldClass}`} /></label>
                <label className="text-[10px] text-muted2">Radio<input type="number" min={0} max={999} value={selected.style?.borderRadius || 0} onChange={(event) => patchStyle({ borderRadius: Number(event.target.value) })} className={`mt-1 w-full ${fieldClass}`} /></label>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

function LayersPanel({
  page,
  selectedId,
  onSelect,
  onUpdate,
  onReorder,
  onClose,
}: {
  page: CreatorCanvasPage
  selectedId: string | null
  onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<CreatorCanvasElement>) => void
  onReorder: (id: string, direction: "front" | "back" | "forward" | "backward") => void
  onClose: () => void
}) {
  const elements = [...page.elements].sort((a, b) => b.zIndex - a.zIndex)
  return (
    <aside className="absolute left-3 top-14 z-[120] w-[300px] max-w-[calc(100%-24px)] rounded-2xl border border-soft bg-header-theme/95 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-main">Capas</p><p className="text-[10px] text-muted2">{elements.length} elementos</p></div><button type="button" onClick={onClose} className={iconButton}><PanelRightClose size={15} /></button></div>
      <div className="mt-3 max-h-[520px] space-y-1 overflow-y-auto pr-1">
        {elements.map((element) => (
          <div key={element.id} className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 ${selectedId === element.id ? "border-blue-500/30" : "border-transparent"}`}>
            <button type="button" onClick={() => onSelect(element.id)} className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold text-sub">{element.type === "text" ? "T" : element.type === "image" ? "▧" : "◇"} {element.name}</button>
            <button type="button" onClick={() => onUpdate(element.id, { hidden: !element.hidden })} className={iconButton}>{element.hidden ? <EyeOff size={12} /> : <Eye size={12} />}</button>
            <button type="button" onClick={() => onUpdate(element.id, { locked: !element.locked })} className={iconButton}>{element.locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
            <button type="button" onClick={() => onReorder(element.id, "forward")} className={iconButton}><ArrowUpToLine size={12} /></button>
            <button type="button" onClick={() => onReorder(element.id, "backward")} className={iconButton}><ArrowDownToLine size={12} /></button>
          </div>
        ))}
      </div>
    </aside>
  )
}

export function VisualCanvasRenderer({ data, pageIndex = 0, scale = 1 }: { data: any; pageIndex?: number; scale?: number }) {
  const page = data?._canvas?.pages?.[pageIndex] as CreatorCanvasPage | undefined
  if (!page) return null
  return (
    <div style={{ width: page.width * scale, height: page.height * scale }}>
      <div
        className="relative overflow-hidden shadow-sm"
        style={{
          width: page.width,
          height: page.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundColor: page.backgroundColor || "#ffffff",
          backgroundImage: page.backgroundImageUrl ? `url(${page.backgroundImageUrl})` : undefined,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: fitStyle(page.backgroundFit),
        }}
      >
        {[...page.elements].sort((a, b) => a.zIndex - b.zIndex).map((element) => (
          <div key={element.id} style={elementCss(element)}>{element.type === "image" && element.src ? <img src={element.src} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" /> : element.type === "text" ? <div className="h-full w-full">{element.text}</div> : null}</div>
        ))}
      </div>
    </div>
  )
}

export default function DirectVisualCanvasEditor({
  data,
  pageIndex = 0,
  onChange,
}: {
  data: any
  pageIndex?: number
  onChange: (next: any) => void
}) {
  const [working, setWorking] = useState(data)
  const workingRef = useRef(data)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.72)
  const [showLayers, setShowLayers] = useState(false)
  const [showStyle, setShowStyle] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const gestureRef = useRef<null | {
    mode: "move" | "resize" | "rotate"
    elementId: string
    startX: number
    startY: number
    origin: CreatorCanvasElement
    centerX?: number
    centerY?: number
  }>(null)
  const historyRef = useRef<any[]>([structuredClone(data)])
  const historyIndexRef = useRef(0)

  useEffect(() => {
    setWorking(data)
    workingRef.current = data
  }, [data])

  const page = working?._canvas?.pages?.[pageIndex] as CreatorCanvasPage | undefined
  const selected = useMemo(() => page?.elements.find((element) => element.id === selectedId), [page, selectedId])

  const setDraft = (next: any) => {
    workingRef.current = next
    setWorking(next)
  }

  const commit = (next: any, addHistory = true) => {
    setDraft(next)
    onChange(next)
    if (!addHistory) return
    const history = historyRef.current.slice(0, historyIndexRef.current + 1)
    history.push(structuredClone(next))
    historyRef.current = history.slice(-60)
    historyIndexRef.current = historyRef.current.length - 1
  }

  const undo = () => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current -= 1
    const next = structuredClone(historyRef.current[historyIndexRef.current])
    setDraft(next)
    onChange(next)
  }

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    const next = structuredClone(historyRef.current[historyIndexRef.current])
    setDraft(next)
    onChange(next)
  }

  const patchElement = (id: string, patch: Partial<CreatorCanvasElement>, save = true) => {
    const next = updateCanvasElement(workingRef.current, pageIndex, id, patch)
    if (save) commit(next)
    else setDraft(next)
  }

  const patchSelected = (patch: Partial<CreatorCanvasElement>) => {
    if (!selectedId) return
    patchElement(selectedId, patch)
  }

  const patchPage = (patch: Partial<CreatorCanvasPage>) => commit(updateCanvasPage(workingRef.current, pageIndex, patch))

  const startGesture = (mode: "move" | "resize" | "rotate", element: CreatorCanvasElement, event: ReactPointerEvent) => {
    if (element.locked) return
    const centerX = element.x + element.width / 2
    const centerY = element.y + element.height / 2
    gestureRef.current = { mode, elementId: element.id, startX: event.clientX, startY: event.clientY, origin: structuredClone(element), centerX, centerY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture) return
      const dx = (event.clientX - gesture.startX) / zoom
      const dy = (event.clientY - gesture.startY) / zoom
      let patch: Partial<CreatorCanvasElement> = {}
      if (gesture.mode === "move") patch = { x: Math.round(gesture.origin.x + dx), y: Math.round(gesture.origin.y + dy) }
      if (gesture.mode === "resize") patch = { width: Math.max(40, Math.round(gesture.origin.width + dx)), height: Math.max(30, Math.round(gesture.origin.height + dy)) }
      if (gesture.mode === "rotate") {
        const angle = Math.atan2(event.clientY - (gesture.centerY || 0), event.clientX - (gesture.centerX || 0)) * 180 / Math.PI
        patch = { rotation: Math.round(angle + 90) }
      }
      patchElement(gesture.elementId, patch, false)
    }
    const up = () => {
      if (!gestureRef.current) return
      gestureRef.current = null
      commit(workingRef.current)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  }, [zoom])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!selectedId || editingId) return
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        commit(removeCanvasElement(workingRef.current, pageIndex, selectedId))
        setSelectedId(null)
        return
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        const current = workingRef.current?._canvas?.pages?.[pageIndex]?.elements?.find((element: CreatorCanvasElement) => element.id === selectedId)
        if (!current || current.locked) return
        const x = current.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0)
        const y = current.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0)
        patchElement(selectedId, { x, y })
      }
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [editingId, pageIndex, selectedId])

  if (!page) return <div className="rounded-2xl border border-dashed border-soft p-10 text-center text-sm text-muted2">No hay lienzo disponible.</div>

  const addText = () => {
    const element = createTextCanvasElement(page)
    commit(addCanvasElement(workingRef.current, pageIndex, element))
    setSelectedId(element.id)
    setEditingId(element.id)
  }

  const addShape = (shape: CreatorCanvasShape) => {
    const element = createShapeCanvasElement(page, shape)
    commit(addCanvasElement(workingRef.current, pageIndex, element))
    setSelectedId(element.id)
  }

  const addImage = (file: File) => {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => {
      const element = createImageCanvasElement(page, String(reader.result || ""))
      commit(addCanvasElement(workingRef.current, pageIndex, element))
      setSelectedId(element.id)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-soft bg-app">
      <div className="flex min-h-12 flex-wrap items-center gap-0.5 border-b border-soft px-2 py-1.5">
        <button type="button" onClick={undo} className={iconButton} title="Deshacer"><Undo2 size={15} /></button>
        <button type="button" onClick={redo} className={iconButton} title="Rehacer"><Redo2 size={15} /></button>
        <span className="mx-1 h-5 w-px bg-[var(--border-soft)]" />
        <button type="button" onClick={addText} className={toolButton}><Type size={15} /> Texto</button>
        <button type="button" onClick={() => addShape("rectangle")} className={toolButton}><Square size={15} /> Cuadro</button>
        <button type="button" onClick={() => addShape("circle")} className={toolButton}><Circle size={15} /> Círculo</button>
        <button type="button" onClick={() => addShape("line")} className={toolButton}><Minus size={15} /> Línea</button>
        <button type="button" onClick={() => fileRef.current?.click()} className={toolButton}><ImageIcon size={15} /> Imagen</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) addImage(file); event.currentTarget.value = "" }} />
        <span className="mx-1 h-5 w-px bg-[var(--border-soft)]" />
        <button type="button" onClick={() => { setShowLayers((current) => !current); setShowStyle(false) }} className={`${toolButton} ${showLayers ? "text-blue-600" : ""}`}><Layers3 size={15} /> Capas</button>
        <button type="button" onClick={() => { setShowStyle((current) => !current); setShowLayers(false) }} className={`${toolButton} ${showStyle ? "text-blue-600" : ""}`}><Palette size={15} /> Diseño</button>
        <span className="mx-1 h-5 w-px bg-[var(--border-soft)]" />
        <button type="button" onClick={() => selectedId && commit(duplicateCanvasElement(workingRef.current, pageIndex, selectedId))} disabled={!selectedId} className={iconButton} title="Duplicar"><Copy size={15} /></button>
        <button type="button" onClick={() => selectedId && commit(reorderCanvasElement(workingRef.current, pageIndex, selectedId, "front"))} disabled={!selectedId} className={iconButton} title="Traer al frente"><BringToFront size={15} /></button>
        <button type="button" onClick={() => selectedId && commit(reorderCanvasElement(workingRef.current, pageIndex, selectedId, "back"))} disabled={!selectedId} className={iconButton} title="Enviar al fondo"><SendToBack size={15} /></button>
        <button type="button" onClick={() => selectedId && patchSelected({ locked: !selected?.locked })} disabled={!selectedId} className={iconButton} title="Bloquear">{selected?.locked ? <Unlock size={15} /> : <Lock size={15} />}</button>
        <button type="button" onClick={() => { if (!selectedId) return; commit(removeCanvasElement(workingRef.current, pageIndex, selectedId)); setSelectedId(null) }} disabled={!selectedId} className={`${iconButton} text-red-500`} title="Eliminar"><Trash2 size={15} /></button>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.35, Number((value - 0.1).toFixed(2))))} className={iconButton}><ZoomOut size={15} /></button>
          <span className="w-11 text-center text-[10px] font-bold text-muted2">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.5, Number((value + 0.1).toFixed(2))))} className={iconButton}><ZoomIn size={15} /></button>
        </div>
      </div>

      {showLayers && <LayersPanel page={page} selectedId={selectedId} onSelect={setSelectedId} onUpdate={(id, patch) => patchElement(id, patch)} onReorder={(id, direction) => commit(reorderCanvasElement(workingRef.current, pageIndex, id, direction))} onClose={() => setShowLayers(false)} />}
      {showStyle && <StylePanel page={page} selected={selected} onUpdateElement={patchSelected} onUpdatePage={patchPage} onClose={() => setShowStyle(false)} />}

      <div className="max-h-[calc(100vh-190px)] min-h-[620px] overflow-auto p-6" onPointerDown={() => { setSelectedId(null); setEditingId(null) }}>
        <div className="mx-auto" style={{ width: page.width * zoom, height: page.height * zoom }}>
          <div
            id="creator-canvas-surface"
            className="relative overflow-hidden shadow-2xl"
            style={{
              width: page.width,
              height: page.height,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              backgroundColor: page.backgroundColor || "#ffffff",
              backgroundImage: page.backgroundImageUrl ? `url(${page.backgroundImageUrl})` : undefined,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundSize: fitStyle(page.backgroundFit),
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {[...page.elements].sort((a, b) => a.zIndex - b.zIndex).map((element) => (
              <RenderElement
                key={element.id}
                element={element}
                selected={selectedId === element.id}
                editing={editingId === element.id}
                onSelect={() => setSelectedId(element.id)}
                onStartMove={(event) => startGesture("move", element, event)}
                onStartResize={(event) => startGesture("resize", element, event)}
                onStartRotate={(event) => startGesture("rotate", element, event)}
                onStartEditing={() => setEditingId(element.id)}
                onTextCommit={(text) => {
                  setEditingId(null)
                  patchElement(element.id, { text })
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-soft px-3 py-2 text-[10px] text-muted2"><Move size={12} /> Arrastra para mover · doble clic para editar texto · usa las esquinas para cambiar tamaño.</div>
    </div>
  )
}
