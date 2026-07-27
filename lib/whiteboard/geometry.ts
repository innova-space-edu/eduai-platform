import type {
  WhiteboardBounds,
  WhiteboardMathBlock,
  WhiteboardPoint,
  WhiteboardStroke,
} from "@/lib/whiteboard/types"

const MIN_BLOCK_PADDING = 18
const HORIZONTAL_JOIN_GAP = 72
const VERTICAL_JOIN_GAP = 54

export function boundsForPoints(points: WhiteboardPoint[]): WhiteboardBounds {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = points[0].x
  let minY = points[0].y
  let maxX = points[0].x
  let maxY = points[0].y
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

export function boundsForStroke(stroke: WhiteboardStroke) {
  return boundsForPoints(stroke.points)
}

export function expandBounds(bounds: WhiteboardBounds, padding = MIN_BLOCK_PADDING): WhiteboardBounds {
  return {
    x: Math.max(0, bounds.x - padding),
    y: Math.max(0, bounds.y - padding),
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  }
}

export function unionBounds(a: WhiteboardBounds, b: WhiteboardBounds): WhiteboardBounds {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return { x, y, width: right - x, height: bottom - y }
}

function gapBetween(a: WhiteboardBounds, b: WhiteboardBounds) {
  const horizontal = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width))
  const vertical = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height))
  return { horizontal, vertical }
}

function shouldJoin(a: WhiteboardBounds, b: WhiteboardBounds) {
  const gap = gapBetween(a, b)
  const averageHeight = Math.max(16, (a.height + b.height) / 2)
  const averageWidth = Math.max(16, (a.width + b.width) / 2)
  const horizontalLimit = Math.max(HORIZONTAL_JOIN_GAP, averageHeight * 1.8)
  const verticalLimit = Math.max(VERTICAL_JOIN_GAP, Math.min(120, averageHeight * 1.25))
  const sameLine = gap.vertical <= averageHeight * 0.72 && gap.horizontal <= horizontalLimit
  const stackedMath = gap.horizontal <= averageWidth * 0.48 && gap.vertical <= verticalLimit
  const intersects = gap.horizontal === 0 && gap.vertical === 0
  return sameLine || stackedMath || intersects
}

function stableBlockId(strokeIds: string[]) {
  const source = [...strokeIds].sort().join("|")
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `math-${(hash >>> 0).toString(36)}`
}

export type SegmentedStrokeBlock = {
  id: string
  strokes: WhiteboardStroke[]
  strokeIds: string[]
  bounds: WhiteboardBounds
}

export function segmentStrokes(strokes: WhiteboardStroke[]): SegmentedStrokeBlock[] {
  const valid = strokes
    .filter((stroke) => stroke.points.length > 0)
    .map((stroke) => ({ stroke, bounds: boundsForStroke(stroke) }))

  if (!valid.length) return []

  const parent = valid.map((_, index) => index)
  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index])
    return parent[index]
  }
  const join = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  for (let left = 0; left < valid.length; left += 1) {
    for (let right = left + 1; right < valid.length; right += 1) {
      if (shouldJoin(valid[left].bounds, valid[right].bounds)) join(left, right)
    }
  }

  const groups = new Map<number, typeof valid>()
  valid.forEach((item, index) => {
    const root = find(index)
    const current = groups.get(root) || []
    current.push(item)
    groups.set(root, current)
  })

  return [...groups.values()]
    .map((group) => {
      const strokeIds = group.map((item) => item.stroke.id)
      const bounds = group.map((item) => item.bounds).reduce(unionBounds)
      return {
        id: stableBlockId(strokeIds),
        strokes: group.map((item) => item.stroke),
        strokeIds,
        bounds: expandBounds(bounds),
      }
    })
    .sort((a, b) => {
      const lineThreshold = Math.max(28, Math.min(a.bounds.height, b.bounds.height) * 0.55)
      if (Math.abs(a.bounds.y - b.bounds.y) > lineThreshold) return a.bounds.y - b.bounds.y
      return a.bounds.x - b.bounds.x
    })
}

export function mergeRecognitionWithExisting(
  existing: WhiteboardMathBlock[],
  incoming: WhiteboardMathBlock[],
) {
  const previous = new Map(existing.map((block) => [block.id, block]))
  return incoming.map((block) => {
    const old = previous.get(block.id)
    if (!old) return block
    if (old.editedManually) {
      return {
        ...block,
        latex: old.latex,
        text: old.text,
        source: "manual" as const,
        confidence: 1,
        status: "ready" as const,
        editedManually: true,
      }
    }
    if (!block.latex.trim() && old.latex.trim()) {
      return {
        ...block,
        latex: old.latex,
        text: old.text,
        confidence: old.confidence,
        source: old.source,
        status: "review" as const,
        warning: block.warning || "Se conservó el último reconocimiento válido.",
      }
    }
    return block
  })
}

export function combinedLatex(blocks: WhiteboardMathBlock[]) {
  return blocks
    .filter((block) => block.latex.trim())
    .map((block) => block.latex.trim())
    .join(" \\\\ ")
}

export function blockSvg(
  strokes: WhiteboardStroke[],
  bounds: WhiteboardBounds,
  options: { padding?: number; strokeWidth?: number } = {},
) {
  const padding = options.padding ?? 24
  const strokeWidth = options.strokeWidth ?? 5
  const width = Math.max(96, Math.ceil(bounds.width + padding * 2))
  const height = Math.max(96, Math.ceil(bounds.height + padding * 2))
  const polylines = strokes.map((stroke) => {
    const points = stroke.points
      .map((point) => `${Math.round(point.x - bounds.x + padding)},${Math.round(point.y - bounds.y + padding)}`)
      .join(" ")
    return `<polyline points="${points}" fill="none" stroke="#111827" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
  }).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/>${polylines}</svg>`
}

export function svgDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`
}
