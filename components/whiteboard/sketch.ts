type Point = { x: number; y: number }
export type InkBounds = { x: number; y: number; width: number; height: number }
export type Sketch = { kind: "polygon" | "ellipse" | "line" | "axes"; points?: Point[] }
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

export function inkBounds(paths: Point[][]): InkBounds {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const path of paths) {
    for (const point of path) {
      left = Math.min(left, point.x)
      right = Math.max(right, point.x)
      top = Math.min(top, point.y)
      bottom = Math.max(bottom, point.y)
    }
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function segmentDistance(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((point.x-a.x)*dx + (point.y-a.y)*dy) / length)) : 0
  return distance(point, { x: a.x + t*dx, y: a.y + t*dy })
}

function simplify(points: Point[], tolerance: number): Point[] {
  const kept = new Set([0, points.length - 1])
  const spans = [[0, points.length - 1]]
  while (spans.length) {
    const [start, end] = spans.pop()!
    let farthest = -1, maximum = tolerance
    for (let i = start + 1; i < end; i++) {
      const error = segmentDistance(points[i], points[start], points[end])
      if (error > maximum) {
        maximum = error
        farthest = i
      }
    }
    if (farthest < 0) continue
    kept.add(farthest)
    spans.push([start, farthest], [farthest, end])
  }
  return points.filter((_, index) => kept.has(index))
}

function straight(path: Point[]) {
  const a = path[0], b = path.at(-1)!
  const length = distance(a, b)
  return length > 14 && path.every(point => segmentDistance(point, a, b) <= Math.max(4, length * .065))
}

function joinOutline(paths: Point[][], tolerance: number) {
  const outline = [...paths[0]]
  for (const path of paths.slice(1)) {
    const last = outline.at(-1)!
    if (distance(last, path[0]) <= tolerance) outline.push(...path)
    else if (distance(last, path.at(-1)!) <= tolerance) outline.push(...path.slice().reverse())
    else return null
  }
  return outline
}

export function recognizeSketch(paths: Point[][]): Sketch | null {
  if (!paths.length || paths.length > 16 || paths.some(path => path.length < 2)) return null
  const bounds = inkBounds(paths)
  const size = Math.hypot(bounds.width, bounds.height)
  if (size < 18) return null
  if (paths.length === 2 && paths.every(straight)) {
    const [a, b] = paths.map(path => [path[0], path.at(-1)!])
    const horizontal = ([from, to]: Point[]) => Math.abs(to.y-from.y) < Math.abs(to.x-from.x)*.25
    const vertical = ([from, to]: Point[]) => Math.abs(to.x-from.x) < Math.abs(to.y-from.y)*.25
    const h = horizontal(a) && vertical(b) ? a : horizontal(b) && vertical(a) ? b : null
    const v = h === a ? b : a
    if (h && (v[0].x-h[0].x)*(v[0].x-h[1].x) < 0 && (h[0].y-v[0].y)*(h[0].y-v[1].y) < 0) {
      return { kind: "axes" }
    }
  }
  if (paths.length === 1 && straight(paths[0])) return { kind: "line", points: [paths[0][0], paths[0].at(-1)!] }
  const outline = joinOutline(paths, Math.max(7, size * .08))
  if (!outline || distance(outline[0], outline.at(-1)!) > Math.max(7, size * .1)) return null
  if (Math.min(bounds.width, bounds.height) < 10) return null
  const tolerance = Math.max(3, size * .025)
  const corners = simplify([...outline.slice(0, -1), outline[0]], tolerance).slice(0, -1)
  // The pen can start on an edge instead of at a corner.
  if (corners.length > 3 && segmentDistance(corners[0], corners.at(-1)!, corners[1]) <= tolerance) corners.shift()
  // A smooth loop stays close to the fitted ellipse throughout the stroke.
  const radialErrors = outline.map(point => Math.abs(1 - Math.hypot(
    2 * (point.x - bounds.x) / bounds.width - 1,
    2 * (point.y - bounds.y) / bounds.height - 1,
  )))
  if (corners.length >= 6 && radialErrors.every(error => error < .22)) return { kind: "ellipse" }
  if (corners.length < 3 || corners.length > 32) return null
  const area = Math.abs(corners.reduce((sum, point, i) => {
    const next = corners[(i + 1) % corners.length]
    return sum + (point.x-bounds.x)*(next.y-bounds.y) - (next.x-bounds.x)*(point.y-bounds.y)
  }, 0)) / 2
  return area >= bounds.width * bounds.height * .12 ? { kind: "polygon", points: corners } : null
}
