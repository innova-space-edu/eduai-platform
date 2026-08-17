"use client"

import {
  ArrowLeft, BookOpen, Box, Brush, Camera, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Cloud, CloudOff, Copy, Download, Eraser, Expand, FileJson, FileText, Grid3X3, Highlighter,
  Image as ImageIcon, Layers, LoaderCircle, Minimize2, MousePointer2, Palette, Plus, Redo2,
  RotateCw, Save, Shapes, Sparkles, Square, Trash2, Type, Undo2, Upload, X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"

const W = 1400
const H = 1050
const CURRENT = "eduai-digital-whiteboard-current-v4"
const LIBRARY = "eduai-digital-whiteboard-library-v4"
const OLD_CURRENT = ["eduai-digital-whiteboard-current-v3", "eduai-whiteboard-math-current-v2", "eduai-whiteboard-current-notebook"]
const OLD_LIBRARY = ["eduai-digital-whiteboard-library-v3", "eduai-whiteboard-math-library-v2", "eduai-whiteboard-saved-notebooks"]
const button = "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition disabled:opacity-35"

type Point = { x: number; y: number }
type Vec3 = { x: number; y: number; z: number }
type Stroke = { id: string; points: Point[]; color: string; width: number; opacity: number }
type Tool = "select" | "pen" | "marker" | "eraser"
type Background = "plain" | "ruled" | "grid" | "dots" | "black" | "blue"
type Tab = "background" | "2d" | "3d" | "graphs" | "media"
type AiVisualMode = "image" | "sticker"
type ShapeName = "rectangle" | "square" | "circle" | "ellipse" | "triangle" | "diamond" | "pentagon" | "hexagon" | "star" | "line" | "arrow" | "vector" | "angle" | "cube" | "prism" | "pyramid" | "tetrahedron" | "triangular-prism" | "cylinder" | "cone" | "sphere"
type GraphName = "axes2d" | "axes3d" | "polar" | "number-line" | "science"
type Plot3DKind = "line" | "curve" | "surface" | "vector" | "points" | "solid"
type Base = { id: string; x: number; y: number; width: number; height: number; opacity: number; createdAt: string; parentId?: string | null }
type Rotation3D = { rotationX: number; rotationY: number; rotationZ: number }
type ShapeItem = Base & Rotation3D & { kind: "shape"; shape: ShapeName; stroke: string; fill: string; strokeWidth: number }
type GraphItem = Base & Rotation3D & { kind: "graph"; graph: GraphName; fill: string }
type Plot3DItem = Base & { kind: "plot3d"; plot: Plot3DKind; color: string; strokeWidth: number; expression: string }
type ImageItem = Base & { kind: "image"; src: string; alt: string }
type TextItem = Base & { kind: "text"; text: string; color: string; fontSize: number; fontWeight: number; align: "left" | "center" | "right" }
type Settings = { id: string; kind: "page-settings"; background: Background; createdAt: string }
type Item = ShapeItem | GraphItem | Plot3DItem | ImageItem | TextItem
type Block = Item | Settings
type Page = { id: string; title: string; strokes: Stroke[]; blocks: Block[]; activeBlockId: string | null; canvasHeight: number; createdAt: string; updatedAt: string }
type Notebook = { id: string; title: string; folder: string; pages: Page[]; activePageId: string; createdAt: string; updatedAt: string; cloudSyncedAt?: string | null }
type Saved = { id: string; title: string; folder: string; pageCount: number; updatedAt: string; source: "cloud" | "local" }
type Interaction = { mode: "drag" | "resize" | "rotate"; item: Item; start: Point; page: Page }

const backgrounds: { id: Background; label: string }[] = [
  { id: "plain", label: "Blanco" }, { id: "ruled", label: "Clásico" }, { id: "grid", label: "Cuadrícula" },
  { id: "dots", label: "Puntos" }, { id: "black", label: "Negro" }, { id: "blue", label: "Azul" },
]
const shapes2d: [ShapeName, string][] = [
  ["rectangle", "Rectángulo"], ["square", "Cuadrado"], ["circle", "Círculo"], ["ellipse", "Elipse"],
  ["triangle", "Triángulo"], ["diamond", "Rombo"], ["pentagon", "Pentágono"], ["hexagon", "Hexágono"],
  ["star", "Estrella"], ["line", "Recta"], ["arrow", "Flecha"], ["vector", "Vector"], ["angle", "Ángulo"],
]
const shapes3d: [ShapeName, string][] = [
  ["cube", "Cubo"], ["prism", "Prisma rectangular"], ["pyramid", "Pirámide"], ["tetrahedron", "Tetraedro"],
  ["triangular-prism", "Prisma triangular"], ["cylinder", "Cilindro"], ["cone", "Cono"], ["sphere", "Esfera"],
]
const graphs: [GraphName, string][] = [
  ["axes2d", "Plano cartesiano 2D"], ["axes3d", "Sistema de ejes 3D"], ["polar", "Plano polar"],
  ["number-line", "Recta numérica"], ["science", "Gráfico científico"],
]
const plotTemplates: [Plot3DKind, string, string][] = [
  ["line", "Recta 3D", "0"], ["curve", "Curva helicoidal", "0"], ["surface", "Superficie parabólica", "x^2+y^2"],
  ["vector", "Vector 3D", "0"], ["points", "Nube de puntos", "0"], ["solid", "Figura dentro", "0"],
]
const is3DShape = (shape: ShapeName) => shapes3d.some(([name]) => name === shape)
const isContainer = (item: Item | null): item is ShapeItem | GraphItem => Boolean(item && ((item.kind === "shape" && is3DShape(item.shape)) || (item.kind === "graph" && item.graph === "axes3d")))
const isRotatable = (item: Item | null): item is ShapeItem | GraphItem => isContainer(item)
const now = () => new Date().toISOString()
function id() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16); return (c === "x" ? r : (r & 3) | 8).toString(16)
  })
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const number = (value: unknown, fallback: number) => Number.isFinite(value) ? Number(value) : fallback
function newPage(index: number): Page {
  const timestamp = now()
  return { id: id(), title: `Página ${index + 1}`, strokes: [], blocks: [{ id: id(), kind: "page-settings", background: "grid", createdAt: timestamp }], activeBlockId: null, canvasHeight: H, createdAt: timestamp, updatedAt: timestamp }
}
function newNotebook(): Notebook {
  const timestamp = now(), page = newPage(0)
  return { id: id(), title: "Mi cuaderno digital", folder: "Mis cuadernos", pages: [page], activePageId: page.id, createdAt: timestamp, updatedAt: timestamp, cloudSyncedAt: null }
}
function normalizeStroke(value: any, index: number): Stroke | null {
  if (!value || !Array.isArray(value.points)) return null
  const points = value.points.filter((p: any) => Number.isFinite(p?.x) && Number.isFinite(p?.y)).map((p: any) => ({ x: p.x, y: p.y }))
  return points.length ? { id: typeof value.id === "string" ? value.id : `s-${index}-${id()}`, points, color: typeof value.color === "string" ? value.color : "#0f172a", width: Math.max(1, number(value.width, 4)), opacity: Math.max(.1, Math.min(1, number(value.opacity, 1))) } : null
}
function normalizeBlock(value: any): Block | null {
  if (!value || typeof value.id !== "string") return null
  if (value.kind === "page-settings") return { id: value.id, kind: "page-settings", background: backgrounds.some((b) => b.id === value.background) ? value.background : "grid", createdAt: value.createdAt || now() }
  const base = { id: value.id, x: number(value.x, 80), y: number(value.y, 80), width: Math.max(40, number(value.width, 260)), height: Math.max(40, number(value.height, 190)), opacity: Math.max(.1, Math.min(1, number(value.opacity, 1))), createdAt: value.createdAt || now(), parentId: typeof value.parentId === "string" ? value.parentId : null }
  if (value.kind === "image" && typeof value.src === "string") return { ...base, kind: "image", src: value.src, alt: String(value.alt || "Imagen") }
  if (value.kind === "text") return { ...base, kind: "text", text: String(value.text || "Texto"), color: String(value.color || "#0f172a"), fontSize: Math.max(12, Math.min(100, number(value.fontSize, 32))), fontWeight: number(value.fontWeight, 500), align: ["left", "center", "right"].includes(value.align) ? value.align : "left" }
  if (value.kind === "shape" && [...shapes2d, ...shapes3d].some(([shape]) => shape === value.shape)) return { ...base, kind: "shape", shape: value.shape, stroke: String(value.stroke || "#2563eb"), fill: String(value.fill || "transparent"), strokeWidth: Math.max(1, Math.min(16, number(value.strokeWidth, 4))), rotationX: number(value.rotationX, 18), rotationY: number(value.rotationY, -24), rotationZ: number(value.rotationZ, 0) }
  if (value.kind === "graph" && graphs.some(([graph]) => graph === value.graph)) return { ...base, kind: "graph", graph: value.graph, fill: String(value.fill || "#ffffff"), rotationX: number(value.rotationX, 28), rotationY: number(value.rotationY, -28), rotationZ: number(value.rotationZ, 0) }
  if (value.kind === "plot3d" && plotTemplates.some(([plot]) => plot === value.plot)) return { ...base, kind: "plot3d", plot: value.plot, color: String(value.color || "#7c3aed"), strokeWidth: Math.max(1, Math.min(12, number(value.strokeWidth, 4))), expression: String(value.expression || "x^2+y^2") }
  return null
}
function normalizePage(value: any, index: number): Page | null {
  if (!value || typeof value !== "object") return null
  const timestamp = now()
  const strokes = Array.isArray(value.strokes) ? value.strokes.map(normalizeStroke).filter(Boolean) as Stroke[] : []
  const blocks = Array.isArray(value.blocks) ? value.blocks.map(normalizeBlock).filter(Boolean) as Block[] : []
  if (!blocks.some((b) => b.kind === "page-settings")) blocks.unshift({ id: id(), kind: "page-settings", background: "grid", createdAt: timestamp })
  const ids = new Set(blocks.filter((b): b is Item => b.kind !== "page-settings").map((b) => b.id))
  for (const block of blocks) if (block.kind !== "page-settings" && block.parentId && !ids.has(block.parentId)) block.parentId = null
  return { id: typeof value.id === "string" ? value.id : id(), title: String(value.title || `Página ${index + 1}`), strokes, blocks, activeBlockId: typeof value.activeBlockId === "string" && ids.has(value.activeBlockId) ? value.activeBlockId : null, canvasHeight: Math.max(H, number(value.canvasHeight, H)), createdAt: value.createdAt || timestamp, updatedAt: value.updatedAt || timestamp }
}
function normalizeNotebook(value: any): Notebook | null {
  if (!value || typeof value !== "object") return null
  let pages = Array.isArray(value.pages) ? value.pages.map(normalizePage).filter(Boolean) as Page[] : []
  if (!pages.length && Array.isArray(value.strokes)) { const p = normalizePage({ id: id(), title: "Página 1", strokes: value.strokes, blocks: [] }, 0); if (p) pages = [p] }
  if (!pages.length) return null
  return { id: typeof value.id === "string" ? value.id : id(), title: String(value.title || "Mi cuaderno digital"), folder: String(value.folder || "Mis cuadernos"), pages, activePageId: typeof value.activePageId === "string" && pages.some((p) => p.id === value.activePageId) ? value.activePageId : pages[0].id, createdAt: value.createdAt || now(), updatedAt: value.updatedAt || now(), cloudSyncedAt: typeof value.cloudSyncedAt === "string" ? value.cloudSyncedAt : null }
}
function firstLocal(keys: string[]) { for (const key of keys) { const value = localStorage.getItem(key); if (value) return value } return null }
function localLibrary(): Notebook[] {
  try { const parsed = JSON.parse(localStorage.getItem(LIBRARY) || firstLocal(OLD_LIBRARY) || "[]"); return Array.isArray(parsed) ? parsed.map(normalizeNotebook).filter(Boolean) as Notebook[] : [] } catch { return [] }
}
function saveLocal(notebook: Notebook) {
  try { localStorage.setItem(CURRENT, JSON.stringify(notebook)); localStorage.setItem(LIBRARY, JSON.stringify([notebook, ...localLibrary().filter((n) => n.id !== notebook.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 40))); return true } catch { return false }
}
const itemsOf = (page: Page) => page.blocks.filter((b): b is Item => b.kind !== "page-settings")
const backgroundOf = (page: Page): Background => (page.blocks.find((b): b is Settings => b.kind === "page-settings")?.background || "grid")
const poly = (sides: number, w: number, h: number, rotation = -Math.PI / 2) => Array.from({ length: sides }, (_, i) => { const a = rotation + i * Math.PI * 2 / sides; return `${w / 2 + Math.cos(a) * (w / 2 - 5)},${h / 2 + Math.sin(a) * (h / 2 - 5)}` }).join(" ")
const star = (w: number, h: number) => Array.from({ length: 10 }, (_, i) => { const r = (i % 2 ? .22 : .47) * Math.min(w, h), a = -Math.PI / 2 + i * Math.PI / 5; return `${w / 2 + Math.cos(a) * r},${h / 2 + Math.sin(a) * r}` }).join(" ")
const radians = (degrees: number) => degrees * Math.PI / 180
function rotate3D(point: Vec3, rotation: Rotation3D): Vec3 {
  const rx = radians(rotation.rotationX), ry = radians(rotation.rotationY), rz = radians(rotation.rotationZ)
  let { x, y, z } = point
  ;[y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)]
  ;[x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)]
  ;[x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)]
  return { x, y, z }
}
function project3D(point: Vec3, width: number, height: number, rotation: Rotation3D): Point {
  const p = rotate3D(point, rotation), perspective = 4.4 / Math.max(1.4, 4.4 - p.z), scale = Math.min(width, height) * .34
  return { x: width / 2 + p.x * scale * perspective, y: height / 2 - p.y * scale * perspective }
}
const segment = (a: Vec3, b: Vec3, w: number, h: number, rotation: Rotation3D) => { const p1 = project3D(a, w, h, rotation), p2 = project3D(b, w, h, rotation); return { p1, p2 } }
function Wireframe3D({ item }: { item: ShapeItem }) {
  const { width: w, height: h, stroke, strokeWidth, shape } = item
  const rotation = item, lines: [Vec3, Vec3][] = []
  const addEdges = (vertices: Vec3[], edges: [number, number][]) => edges.forEach(([a, b]) => lines.push([vertices[a], vertices[b]]))
  if (shape === "cube" || shape === "prism") {
    const sx = shape === "prism" ? 1.35 : 1, vertices = [
      { x: -sx, y: -1, z: -1 }, { x: sx, y: -1, z: -1 }, { x: sx, y: 1, z: -1 }, { x: -sx, y: 1, z: -1 },
      { x: -sx, y: -1, z: 1 }, { x: sx, y: -1, z: 1 }, { x: sx, y: 1, z: 1 }, { x: -sx, y: 1, z: 1 },
    ]
    addEdges(vertices, [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]])
  } else if (shape === "pyramid") {
    const vertices = [{ x:-1,y:-1,z:-1 },{ x:1,y:-1,z:-1 },{ x:1,y:-1,z:1 },{ x:-1,y:-1,z:1 },{ x:0,y:1.25,z:0 }]
    addEdges(vertices, [[0,1],[1,2],[2,3],[3,0],[0,4],[1,4],[2,4],[3,4]])
  } else if (shape === "tetrahedron") {
    const vertices = [{ x:0,y:1.25,z:0 },{ x:-1,y:-.9,z:-.75 },{ x:1,y:-.9,z:-.75 },{ x:0,y:-.9,z:1 }]
    addEdges(vertices, [[0,1],[0,2],[0,3],[1,2],[2,3],[3,1]])
  } else if (shape === "triangular-prism") {
    const vertices = [{ x:-1,y:-1,z:-.8 },{ x:0,y:1,z:-.8 },{ x:1,y:-1,z:-.8 },{ x:-1,y:-1,z:.8 },{ x:0,y:1,z:.8 },{ x:1,y:-1,z:.8 }]
    addEdges(vertices, [[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[0,3],[1,4],[2,5]])
  } else if (shape === "cylinder" || shape === "cone") {
    const n = 18, bottom = Array.from({ length: n }, (_, i) => ({ x: Math.cos(i * Math.PI * 2 / n), y: -1, z: Math.sin(i * Math.PI * 2 / n) })), top = shape === "cylinder" ? Array.from({ length: n }, (_, i) => ({ x: Math.cos(i * Math.PI * 2 / n), y: 1, z: Math.sin(i * Math.PI * 2 / n) })) : [{ x:0,y:1.25,z:0 }]
    for (let i = 0; i < n; i++) { lines.push([bottom[i], bottom[(i + 1) % n]]); if (shape === "cylinder") lines.push([top[i], top[(i + 1) % n]]); if (i % 3 === 0) lines.push([bottom[i], shape === "cylinder" ? top[i] : top[0]]) }
  } else if (shape === "sphere") {
    const paths: Vec3[][] = []
    for (const latitude of [-.65, 0, .65]) { const r = Math.sqrt(1 - latitude * latitude); paths.push(Array.from({ length: 37 }, (_, i) => ({ x: r * Math.cos(i * Math.PI * 2 / 36), y: latitude, z: r * Math.sin(i * Math.PI * 2 / 36) }))) }
    for (const longitude of [0, Math.PI / 3, Math.PI * 2 / 3]) paths.push(Array.from({ length: 37 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 36; return { x: Math.cos(a) * Math.cos(longitude), y: Math.sin(a), z: Math.cos(a) * Math.sin(longitude) } }))
    return <g fill="none" stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke">{paths.map((path, index) => <polyline key={index} points={path.map((p) => { const q = project3D(p, w, h, rotation); return `${q.x},${q.y}` }).join(" ")} />)}</g>
  }
  return <g fill="none" stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke">{lines.map(([a,b], index) => { const { p1, p2 } = segment(a,b,w,h,rotation); return <line key={index} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} /> })}</g>
}
function ShapeArt({ item }: { item: ShapeItem }) {
  const { width:w,height:h,stroke,fill,strokeWidth:sw,shape }=item
  const p={fill,stroke,strokeWidth:sw,vectorEffect:"non-scaling-stroke" as const}
  if(["rectangle","square"].includes(shape))return <rect x={5} y={5} width={w-10} height={h-10} rx={shape==="square"?2:12}{...p}/>
  if(["circle","ellipse"].includes(shape))return <ellipse cx={w/2} cy={h/2} rx={w/2-5} ry={h/2-5}{...p}/>
  if(shape==="triangle")return <polygon points={`${w/2},5 ${w-5},${h-5} 5,${h-5}`}{...p}/>
  if(shape==="diamond")return <polygon points={`${w/2},5 ${w-5},${h/2} ${w/2},${h-5} 5,${h/2}`}{...p}/>
  if(["pentagon","hexagon"].includes(shape))return <polygon points={poly(shape==="pentagon"?5:6,w,h)}{...p}/>
  if(shape==="star")return <polygon points={star(w,h)}{...p}/>
  if(["line","arrow","vector"].includes(shape))return <g fill="none" stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke"><line x1={8} y1={h*.58} x2={w-8} y2={h*.58}/>{shape!=="line"&&<polyline points={`${w-35},${h*.42} ${w-8},${h*.58} ${w-35},${h*.74}`}/>} {shape==="vector"&&<text x={w*.45} y={h*.42} fill={stroke} stroke="none" fontSize={26} fontWeight={800}>v⃗</text>}</g>
  if(shape==="angle")return <g fill="none" stroke={stroke} strokeWidth={sw}><polyline points={`${w*.12},${h*.82} ${w*.5},${h*.38} ${w*.9},${h*.78}`}/><path d={`M ${w*.35} ${h*.58} A ${w*.2} ${h*.2} 0 0 1 ${w*.66} ${h*.57}`}/></g>

  const tint=fill==="transparent"?"#bfdbfe":fill
  const gradientId=`solid-gradient-${item.id}`, sphereId=`sphere-gradient-${item.id}`
  const point=(value:Vec3)=>segment(value,value,w,h,item).p1
  const path=(points:Vec3[])=>points.map((value,index)=>{const q=point(value);return `${index?"L":"M"} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`}).join(" ")
  const edge=(a:Vec3,b:Vec3,key:string|number,dashed=false)=>{const {p1,p2}=segment(a,b,w,h,item);return <line key={key} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={sw} strokeDasharray={dashed?"8 7":undefined} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>}
  const polyhedron=(vertices:Vec3[],edges:[number,number][],faces:number[][])=> <g>
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity={.78}/><stop offset={.48} stopColor={tint} stopOpacity={.34}/><stop offset="1" stopColor={stroke} stopOpacity={.18}/></linearGradient></defs>
    {faces.map((face,index)=><path key={`face-${index}`} d={path([...face.map((vertex)=>vertices[vertex]),vertices[face[0]]])} fill={`url(#${gradientId})`} stroke={stroke} strokeOpacity={.24} strokeWidth={Math.max(1,sw*.45)}/>) }
    {edges.map(([a,b],index)=>edge(vertices[a],vertices[b],index,index%5===4))}
  </g>
  const loop=(points:Vec3[],key:string,opacity=1)=> <path key={key} d={path([...points,points[0]])} fill="none" stroke={stroke} strokeWidth={Math.max(1.2,sw*(opacity<1?.55:.78))} strokeOpacity={opacity} vectorEffect="non-scaling-stroke"/>

  if(shape==="cube"||shape==="prism"){
    const sx=shape==="cube"?.82:1.05,sy=shape==="cube"?.82:.72,sz=shape==="cube"?.82:.62
    const vertices:Vec3[]=[{x:-sx,y:-sy,z:-sz},{x:sx,y:-sy,z:-sz},{x:sx,y:sy,z:-sz},{x:-sx,y:sy,z:-sz},{x:-sx,y:-sy,z:sz},{x:sx,y:-sy,z:sz},{x:sx,y:sy,z:sz},{x:-sx,y:sy,z:sz}]
    return polyhedron(vertices,[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
  }
  if(shape==="pyramid"){
    const vertices:Vec3[]=[{x:-.95,y:.72,z:-.72},{x:.95,y:.72,z:-.72},{x:.95,y:.72,z:.72},{x:-.95,y:.72,z:.72},{x:0,y:-1.08,z:0}]
    return polyhedron(vertices,[[0,1],[1,2],[2,3],[3,0],[0,4],[1,4],[2,4],[3,4]],[[0,1,2,3],[0,1,4],[1,2,4],[2,3,4],[3,0,4]])
  }
  if(shape==="tetrahedron"){
    const vertices:Vec3[]=[{x:0,y:-1.05,z:0},{x:-.95,y:.72,z:-.62},{x:.95,y:.72,z:-.62},{x:0,y:.72,z:.92}]
    return polyhedron(vertices,[[0,1],[0,2],[0,3],[1,2],[2,3],[3,1]],[[0,1,2],[0,2,3],[0,3,1],[1,2,3]])
  }
  if(shape==="triangular-prism"){
    const vertices:Vec3[]=[{x:-.92,y:.72,z:-.58},{x:0,y:-.9,z:-.58},{x:.92,y:.72,z:-.58},{x:-.92,y:.72,z:.58},{x:0,y:-.9,z:.58},{x:.92,y:.72,z:.58}]
    return polyhedron(vertices,[[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[0,3],[1,4],[2,5]],[[0,1,2],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]])
  }
  if(shape==="cylinder"){
    const ring=(y:number)=>Array.from({length:49},(_,i)=>{const angle=i*Math.PI*2/48;return{x:Math.cos(angle)*.88,y,z:Math.sin(angle)*.88}})
    const top=ring(-.82),bottom=ring(.82)
    return <g><defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={.72}/><stop offset=".55" stopColor={tint} stopOpacity={.3}/><stop offset="1" stopColor={stroke} stopOpacity={.14}/></linearGradient></defs><path d={path([...top,...bottom.slice().reverse(),top[0]])} fill={`url(#${gradientId})`} opacity={.7}/>{loop(top,"top")}{loop(bottom,"bottom")}{[0,6,12,18,24,30,36,42].map((i)=>edge(top[i],bottom[i],`side-${i}`,i>18&&i<42))}</g>
  }
  if(shape==="cone"){
    const base=Array.from({length:49},(_,i)=>{const angle=i*Math.PI*2/48;return{x:Math.cos(angle)*.92,y:.78,z:Math.sin(angle)*.92}}),apex:Vec3={x:0,y:-1.08,z:0}
    return <g><defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={.75}/><stop offset=".55" stopColor={tint} stopOpacity={.3}/><stop offset="1" stopColor={stroke} stopOpacity={.15}/></linearGradient></defs><path d={path([apex,...base,apex])} fill={`url(#${gradientId})`} opacity={.72}/>{loop(base,"base")}{[0,8,16,24,32,40].map((i)=>edge(apex,base[i],`ray-${i}`,i>16&&i<40))}</g>
  }
  const latitudes=[-.72,-.42,0,.42,.72].map((latitude)=>Array.from({length:49},(_,i)=>{const angle=i*Math.PI*2/48,r=Math.cos(latitude);return{x:r*Math.cos(angle),y:Math.sin(latitude),z:r*Math.sin(angle)}}))
  const meridians=Array.from({length:8},(_,m)=>{const azimuth=m*Math.PI/8;return Array.from({length:49},(_,i)=>{const angle=-Math.PI/2+i*Math.PI/48;return{x:Math.cos(angle)*Math.cos(azimuth),y:Math.sin(angle),z:Math.cos(angle)*Math.sin(azimuth)}})})
  return <g data-shape-render="sphere-shell"><defs><radialGradient id={sphereId} cx="35%" cy="28%" r="72%"><stop offset="0" stopColor="#fff" stopOpacity={.92}/><stop offset=".42" stopColor={tint} stopOpacity={.38}/><stop offset="1" stopColor={stroke} stopOpacity={.2}/></radialGradient></defs><circle cx={w/2} cy={h/2} r={Math.min(w,h)*.43} fill={`url(#${sphereId})`} stroke={stroke} strokeWidth={sw}/>{latitudes.map((points,index)=>loop(points,`lat-${index}`,index===2?.9:.48))}{meridians.map((points,index)=><path key={`meridian-${index}`} d={path(points)} fill="none" stroke={stroke} strokeWidth={Math.max(1,sw*.52)} strokeOpacity={index%2?.38:.68}/>) }<ellipse cx={w*.39} cy={h*.34} rx={Math.min(w,h)*.1} ry={Math.min(w,h)*.055} fill="#fff" opacity={.36} transform={`rotate(-28 ${w*.39} ${h*.34})`}/></g>
}
function GraphArt({ item }: { item: GraphItem }) {
  const {width:w,height:h,graph}=item,grid="#cbd5e1"
  if(graph==="axes3d"){
    const lines:{a:Vec3;b:Vec3;color:string;width:number;opacity:number;dash?:string}[]=[]
    for(let i=-4;i<=4;i++){const t=i/4;lines.push({a:{x:-1,y:0,z:t},b:{x:1,y:0,z:t},color:"#93c5fd",width:1.3,opacity:.7},{a:{x:t,y:0,z:-1},b:{x:t,y:0,z:1},color:"#93c5fd",width:1.3,opacity:.7},{a:{x:-1,y:t,z:0},b:{x:1,y:t,z:0},color:"#bbf7d0",width:1,opacity:.42},{a:{x:t,y:-1,z:0},b:{x:t,y:1,z:0},color:"#bbf7d0",width:1,opacity:.42},{a:{x:0,y:-1,z:t},b:{x:0,y:1,z:t},color:"#fecaca",width:1,opacity:.34},{a:{x:0,y:t,z:-1},b:{x:0,y:t,z:1},color:"#fecaca",width:1,opacity:.34})}
    const cube: [Vec3,Vec3][]=[];const c=[-1,1]
    for(const y of c)for(const z of c)cube.push([{x:-1,y,z},{x:1,y,z}])
    for(const x of c)for(const z of c)cube.push([{x,y:-1,z},{x,y:1,z}])
    for(const x of c)for(const y of c)cube.push([{x,y,z:-1},{x,y,z:1}])
    const axes:[Vec3,Vec3,string,string][]=[[{x:-1.28,y:0,z:0},{x:1.38,y:0,z:0},"#ef4444","X"],[{x:0,y:-1.28,z:0},{x:0,y:1.38,z:0},"#16a34a","Y"],[{x:0,y:0,z:-1.28},{x:0,y:0,z:1.38},"#2563eb","Z"]]
    return <g data-graph-render="rotatable-3d" fill="none"><defs><radialGradient id={`graph-origin-${item.id}`}><stop offset="0" stopColor="#fff"/><stop offset="1" stopColor="#6366f1"/></radialGradient></defs>{lines.map((line,index)=>{const{p1,p2}=segment(line.a,line.b,w,h,item);return <line key={index} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={line.color} strokeWidth={line.width} strokeOpacity={line.opacity}/>})}{cube.map(([a,b],index)=>{const{p1,p2}=segment(a,b,w,h,item);return <line key={`cube-${index}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#64748b" strokeWidth={1.6} strokeOpacity={.52} strokeDasharray={index%3===0?"7 6":undefined}/>})}{axes.map(([a,b,color,label])=>{const{p1,p2}=segment(a,b,w,h,item);return <g key={label}><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={4.2} strokeLinecap="round"/><circle cx={p2.x} cy={p2.y} r={5} fill={color}/><text x={p2.x+8} y={p2.y-8} fill={color} fontWeight={900} fontSize={17}>{label}</text></g>})}<circle cx={w/2} cy={h/2} r={7} fill={`url(#graph-origin-${item.id})`} stroke="#fff" strokeWidth={2}/></g>
  }
  if(graph==="number-line")return <g><line x1={12} y1={h/2} x2={w-12} y2={h/2} stroke="#334155" strokeWidth={3}/>{Array.from({length:13},(_,i)=>{const x=30+i*(w-60)/12;return <g key={i}><line x1={x} y1={h/2-10} x2={x} y2={h/2+10} stroke="#64748b"/><text x={x} y={h/2+33} textAnchor="middle" fontSize={16} fill="#475569">{i-6}</text></g>})}</g>
  if(graph==="polar")return <g fill="none">{[.25,.5,.75,1].map((r)=><circle key={r} cx={w/2} cy={h/2} r={Math.min(w,h)*.43*r} stroke={grid}/>)}{Array.from({length:12},(_,i)=>{const a=i*Math.PI/6,r=Math.min(w,h)*.43;return <line key={i} x1={w/2} y1={h/2} x2={w/2+Math.cos(a)*r} y2={h/2+Math.sin(a)*r} stroke={i%3?grid:"#64748b"}/>})}<line x1={w*.07} y1={h/2} x2={w*.93} y2={h/2} stroke="#ef4444" strokeWidth={3}/><line x1={w/2} y1={h*.07} x2={w/2} y2={h*.93} stroke="#16a34a" strokeWidth={3}/></g>
  const m=graph==="science"?34:0,pw=w-m*2,ph=h-m*2,ox=graph==="science"?m:w/2,oy=graph==="science"?h-m:h/2
  return <g fill="none">{Array.from({length:11},(_,i)=><line key={`v${i}`} x1={m+i*pw/10} y1={m} x2={m+i*pw/10} y2={m+ph} stroke={grid}/>)}{Array.from({length:9},(_,i)=><line key={`h${i}`} x1={m} y1={m+i*ph/8} x2={m+pw} y2={m+i*ph/8} stroke={grid}/>)}<line x1={m} y1={oy} x2={m+pw} y2={oy} stroke="#ef4444" strokeWidth={3}/><line x1={ox} y1={m} x2={ox} y2={m+ph} stroke="#16a34a" strokeWidth={3}/></g>
}
function compileExpression(expression: string) {
  const text = expression.trim().toLowerCase(), words = text.match(/[a-z]+/g) || [], allowed = new Set(["x","y","sin","cos","tan","sqrt","abs","exp","log","pi"])
  if (!text || !/^[0-9a-z+\-*/^().,\s]+$/.test(text) || words.some((word) => !allowed.has(word))) return (x: number, y: number) => x * x + y * y
  const js = text.replace(/\^/g, "**").replace(/\b(sin|cos|tan|sqrt|abs|exp|log)\b/g, "Math.$1").replace(/\bpi\b/g, "Math.PI")
  try { const fn = new Function("x", "y", `"use strict"; return (${js});`) as (x:number,y:number)=>number; return (x:number,y:number) => { const value = Number(fn(x,y)); return Number.isFinite(value) ? Math.max(-3, Math.min(3, value)) : 0 } } catch { return (x: number, y: number) => x * x + y * y }
}
function Plot3DArt({ item, parent }: { item: Plot3DItem; parent: GraphItem }) {
  const w = parent.width, h = parent.height, rotation = parent, project = (p: Vec3) => project3D(p,w,h,rotation), color = item.color, sw = item.strokeWidth
  if (item.plot === "line" || item.plot === "vector") { const a = project({ x:-1,y:-.7,z:-.5 }), b = project({ x:1,y:.8,z:.75 }); return <g fill="none" stroke={color} strokeWidth={sw}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />{item.plot === "vector" && <polyline points={`${b.x-18},${b.y-5} ${b.x},${b.y} ${b.x-8},${b.y+17}`} />}</g> }
  if (item.plot === "curve") { const points = Array.from({ length: 90 }, (_, i) => { const t = -Math.PI * 2 + i * Math.PI * 4 / 89; return project({ x: Math.cos(t) * .72, y: t / (Math.PI * 2) * .9, z: Math.sin(t) * .72 }) }); return <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth={sw} /> }
  if (item.plot === "points") { return <g fill={color}>{Array.from({ length: 22 }, (_, i) => { const x = Math.sin(i * 7.1) * .95, y = Math.cos(i * 4.7) * .85, z = Math.sin(i * 2.3) * .8, p = project({x,y,z}); return <circle key={i} cx={p.x} cy={p.y} r={4.5} /> })}</g> }
  if (item.plot === "solid") { const vertices = [{x:-.5,y:-.5,z:-.5},{x:.5,y:-.5,z:-.5},{x:.5,y:.5,z:-.5},{x:-.5,y:.5,z:-.5},{x:-.5,y:-.5,z:.5},{x:.5,y:-.5,z:.5},{x:.5,y:.5,z:.5},{x:-.5,y:.5,z:.5}], edges: [number, number][] = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]; return <g fill="none" stroke={color} strokeWidth={sw}>{edges.map(([a,b],i) => { const p=project(vertices[a]), q=project(vertices[b]); return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} /> })}</g> }
  const fn = compileExpression(item.expression), lines: Point[][] = []
  for (let row = 0; row <= 10; row++) { const y = -1.4 + row * .28; lines.push(Array.from({ length: 31 }, (_, i) => { const x = -1.4 + i * 2.8 / 30; return project({ x: x / 1.4, y: fn(x,y) / 3, z: y / 1.4 }) })) }
  for (let column = 0; column <= 10; column++) { const x = -1.4 + column * .28; lines.push(Array.from({ length: 31 }, (_, i) => { const y = -1.4 + i * 2.8 / 30; return project({ x: x / 1.4, y: fn(x,y) / 3, z: y / 1.4 }) })) }
  return <g fill="none" stroke={color} strokeWidth={Math.max(1.2, sw * .55)} strokeOpacity={.92}>{lines.map((line,i) => <polyline key={i} points={line.map((p) => `${p.x},${p.y}`).join(" ")} />)}</g>
}
function BackgroundLayer({ background, height }: { background: Background; height: number }) {
  const base = background === "black" ? "#0b1220" : background === "blue" ? "#0b2a52" : "#fff", dark = background === "black" || background === "blue"
  return <g><rect width={W} height={height} fill={base} />{background === "ruled" && <>{Array.from({ length: Math.ceil(height / 38) }, (_, i) => <line key={i} x1={0} y1={(i + 1) * 38} x2={W} y2={(i + 1) * 38} stroke="#bfdbfe" />)}<line x1={90} y1={0} x2={90} y2={height} stroke="#fda4af" strokeWidth={2} /></>}{(background === "grid" || dark) && <>{Array.from({ length: 51 }, (_, i) => <line key={`v${i}`} x1={i * 28} y1={0} x2={i * 28} y2={height} stroke={dark ? (background === "black" ? "#1e293b" : "#17467a") : "#e2e8f0"} />)}{Array.from({ length: Math.ceil(height / 28) }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 28} x2={W} y2={i * 28} stroke={dark ? (background === "black" ? "#1e293b" : "#17467a") : "#e2e8f0"} />)}</>}{background === "dots" && Array.from({ length: Math.ceil(height / 30) }, (_, r) => Array.from({ length: 47 }, (_, c) => <circle key={`${r}-${c}`} cx={c * 30 + 15} cy={r * 30 + 15} r={1.5} fill="#94a3b8" />))}</g>
}
const distance = (p: Point, a: Point, b: Point) => { const dx = b.x - a.x, dy = b.y - a.y; if (!dx && !dy) return Math.hypot(p.x - a.x, p.y - a.y); const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) }
const hitsStroke = (s: Stroke, p: Point) => s.points.some((point, i) => i > 0 && distance(p, s.points[i - 1], point) < Math.max(18, s.width + 12))
function fileData(file: File) { return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => typeof r.result === "string" ? resolve(r.result) : reject(new Error("Archivo inválido")); r.onerror = () => reject(r.error); r.readAsDataURL(file) }) }
async function compress(src: string) { if (!src.startsWith("data:image/")) return src; return new Promise<string>((resolve) => { const image = new Image(); image.onload = () => { const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight)), canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale)); const ctx = canvas.getContext("2d"); if (!ctx) return resolve(src); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", .8)) }; image.onerror = () => resolve(src); image.src = src }) }

export default function WhiteboardMathStudio() {
  const router = useRouter(), svgRef = useRef<SVGSVGElement>(null), scrollRef = useRef<HTMLDivElement>(null), imageRef = useRef<HTMLInputElement>(null), importRef = useRef<HTMLInputElement>(null), videoRef = useRef<HTMLVideoElement>(null), streamRef = useRef<MediaStream | null>(null), saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null), hydrated = useRef(false), pendingImageParent = useRef<string | null>(null)
  const [notebook, setNotebook] = useState<Notebook>(() => newNotebook()), [tool, setTool] = useState<Tool>("pen"), [color, setColor] = useState("#0f172a"), [width, setWidth] = useState(5), [activeStroke, setActiveStroke] = useState<Stroke | null>(null), [interaction, setInteraction] = useState<Interaction | null>(null), [undoStack, setUndoStack] = useState<Page[]>([]), [redoStack, setRedoStack] = useState<Page[]>([]), [tab, setTab] = useState<Tab>("background"), [panelOpen, setPanelOpen] = useState(false), [zoom, setZoom] = useState(.85), [expanded, setExpanded] = useState(false), [cloud, setCloud] = useState<"idle" | "saving" | "synced" | "local" | "error">("idle"), [showLibrary, setShowLibrary] = useState(false), [saved, setSaved] = useState<Saved[]>([]), [libraryLoading, setLibraryLoading] = useState(false), [showAi, setShowAi] = useState(false), [aiPrompt, setAiPrompt] = useState(""), [aiStyle, setAiStyle] = useState("educational"), [aiLoading, setAiLoading] = useState(false), [aiError, setAiError] = useState(""), [aiMode, setAiMode] = useState<AiVisualMode>("image"), [aiPreview, setAiPreview] = useState(""), [camera, setCamera] = useState(false), [cameraError, setCameraError] = useState(""), [exporting, setExporting] = useState(false), [customExpression, setCustomExpression] = useState("sin(x)+cos(y)")
  const page = useMemo(() => notebook.pages.find((p) => p.id === notebook.activePageId) || notebook.pages[0], [notebook]), items = useMemo(() => itemsOf(page), [page]), itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]), selected = items.find((i) => i.id === page.activeBlockId) || null, background = backgroundOf(page), strokes = activeStroke ? [...page.strokes, activeStroke] : page.strokes
  const childrenOf = useCallback((parentId: string) => items.filter((item) => item.parentId === parentId), [items])
  const topItems = useMemo(() => items.filter((item) => !item.parentId || !itemMap.has(item.parentId)), [items, itemMap])
  const absolutePosition = useCallback((item: Item) => { let x = item.x, y = item.y, parentId = item.parentId, guard = 0; while (parentId && guard++ < 12) { const parent = itemMap.get(parentId); if (!parent) break; x += parent.x; y += parent.y; parentId = parent.parentId } return { x, y } }, [itemMap])
  const updatePage = useCallback((pageId: string, fn: (p: Page) => Page) => setNotebook((n) => ({ ...n, pages: n.pages.map((p) => p.id === pageId ? fn(p) : p), updatedAt: now() })), [])
  const noHistory = useCallback((fn: (p: Page) => Page) => updatePage(notebook.activePageId, (p) => ({ ...fn(p), updatedAt: now() })), [notebook.activePageId, updatePage])
  const commit = useCallback((fn: (p: Page) => Page) => { const previous = clone(page), next = { ...fn(clone(page)), updatedAt: now() }; setUndoStack((s) => [...s.slice(-79), previous]); setRedoStack([]); updatePage(page.id, () => next) }, [page, updatePage])
  const point = useCallback((event: ReactPointerEvent<SVGSVGElement | SVGGElement | SVGRectElement>) => { const svg = svgRef.current; if (!svg) return { x: 0, y: 0 }; const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY; const m = svg.getScreenCTM()?.inverse(), result = m ? p.matrixTransform(m) : p; return { x: result.x, y: result.y } }, [])
  const origin = () => { const scroll = scrollRef.current, svg = svgRef.current, scale = svg ? svg.clientWidth / W : 1; return { x: 100, y: Math.max(80, (scroll?.scrollTop || 0) / (scale || 1) + 80) } }

  useEffect(() => { try { const raw = localStorage.getItem(CURRENT) || firstLocal(OLD_CURRENT), restored = raw ? normalizeNotebook(JSON.parse(raw)) : null; if (restored) setNotebook(restored) } catch {} finally { hydrated.current = true } }, [])
  useEffect(() => { if (!hydrated.current) return; const snapshot = { ...notebook, updatedAt: now() }, local = saveLocal(snapshot); setCloud(local ? "local" : "error"); if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(async () => { setCloud("saving"); try { const response = await fetch("/api/whiteboard/notebooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notebook: snapshot }) }); if (!response.ok) throw new Error(); const data = await response.json(), synced = data?.notebook?.cloudSyncedAt || now(); setNotebook((n) => n.id === snapshot.id ? { ...n, cloudSyncedAt: synced } : n); setCloud("synced") } catch { setCloud(local ? "local" : "error") } }, 1700) }, [notebook.activePageId, notebook.pages, notebook.title, notebook.folder])
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); streamRef.current?.getTracks().forEach((t) => t.stop()) }, [])
  useEffect(() => { if (camera && videoRef.current && streamRef.current) { videoRef.current.srcObject = streamRef.current; void videoRef.current.play().catch(() => undefined) } }, [camera])

  const addItem = (item: Item) => { commit((p) => ({ ...p, blocks: [...p.blocks, item], activeBlockId: item.id })); setTool("select") }
  const placement = (parentId: string | null, desiredWidth: number, desiredHeight: number) => { if (!parentId) { const o = origin(); return { x:o.x, y:o.y, width:desiredWidth, height:desiredHeight, parentId:null } } const parent = itemMap.get(parentId); if (!parent) { const o=origin(); return { x:o.x,y:o.y,width:desiredWidth,height:desiredHeight,parentId:null } } const width = Math.min(desiredWidth, Math.max(70,parent.width*.72)), height = Math.min(desiredHeight,Math.max(60,parent.height*.65)); return { x:Math.max(12,(parent.width-width)/2), y:Math.max(12,(parent.height-height)/2), width,height,parentId } }
  const addShape = (shape: ShapeName, parentId: string | null = null) => { const is3d = is3DShape(shape), line = ["line", "arrow", "vector", "angle"].includes(shape), p = placement(parentId, line ? 360 : is3d ? 300 : 250, line ? 150 : is3d ? 260 : 220); addItem({ id:id(),kind:"shape",shape,...p,stroke:background === "black" || background === "blue" ? "#f8fafc" : "#2563eb",fill:is3d || line ? "transparent" : "#dbeafe",strokeWidth:4,opacity:1,createdAt:now(),rotationX:18,rotationY:-24,rotationZ:0 }) }
  const addGraph = (graph: GraphName) => { const o = origin(); addItem({ id:id(),kind:"graph",graph,x:o.x,y:o.y,width:graph === "number-line" ? 650 : 520,height:graph === "number-line" ? 150 : 390,fill:"#ffffff",opacity:1,createdAt:now(),parentId:null,rotationX:28,rotationY:-28,rotationZ:0 }) }
  const addText = (parentId: string | null = null) => { const p = placement(parentId, 480, 150); addItem({ id:id(),kind:"text",text:"Escribe aquí tus apuntes",...p,color:background === "black" || background === "blue" ? "#ffffff" : "#0f172a",fontSize:34,fontWeight:500,align:"left",opacity:1,createdAt:now() }) }
  const addImage = async (src: string, alt: string, parentId: string | null = null) => { const p = placement(parentId, 480, 320); addItem({ id:id(),kind:"image",src:await compress(src),alt,...p,opacity:1,createdAt:now() }) }
  const addPlot3D = (parentId: string, plot: Plot3DKind, expression = "x^2+y^2") => { const parent = itemMap.get(parentId); if (!parent || parent.kind !== "graph" || parent.graph !== "axes3d") return; addItem({ id:id(),kind:"plot3d",plot,x:0,y:0,width:parent.width,height:parent.height,opacity:1,createdAt:now(),parentId,color:plot === "surface" ? "#7c3aed" : "#0ea5e9",strokeWidth:4,expression }) }
  const uploadImage = async (file?: File) => { const parentId = pendingImageParent.current; pendingImageParent.current = null; if (!file) return; try { if (!file.type.startsWith("image/")) throw new Error("Selecciona una imagen."); await addImage(await fileData(file), file.name, parentId) } catch (e) { alert(e instanceof Error ? e.message : "No fue posible adjuntar la imagen.") } finally { if (imageRef.current) imageRef.current.value = "" } }
  const requestImage = (parentId: string | null = null) => { pendingImageParent.current = parentId; imageRef.current?.click() }
  const setBackground = (next: Background) => { commit((p) => ({ ...p, blocks: [...p.blocks.filter((b) => b.kind !== "page-settings"), { id:id(),kind:"page-settings",background:next,createdAt:now() }] })); if (next === "black" || next === "blue") setColor("#ffffff") }
  const generateAi = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError("")
    setAiPreview("")
    try {
      const isSticker = aiMode === "sticker"
      const cleanPrompt = aiPrompt.trim()
      const enhancedPrompt = isSticker
        ? `Sticker educativo de ${cleanPrompt}. Objeto completo, centrado, contorno limpio, estilo ${aiStyle}, sin texto, sin marco, fondo transparente, listo para pegar en un cuaderno digital.`
        : `${cleanPrompt}. Imagen de apoyo para apuntes educativos, estilo ${aiStyle}, composición clara, limpia, sin texto ilegible y con el tema completo dentro del encuadre.`
      const response = await fetch("/api/agents/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          style: aiStyle,
          width: 1024,
          height: isSticker ? 1024 : 768,
          provider: "auto",
          mode: isSticker ? "sticker" : "educational",
          source: "digital-whiteboard",
          transparentBackground: isSticker,
          background: isSticker ? "transparent" : "auto",
          outputFormat: isSticker ? "png" : "auto",
          educationalContext: isSticker
            ? "Sticker visual para decorar apuntes escolares. Debe ser recortable, sin fondo y sin texto."
            : "Imagen de apoyo para apuntes educativos, limpia, clara y sin texto ilegible.",
        }),
      })
      const data = await response.json().catch(() => ({}))
      const imageUrl = data.imageUrl || data.url || data.images?.[0]?.url
      if (!response.ok || !imageUrl) throw new Error(data.error || "No fue posible generar el recurso visual.")
      setAiPreview(imageUrl)
      await addImage(imageUrl, `${isSticker ? "Sticker" : "Imagen"} IA: ${cleanPrompt}`)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "No fue posible generar el recurso visual.")
    } finally {
      setAiLoading(false)
    }
  }
  const openCamera = async () => { setCameraError(""); try { if (!navigator.mediaDevices?.getUserMedia) throw new Error("La cámara requiere HTTPS y un navegador compatible."); streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = await navigator.mediaDevices.getUserMedia({ video:{facingMode:{ideal:"environment"}},audio:false }); setCamera(true) } catch (e) { setCameraError(e instanceof Error ? e.message : "No fue posible abrir la cámara."); setCamera(true) } }
  const closeCamera = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current=null; if (videoRef.current) videoRef.current.srcObject=null; setCamera(false); setCameraError("") }
  const capture = async () => { const video=videoRef.current; if (!video?.videoWidth) return; const canvas=document.createElement("canvas"), scale=Math.min(1,1200/video.videoWidth); canvas.width=video.videoWidth*scale; canvas.height=video.videoHeight*scale; canvas.getContext("2d")?.drawImage(video,0,0,canvas.width,canvas.height); await addImage(canvas.toDataURL("image/jpeg",.82),"Fotografía"); closeCamera() }

  const hitItem = (item: Item, p: Point) => { const a = absolutePosition(item); return p.x >= a.x - 8 && p.x <= a.x + item.width + 8 && p.y >= a.y - 8 && p.y <= a.y + item.height + 8 }
  const erase = (p: Point) => { const stroke=[...page.strokes].reverse().find((s)=>hitsStroke(s,p)); if (stroke) return commit((current)=>({...current,strokes:current.strokes.filter((s)=>s.id!==stroke.id)})); const item=[...items].reverse().find((i)=>hitItem(i,p)); if (item) { const remove=new Set([item.id]); let changed=true; while(changed){changed=false; for(const candidate of items) if(candidate.parentId && remove.has(candidate.parentId) && !remove.has(candidate.id)){remove.add(candidate.id);changed=true}} commit((current)=>({...current,blocks:current.blocks.filter((b)=>!remove.has(b.id)),activeBlockId:null})) } }
  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => { const p=point(event); if (tool === "select") { if (page.activeBlockId) noHistory((current)=>({...current,activeBlockId:null})); return } if (tool === "eraser") return erase(p); event.currentTarget.setPointerCapture(event.pointerId); setActiveStroke({ id:id(),points:[p],color,width:tool === "marker" ? Math.max(14,width*3) : width,opacity:tool === "marker" ? .28 : 1 }) }
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const p=point(event)
    if(interaction){
      const dx=p.x-interaction.start.x,dy=p.y-interaction.start.y
      const original=interaction.item.kind==="shape"||interaction.item.kind==="graph"?interaction.item:null
      noHistory((current)=>({
        ...current,
        blocks:current.blocks.map((b)=>{
          if(b.id!==interaction.item.id||b.kind==="page-settings")return b
          if(interaction.mode==="drag")return {...b,x:Math.max(0,interaction.item.x+dx),y:Math.max(0,interaction.item.y+dy)}
          if(interaction.mode==="resize")return {...b,width:Math.max(50,interaction.item.width+dx),height:Math.max(40,interaction.item.height+dy)}
          if(interaction.mode==="rotate"&&original&&(b.kind==="shape"||b.kind==="graph"))return {...b,rotationX:original.rotationX-dy*.72,rotationY:original.rotationY+dx*.72,rotationZ:original.rotationZ+(event.shiftKey?dx*.45:0)}
          return b
        }),
      }))
      return
    }
    if(activeStroke&&event.currentTarget.hasPointerCapture(event.pointerId))setActiveStroke((s)=>s?{...s,points:[...s.points,p]}:s)
  }
  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (interaction) { setUndoStack((s)=>[...s.slice(-79),interaction.page]); setRedoStack([]); setInteraction(null); return } if (activeStroke?.points.length && activeStroke.points.length>1) commit((p)=>({...p,strokes:[...p.strokes,activeStroke]})); setActiveStroke(null) }
  const beginItem = (event: ReactPointerEvent<SVGGElement | SVGRectElement>, item: Item, mode: Interaction["mode"]) => { if(tool!=="select")return;event.stopPropagation();svgRef.current?.setPointerCapture(event.pointerId);noHistory((p)=>({...p,activeBlockId:item.id}));setInteraction({mode,item:clone(item),start:point(event),page:clone(page)}) }
  const undo = () => { const previous=undoStack.at(-1); if(!previous)return; setUndoStack((s)=>s.slice(0,-1)); setRedoStack((s)=>[...s.slice(-79),clone(page)]); updatePage(page.id,()=>clone(previous)) }
  const redo = () => { const next=redoStack.at(-1); if(!next)return; setRedoStack((s)=>s.slice(0,-1)); setUndoStack((s)=>[...s.slice(-79),clone(page)]); updatePage(page.id,()=>clone(next)) }
  const patchSelected = (patch: Partial<Item>) => { if(selected) commit((p)=>({...p,blocks:p.blocks.map((b)=>b.id===selected.id && b.kind!=="page-settings" ? {...b,...patch} as Item : b)})) }
  const descendantIds = (rootId:string) => { const result=new Set([rootId]); let changed=true; while(changed){changed=false; for(const item of items) if(item.parentId && result.has(item.parentId) && !result.has(item.id)){result.add(item.id);changed=true}} return result }
  const deleteSelected = () => { if(!selected)return; const remove=descendantIds(selected.id); commit((p)=>({...p,blocks:p.blocks.filter((b)=>!remove.has(b.id)),activeBlockId:null})) }
  const duplicate = () => { if(!selected)return; const ids=descendantIds(selected.id), originals=items.filter((item)=>ids.has(item.id)), remap=new Map(originals.map((item)=>[item.id,id()])); const clones=originals.map((item)=>({...clone(item),id:remap.get(item.id)!,parentId:item.parentId && remap.has(item.parentId) ? remap.get(item.parentId)! : item.parentId,x:item.id===selected.id ? item.x+30:item.x,y:item.id===selected.id ? item.y+30:item.y,createdAt:now()})); commit((p)=>({...p,blocks:[...p.blocks,...clones],activeBlockId:remap.get(selected.id)!})) }
  const reorder = (forward:boolean) => { if(!selected)return; commit((p)=>{ const settings=p.blocks.filter((b)=>b.kind==="page-settings"), visual=p.blocks.filter((b):b is Item=>b.kind!=="page-settings"), siblings=visual.filter((b)=>(b.parentId||null)===(selected.parentId||null)), i=siblings.findIndex((b)=>b.id===selected.id),j=forward?i+1:i-1; if(i<0||j<0||j>=siblings.length)return p; const target=siblings[j], ai=visual.findIndex((b)=>b.id===selected.id), bi=visual.findIndex((b)=>b.id===target.id); [visual[ai],visual[bi]]=[visual[bi],visual[ai]]; return {...p,blocks:[...settings,...visual]} }) }
  const rotatePreset = (rotationX:number,rotationY:number,rotationZ:number) => patchSelected({rotationX,rotationY,rotationZ} as Partial<ShapeItem | GraphItem>)

  const clearPage = () => {
    if (!page.strokes.length && !items.length) return
    if (!confirm("¿Borrar todo el contenido de esta hoja? Esta acción se puede deshacer solo antes de cambiar de hoja.")) return
    commit((current)=>({...current,strokes:[],blocks:current.blocks.filter((block)=>block.kind==="page-settings"),activeBlockId:null}))
  }
  const deletePage = () => {
    if (notebook.pages.length <= 1) return
    if (!confirm(`¿Eliminar ${page.title || "esta hoja"} del cuaderno?`)) return
    setNotebook((current)=>{
      const index=current.pages.findIndex((candidate)=>candidate.id===page.id)
      const pages=current.pages.filter((candidate)=>candidate.id!==page.id)
      const next=pages[Math.max(0,index-1)]||pages[0]
      return {...current,pages,activePageId:next.id,updatedAt:now()}
    })
    setUndoStack([]);setRedoStack([])
  }
  const addPage = () => { const p=newPage(notebook.pages.length); setNotebook((n)=>({...n,pages:[...n.pages,p],activePageId:p.id,updatedAt:now()})); setUndoStack([]);setRedoStack([]) }
  const openPage = (pageId:string) => { setNotebook((n)=>({...n,activePageId:pageId,updatedAt:now()}));setUndoStack([]);setRedoStack([]);requestAnimationFrame(()=>scrollRef.current?.scrollTo({top:0})) }
  const loadLibrary = async () => { setLibraryLoading(true);const local=localLibrary().map((n)=>({id:n.id,title:n.title,folder:n.folder||"Mis cuadernos",pageCount:n.pages.length,updatedAt:n.updatedAt,source:"local" as const}));let remote:Saved[]=[];try{const response=await fetch("/api/whiteboard/notebooks",{cache:"no-store"});if(response.ok)remote=(await response.json()).notebooks.map((n:Saved)=>({...n,folder:n.folder||"Mis cuadernos",source:"cloud" as const}))}catch{}const seen=new Set<string>();setSaved([...remote,...local].filter((n)=>{const key=`${n.source}:${n.id}`;if(seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));setShowLibrary(true);setLibraryLoading(false) }
  const openSaved = async (entry:Saved) => { try{const restored=entry.source==="local"?localLibrary().find((n)=>n.id===entry.id)||null:normalizeNotebook((await(await fetch(`/api/whiteboard/notebooks/${entry.id}`,{cache:"no-store"})).json()).notebook);if(!restored)throw new Error("Cuaderno incompatible.");setNotebook(restored);setShowLibrary(false);setUndoStack([]);setRedoStack([])}catch(e){alert(e instanceof Error?e.message:"No fue posible abrir el cuaderno.")} }
  const exportJson = () => { const url=URL.createObjectURL(new Blob([JSON.stringify({format:"eduai-digital-notebook",version:4,notebook},null,2)],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download=`${notebook.title.replace(/\W+/g,"-")||"cuaderno"}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),500) }
  const importMaterial = async (file?:File) => { if(!file)return;try{if(file.type.startsWith("image/"))return await uploadImage(file);const data=JSON.parse(await file.text()),restored=normalizeNotebook(data.notebook||data);if(restored){setNotebook({...restored,id:id(),title:`${restored.title} (importado)`,updatedAt:now(),cloudSyncedAt:null});return}const imported=normalizePage(data.page||data,notebook.pages.length);if(!imported)throw new Error("Material incompatible.");const p={...imported,id:id(),title:`${imported.title} (importado)`};setNotebook((n)=>({...n,pages:[...n.pages,p],activePageId:p.id,updatedAt:now()}))}catch(e){alert(e instanceof Error?e.message:"No fue posible importar el material.")}finally{if(importRef.current)importRef.current.value=""} }
  const exportPage = async (format:"png"|"pdf") => { const svg=svgRef.current;if(!svg||exporting)return;setExporting(true);try{const copy=svg.cloneNode(true) as SVGSVGElement;copy.querySelectorAll("[data-selection]").forEach((n)=>n.remove());copy.setAttribute("width",String(W));copy.setAttribute("height",String(page.canvasHeight));const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:"image/svg+xml"})),image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("No fue posible preparar la página."));image.src=url});const scale=Math.min(2,5000/Math.max(W,page.canvasHeight)),canvas=document.createElement("canvas");canvas.width=W*scale;canvas.height=page.canvasHeight*scale;canvas.getContext("2d")?.drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);if(format==="png"){const a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download=`${page.title}.png`;a.click()}else{const{jsPDF}=await import("jspdf"),pw=1000,ph=pw*page.canvasHeight/W,pdf=new jsPDF({orientation:pw>ph?"landscape":"portrait",unit:"px",format:[pw,ph]});pdf.addImage(canvas.toDataURL("image/jpeg",.9),"JPEG",0,0,pw,ph);pdf.save(`${page.title}.pdf`)}}catch(e){alert(e instanceof Error?e.message:"No fue posible exportar la página.")}finally{setExporting(false)} }

  const renderItem = (item:Item, parent:Item|null=null):ReactNode => {
    const children=childrenOf(item.id), clipId=`clip-${item.id}`, interactive=tool==="select"
    const visual = item.kind==="shape"?<ShapeArt item={item}/>:item.kind==="graph"?<g><rect width={item.width} height={item.height} rx={12} fill={item.fill} stroke="#e2e8f0"/><GraphArt item={item}/></g>:item.kind==="plot3d" && parent?.kind==="graph"?<Plot3DArt item={item} parent={parent}/>:item.kind==="image"?<image href={item.src} width={item.width} height={item.height} preserveAspectRatio="xMidYMid meet"/>:item.kind==="text"?<foreignObject width={item.width} height={item.height}><div style={{width:"100%",height:"100%",overflow:"hidden",whiteSpace:"pre-wrap",overflowWrap:"anywhere",color:item.color,fontSize:item.fontSize,fontWeight:item.fontWeight,lineHeight:1.25,textAlign:item.align,padding:8}}>{item.text}</div></foreignObject>:null
    return <g key={item.id} transform={`translate(${item.x} ${item.y})`} opacity={item.opacity}><defs><clipPath id={clipId}><rect x={4} y={4} width={Math.max(1,item.width-8)} height={Math.max(1,item.height-8)} rx={14}/></clipPath></defs><g pointerEvents={interactive?"all":"none"} onPointerDown={(e)=>beginItem(e,item,"drag")} className={interactive?"cursor-move":""}><rect width={item.width} height={item.height} fill="transparent"/>{visual}{children.length>0&&<g clipPath={`url(#${clipId})`}>{children.map((child)=>renderItem(child,item))}</g>}</g></g>
  }
  const selectionOverlay = selected ? (()=>{const position=absolutePosition(selected),rotatable=isRotatable(selected);return <g data-selection="true" transform={`translate(${position.x} ${position.y})`}><rect x={-6} y={-6} width={selected.width+12} height={selected.height+12} rx={9} fill="none" stroke="#2563eb" strokeWidth={3} strokeDasharray="10 7" pointerEvents="none"/>{rotatable&&<g transform={`translate(${Math.max(8,selected.width/2-52)} -58)`} className="cursor-grab active:cursor-grabbing" onPointerDown={(e)=>beginItem(e,selected,"rotate")}><title>Arrastra para girar la figura o el gráfico</title><path d="M 52 40 L 52 52" stroke="#7c3aed" strokeWidth={3}/><rect width={104} height={40} rx={20} fill="#7c3aed" stroke="#fff" strokeWidth={3}/><path d="M 22 22a10 10 0 1 1 4 7" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round"/><path d="M 19 28l7 1-1-7" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"/><text x={61} y={25} fill="#fff" fontSize={14} fontWeight={900} textAnchor="middle">Girar</text></g>}<rect x={selected.width-10} y={selected.height-10} width={22} height={22} rx={5} fill="#2563eb" stroke="#fff" strokeWidth={3} className="cursor-nwse-resize" onPointerDown={(e)=>beginItem(e,selected,"resize")}/></g>})():null
  const tabs:[Tab,string,ReactNode][]=[["background","Fondos",<Palette size={14}/>],["2d","2D",<Shapes size={14}/>],["3d","3D",<Box size={14}/>],["graphs","Gráficos",<Grid3X3 size={14}/>],["media","Contenido",<ImageIcon size={14}/>]]
  const selectedChildren = selected ? childrenOf(selected.id).length : 0

  return <div className={`min-h-screen bg-slate-100 text-slate-900 ${expanded?"overflow-hidden":""}`}>
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1900px] items-center justify-between gap-3 px-4 py-2.5"><div className="flex min-w-0 items-center gap-3"><button onClick={()=>router.back()} className={`${button} border border-slate-200 bg-white text-slate-700`}><ArrowLeft size={15}/>Volver</button><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-xl text-white">✍️</div><div><h1 className="text-sm font-bold">Cuaderno digital interactivo</h1><p className="hidden text-xs text-slate-500 sm:block">Lienzo libre con objetos, contenido interno y herramientas espaciales</p></div></div><button onClick={()=>setExpanded((v)=>!v)} className={`${button} border border-slate-200 bg-white text-slate-700`}>{expanded?<Minimize2 size={15}/>:<Expand size={15}/>} {expanded?"Reducir":"Expandir"}</button></div></header>
    <main className={`mx-auto flex max-w-[1900px] flex-col gap-3 px-3 py-3 sm:px-4 ${expanded?"h-[calc(100vh-61px)]":""}`}>
      <section data-whiteboard-layout="left-sidebar" className={`grid min-h-0 flex-1 gap-3 ${panelOpen?"xl:grid-cols-[210px_350px_minmax(0,1fr)]":"xl:grid-cols-[210px_minmax(0,1fr)]"}`}>
          <aside data-whiteboard-sidebar="left" className="flex min-h-[600px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-start-1 xl:row-start-1">
            <div className="space-y-2 border-b border-slate-200 p-3">
              <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Nombre del cuaderno</label>
              <input aria-label="Nombre del cuaderno" value={notebook.title} onChange={(e)=>setNotebook((n)=>({...n,title:e.target.value,updatedAt:now()}))} className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold outline-none focus:border-blue-400"/>
              <button onClick={()=>void loadLibrary()} className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-2.5 py-2 text-left text-[11px] font-bold text-blue-700"><BookOpen size={14}/><span className="min-w-0"><span className="block truncate">📁 {notebook.folder||"Mis cuadernos"}</span><small className="font-medium text-blue-500">Todos los cuadernos guardados</small></span></button>
              <span className={`inline-flex w-full items-center justify-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${cloud==="synced"?"bg-emerald-100 text-emerald-700":cloud==="saving"?"bg-amber-100 text-amber-700":cloud==="error"?"bg-rose-100 text-rose-700":"bg-slate-100 text-slate-600"}`}>{cloud==="synced"?<Cloud size={11}/>:cloud==="saving"?<LoaderCircle size={11} className="animate-spin"/>:<CloudOff size={11}/>} {cloud==="synced"?"Guardado en Supabase":cloud==="saving"?"Guardando...":cloud==="error"?"Solo local":"Guardado local"}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              <p className="px-2 pt-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Dibujar</p>
              <button onClick={()=>setTool("select")} className={`${button} w-full justify-start ${tool==="select"?"bg-slate-900 text-white":"text-slate-700 hover:bg-slate-100"}`}><MousePointer2 size={15}/>Seleccionar</button>
              <button onClick={()=>setTool("pen")} className={`${button} w-full justify-start ${tool==="pen"?"bg-blue-600 text-white":"text-slate-700 hover:bg-blue-50"}`}><Brush size={15}/>Lápiz</button>
              <button onClick={()=>setTool("marker")} className={`${button} w-full justify-start ${tool==="marker"?"bg-amber-400 text-slate-900":"text-slate-700 hover:bg-amber-50"}`}><Highlighter size={15}/>Destacador</button>
              <button onClick={()=>setTool("eraser")} className={`${button} w-full justify-start ${tool==="eraser"?"bg-rose-500 text-white":"text-slate-700 hover:bg-rose-50"}`}><Eraser size={15}/>Borrador</button>
              <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-bold">Color<input type="color" value={color} onChange={(e)=>setColor(e.target.value)} className="h-7 w-9 rounded"/></label>
              <label className="block rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-[10px] font-bold">Grosor · {width}<input type="range" min={2} max={18} value={width} onChange={(e)=>setWidth(Number(e.target.value))} className="mt-1 w-full"/></label>
              <div className="grid grid-cols-2 gap-1"><button onClick={undo} disabled={!undoStack.length} className={`${button} border border-slate-200 px-2 text-slate-700`} title="Deshacer"><Undo2 size={16}/></button><button onClick={redo} disabled={!redoStack.length} className={`${button} border border-slate-200 px-2 text-slate-700`} title="Rehacer"><Redo2 size={16}/></button></div>
              <div className="my-2 h-px bg-slate-200"/>
              <button onClick={()=>setPanelOpen((value)=>!value)} className={`${button} w-full justify-start border ${panelOpen?"border-blue-300 bg-blue-50 text-blue-700":"border-slate-200 bg-white text-slate-700"}`}>{panelOpen?<ChevronLeft size={15}/>:<ChevronRight size={15}/>}Herramientas</button>
              <button onClick={()=>{saveLocal({...notebook,updatedAt:now()});setCloud("local")}} className={`${button} w-full justify-start text-emerald-700`}><Save size={15}/>Guardar ahora</button>
              <button onClick={()=>void loadLibrary()} className={`${button} w-full justify-start text-blue-700`}><BookOpen size={15}/>Carpeta</button>
              <button onClick={()=>{if(!notebook.pages.some((p)=>p.strokes.length||itemsOf(p).length)||confirm("¿Crear un cuaderno nuevo?"))setNotebook(newNotebook())}} className={`${button} w-full justify-start text-slate-700`}><Plus size={15}/>Nuevo cuaderno</button>
            </div>
          </aside>
          <div className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${panelOpen?"xl:col-start-3":"xl:col-start-2"} xl:row-start-1`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2"><div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">{notebook.pages.map((p,i)=><button key={p.id} onClick={()=>openPage(p.id)} className={`${button} shrink-0 ${p.id===page.id?"bg-sky-600 text-white":"bg-slate-100 text-slate-600"}`}>Página {i+1}</button>)}<button onClick={addPage} className={`${button} shrink-0 bg-emerald-100 text-emerald-700`}><Plus size={14}/>Página</button></div><button onClick={deletePage} disabled={notebook.pages.length<=1} className={`${button} shrink-0 border border-rose-200 bg-rose-50 text-rose-700`} title={notebook.pages.length<=1?"El cuaderno debe conservar al menos una hoja":"Eliminar la hoja actual"}><Trash2 size={14}/>Eliminar hoja</button><button onClick={clearPage} disabled={!page.strokes.length&&!items.length} className={`${button} shrink-0 border border-amber-200 bg-amber-50 text-amber-800`}><Eraser size={14}/>Borrar todo</button><div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1"><button onClick={()=>setZoom((z)=>Math.max(.45,z-.1))} className="h-7 w-8 rounded-lg bg-white font-bold">−</button><span className="w-12 text-center text-[11px] font-bold">{Math.round(zoom*100)}%</span><button onClick={()=>setZoom((z)=>Math.min(1.35,z+.1))} className="h-7 w-8 rounded-lg bg-white font-bold">+</button></div></div>
          <div ref={scrollRef} className="relative min-h-[520px] flex-1 overflow-auto bg-slate-200/70 p-4" style={{height:expanded?"calc(100vh - 138px)":780}}><div className="mx-auto shadow-2xl" style={{width:W*zoom,minWidth:W*zoom}}><svg ref={svgRef} viewBox={`0 0 ${W} ${page.canvasHeight}`} width={W*zoom} height={page.canvasHeight*zoom} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} className={`block touch-none select-none ${tool==="eraser"?"cursor-cell":tool==="select"?"cursor-default":"cursor-crosshair"}`}><BackgroundLayer background={background} height={page.canvasHeight}/>{topItems.map((item)=>renderItem(item))}{strokes.map((s)=><polyline key={s.id} points={s.points.map((p)=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={s.color} strokeWidth={s.width} strokeOpacity={s.opacity} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>)}{selectionOverlay}</svg></div></div>
        </div>
        {panelOpen&&<aside data-whiteboard-tools="left" className="flex min-h-[600px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-start-2 xl:row-start-1"><div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 py-2">{tabs.map(([key,label,icon])=><button key={key} onClick={()=>setTab(key)} className={`${button} shrink-0 px-2.5 ${tab===key?"bg-white text-blue-700 shadow-sm":"text-slate-500"}`}>{icon}{label}</button>)}<button onClick={()=>setPanelOpen(false)} className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-white"><X size={16}/></button></div><div className="flex-1 overflow-y-auto p-4">
          {tab==="background"&&<div className="space-y-3"><h2 className="text-sm font-bold">Fondos por página</h2><div className="grid grid-cols-2 gap-2">{backgrounds.map((b)=><button key={b.id} onClick={()=>setBackground(b.id)} className={`rounded-2xl border p-3 text-left ${background===b.id?"border-blue-500 bg-blue-50 ring-2 ring-blue-100":"border-slate-200"}`}><div className={`mb-2 h-16 rounded-xl border ${b.id==="black"?"bg-slate-950":b.id==="blue"?"bg-blue-950":b.id==="ruled"?"bg-[repeating-linear-gradient(to_bottom,#fff_0,#fff_14px,#bfdbfe_15px)]":b.id==="grid"?"bg-[linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] bg-[size:14px_14px]":b.id==="dots"?"bg-[radial-gradient(#94a3b8_1px,transparent_1px)] bg-[size:12px_12px]":"bg-white"}`}/><p className="text-xs font-bold">{b.label}</p></button>)}</div></div>}
          {tab==="2d"&&<div className="space-y-3"><h2 className="text-sm font-bold">Figuras y vectores 2D</h2><div className="grid grid-cols-2 gap-2">{shapes2d.map(([shape,label])=><button key={shape} onClick={()=>addShape(shape)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold hover:bg-blue-50"><Square size={16} className="mb-2 text-blue-600"/>{label}</button>)}</div></div>}
          {tab==="3d"&&<div className="space-y-3"><h2 className="text-sm font-bold">Sólidos geométricos 3D</h2><p className="text-xs text-slate-500">Modelos rotables con contenido interno asociado.</p><div className="grid grid-cols-2 gap-2">{shapes3d.map(([shape,label])=><button key={shape} onClick={()=>addShape(shape)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold hover:bg-violet-50"><Box size={16} className="mb-2 text-violet-600"/>{label}</button>)}</div></div>}
          {tab==="graphs"&&<div className="space-y-3"><h2 className="text-sm font-bold">Gráficos vacíos</h2><p className="text-xs text-slate-500">El gráfico 3D admite funciones, curvas, rectas, vectores, puntos y figuras.</p>{graphs.map(([graph,label])=><button key={graph} onClick={()=>addGraph(graph)} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:bg-emerald-50"><Grid3X3 size={18} className="text-emerald-600"/><span className="text-xs font-bold">{label}</span></button>)}</div>}
          {tab==="media"&&<div className="space-y-2"><h2 className="text-sm font-bold">Contenido para tus apuntes</h2><p className="mb-3 text-xs text-slate-500">Las imágenes y textos se pueden mover, redimensionar y dibujar por encima.</p><button onClick={()=>addText()} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left"><Type size={18} className="text-blue-600"/><span className="text-xs font-bold">Agregar texto</span></button><button onClick={()=>requestImage()} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left"><Upload size={18} className="text-indigo-600"/><span className="text-xs font-bold">Adjuntar imagen</span></button><button onClick={()=>void openCamera()} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left"><Camera size={18} className="text-emerald-600"/><span className="text-xs font-bold">Tomar fotografía</span></button><div data-ai-visual-panel="compact" className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3">
  <button onClick={()=>setShowAi((value)=>!value)} className="flex w-full items-center justify-between gap-3 text-left">
    <span className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white"><Sparkles size={16}/></span><span><strong className="block text-xs text-violet-950">Imagen / Sticker IA</strong><small className="text-[10px] text-violet-600">Generador compacto para apuntes</small></span></span>
    {showAi?<ChevronUp size={16} className="text-violet-600"/>:<ChevronDown size={16} className="text-violet-600"/>}
  </button>
  {showAi&&<div className="mt-3 space-y-2 border-t border-violet-200 pt-3">
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1">
      <button onClick={()=>setAiMode("image")} className={`${button} h-8 ${aiMode==="image"?"bg-blue-600 text-white":"text-slate-600"}`}><ImageIcon size={13}/>Imagen</button>
      <button onClick={()=>setAiMode("sticker")} className={`${button} h-8 ${aiMode==="sticker"?"bg-fuchsia-600 text-white":"text-slate-600"}`}><Sparkles size={13}/>Sticker</button>
    </div>
    <textarea value={aiPrompt} onChange={(event)=>setAiPrompt(event.target.value)} rows={2} className="w-full resize-none rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-400" placeholder={aiMode==="sticker"?"Ej.: átomo feliz estilo científico":"Ej.: esquema del sistema solar"}/>
    <select value={aiStyle} onChange={(event)=>setAiStyle(event.target.value)} className="h-9 w-full rounded-xl border border-violet-200 bg-white px-2 text-xs">
      <option value="educational">Educativo</option><option value="infographic">Infografía</option><option value="flat design">Diseño plano</option><option value="sketch">Boceto</option><option value="3d render">Render 3D</option><option value="realistic">Realista</option><option value="kawaii">Kawaii</option>
    </select>
    {aiPreview&&<div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white p-2"><img src={aiPreview} alt="Último recurso generado" className="h-14 w-14 rounded-lg object-contain"/><span className="text-[10px] font-semibold text-emerald-700">Insertado en el lienzo. Puedes moverlo y cambiar su tamaño.</span></div>}
    {aiError&&<div className="rounded-xl bg-rose-100 px-3 py-2 text-[10px] text-rose-700">{aiError}</div>}
    <button onClick={()=>void generateAi()} disabled={!aiPrompt.trim()||aiLoading} className={`${button} w-full bg-violet-600 text-white`}>{aiLoading?<LoaderCircle size={14} className="animate-spin"/>:<Sparkles size={14}/>} {aiLoading?"Generando...":aiMode==="sticker"?"Generar e insertar sticker":"Generar e insertar imagen"}</button>
    <p className="text-center text-[9px] text-violet-500">El recurso se agrega directamente al cuaderno.</p>
  </div>}
</div><div className="my-3 h-px bg-slate-200"/><button onClick={()=>importRef.current?.click()} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left"><FileJson size={18}/><span className="text-xs font-bold">Importar material</span></button><button onClick={exportJson} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left"><Download size={18}/><span className="text-xs font-bold">Exportar cuaderno editable</span></button><div className="grid grid-cols-2 gap-2"><button onClick={()=>void exportPage("png")} disabled={exporting} className={`${button} border border-slate-200`}><ImageIcon size={14}/>PNG</button><button onClick={()=>void exportPage("pdf")} disabled={exporting} className={`${button} border border-slate-200`}><FileText size={14}/>PDF</button></div></div>}
          {selected&&<div className="mt-5 space-y-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-3"><div className="flex justify-between"><div><p className="text-[10px] font-black uppercase text-blue-600">Elemento seleccionado</p><p className="text-xs font-bold">{selected.kind} {selectedChildren?`· ${selectedChildren} dentro`:""}</p></div><Layers size={17} className="text-blue-600"/></div>{selected.kind==="text"&&<><textarea value={selected.text} onChange={(e)=>patchSelected({text:e.target.value} as Partial<TextItem>)} rows={4} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs"/><label className="block text-[10px] font-bold">Tamaño<input type="range" min={12} max={96} value={selected.fontSize} onChange={(e)=>patchSelected({fontSize:Number(e.target.value)} as Partial<TextItem>)} className="w-full"/></label></>}{selected.kind==="shape"&&<div className="grid grid-cols-2 gap-2"><label className="rounded-xl bg-white p-2 text-[10px] font-bold">Borde<input type="color" value={selected.stroke} onChange={(e)=>patchSelected({stroke:e.target.value} as Partial<ShapeItem>)} className="h-8 w-full"/></label><label className="rounded-xl bg-white p-2 text-[10px] font-bold">Relleno<input type="color" value={selected.fill==="transparent"?"#ffffff":selected.fill} onChange={(e)=>patchSelected({fill:e.target.value} as Partial<ShapeItem>)} className="h-8 w-full"/></label></div>}{selected.kind==="plot3d"&&<><label className="block text-[10px] font-bold">Color<input type="color" value={selected.color} onChange={(e)=>patchSelected({color:e.target.value} as Partial<Plot3DItem>)} className="h-8 w-full"/></label>{selected.plot==="surface"&&<textarea value={selected.expression} onChange={(e)=>patchSelected({expression:e.target.value} as Partial<Plot3DItem>)} rows={2} className="w-full rounded-xl border bg-white p-2 text-xs"/>}</>}{isRotatable(selected)&&<div className="space-y-2 rounded-2xl border border-violet-200 bg-white p-3"><div className="flex items-center gap-2 text-xs font-black text-violet-700"><RotateCw size={15}/>Rotación 3D</div><div className="grid grid-cols-2 gap-1"><button onClick={()=>rotatePreset(0,0,0)} className={`${button} border`}>Frontal</button><button onClick={()=>rotatePreset(70,0,0)} className={`${button} border`}>Horizontal</button><button onClick={()=>rotatePreset(0,70,0)} className={`${button} border`}>Vertical</button><button onClick={()=>rotatePreset(35,-35,35)} className={`${button} border`}>Diagonal</button></div>{(["rotationX","rotationY","rotationZ"] as const).map((axis)=><label key={axis} className="block text-[10px] font-bold">{axis.replace("rotation","Eje ")} · {Math.round(selected[axis])}°<input type="range" min={-180} max={180} value={selected[axis]} onChange={(e)=>patchSelected({[axis]:Number(e.target.value)} as Partial<ShapeItem|GraphItem>)} className="w-full"/></label>)}</div>}{isContainer(selected)&&<div className="space-y-2 rounded-2xl border border-emerald-200 bg-white p-3"><p className="text-[10px] font-black uppercase text-emerald-700">Contenido dentro del elemento</p><div className="grid grid-cols-2 gap-2"><button onClick={()=>addText(selected.id)} className={`${button} border`}><Type size={14}/>Texto</button><button onClick={()=>addShape("circle",selected.id)} className={`${button} border`}><Shapes size={14}/>Figura</button><button onClick={()=>addShape("vector",selected.id)} className={`${button} border`}><ChevronRight size={14}/>Vector</button><button onClick={()=>requestImage(selected.id)} className={`${button} border`}><ImageIcon size={14}/>Imagen</button></div>{selected.kind==="graph"&&selected.graph==="axes3d"&&<div className="space-y-2 border-t border-slate-200 pt-3"><p className="text-[10px] font-black uppercase text-violet-700">Elementos matemáticos 3D</p><div className="grid grid-cols-2 gap-2">{plotTemplates.map(([plot,label,expression])=><button key={plot} onClick={()=>addPlot3D(selected.id,plot,expression)} className="rounded-xl border p-2 text-[10px] font-bold hover:bg-violet-50">{label}</button>)}</div><label className="block text-[10px] font-bold">Función z = f(x,y)<input value={customExpression} onChange={(e)=>setCustomExpression(e.target.value)} className="mt-1 w-full rounded-xl border px-2 py-2 text-xs" placeholder="sin(x)+cos(y)"/></label><button onClick={()=>addPlot3D(selected.id,"surface",customExpression)} className={`${button} w-full bg-violet-600 text-white`}><Plus size={14}/>Añadir función</button></div>}</div>}<label className="block text-[10px] font-bold">Opacidad<input type="range" min={.15} max={1} step={.05} value={selected.opacity} onChange={(e)=>patchSelected({opacity:Number(e.target.value)})} className="w-full"/></label><div className="grid grid-cols-2 gap-2"><button onClick={()=>reorder(false)} className={`${button} border bg-white`}><ChevronDown size={14}/>Atrás</button><button onClick={()=>reorder(true)} className={`${button} border bg-white`}><ChevronUp size={14}/>Adelante</button><button onClick={duplicate} className={`${button} border bg-white`}><Copy size={14}/>Duplicar</button><button onClick={deleteSelected} className={`${button} bg-rose-500 text-white`}><Trash2 size={14}/>Eliminar</button></div></div>}
        </div><div className="border-t border-slate-200 bg-slate-50 p-3"><button onClick={()=>{if((!page.strokes.length&&!items.length)||confirm("¿Limpiar esta página?"))commit((p)=>({...p,strokes:[],blocks:p.blocks.filter((b)=>b.kind==="page-settings"),activeBlockId:null}))}} className={`${button} w-full text-rose-600`}><Trash2 size={14}/>Limpiar página</button></div></aside>}
      </section>
    </main>
    <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(e)=>void uploadImage(e.target.files?.[0])}/><input ref={importRef} type="file" accept="application/json,.json,image/*" className="hidden" onChange={(e)=>void importMaterial(e.target.files?.[0])}/>
    {camera&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white"><div className="flex justify-between border-b px-5 py-4"><h2 className="text-lg font-black">Tomar fotografía</h2><button onClick={closeCamera}><X size={18}/></button></div><div className="bg-slate-950 p-4">{cameraError?<div className="rounded-2xl bg-rose-50 p-6 text-center text-sm text-rose-700">{cameraError}</div>:<video ref={videoRef} playsInline muted className="mx-auto max-h-[65vh] w-full rounded-2xl object-contain"/>}</div><div className="flex justify-end gap-2 p-4"><button onClick={closeCamera} className={`${button} border`}>Cancelar</button><button onClick={()=>void capture()} disabled={Boolean(cameraError)} className={`${button} bg-emerald-600 text-white`}><Camera size={15}/>Capturar y adjuntar</button></div></div></div>}
    {showLibrary&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white"><div className="flex justify-between border-b px-5 py-4"><div><h2 className="text-lg font-black">Carpeta de cuadernos</h2><p className="text-xs text-slate-500">📁 Mis cuadernos · guardado local y en Supabase</p></div><button onClick={()=>setShowLibrary(false)}><X size={18}/></button></div><div className="flex-1 overflow-y-auto p-4">{libraryLoading?<div className="p-10 text-center"><LoaderCircle className="mx-auto animate-spin"/></div>:saved.length?saved.map((entry)=><button key={`${entry.source}-${entry.id}`} onClick={()=>void openSaved(entry)} className="mb-2 flex w-full items-center gap-3 rounded-2xl border p-3 text-left"><span className="text-xl">📓</span><span className="min-w-0"><small className="block truncate text-[10px] font-bold text-blue-600">📁 {entry.folder||"Mis cuadernos"}</small><strong className="block truncate text-sm">{entry.title}</strong><small className="text-slate-500">{entry.pageCount} páginas · {entry.source==="cloud"?"Supabase":"Local"}</small></span></button>):<div className="p-10 text-center text-sm text-slate-500">Aún no hay cuadernos guardados.</div>}</div></div></div>}
  </div>
}
