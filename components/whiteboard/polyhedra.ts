export type SolidPoint = { x: number; y: number; z: number }

type Polyhedron = {
  vertices: SolidPoint[]
  faces: number[][]
  parents: number[]
}

const points = (coordinates: number[][]): SolidPoint[] =>
  coordinates.map(([x, y, z]) => ({ x, y, z }))

const box = (halfWidth: number): Polyhedron => ({
  vertices: points([
    [-halfWidth, -1, -1], [halfWidth, -1, -1], [halfWidth, 1, -1], [-halfWidth, 1, -1],
    [-halfWidth, -1, 1], [halfWidth, -1, 1], [halfWidth, 1, 1], [-halfWidth, 1, 1],
  ]),
  faces: [[4, 5, 6, 7], [5, 1, 2, 6], [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4], [1, 0, 3, 2]],
  parents: [-1, 0, 0, 0, 0, 1],
})

const polyhedra: Record<string, Polyhedron> = {
  cube: box(1),
  prism: box(1.35),
  pyramid: {
    vertices: points([[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[0,0,-2]]),
    faces: [[0,1,2,3],[1,0,4],[2,1,4],[3,2,4],[0,3,4]],
    parents: [-1,0,0,0,0],
  },
  tetrahedron: {
    vertices: points([[-1,-Math.sqrt(3)/3,0],[1,-Math.sqrt(3)/3,0],[0,2*Math.sqrt(3)/3,0],[0,0,-Math.sqrt(8/3)]]),
    faces: [[0,1,2],[1,0,3],[2,1,3],[0,2,3]],
    parents: [-1,0,0,0],
  },
  "triangular-prism": {
    vertices: points([[-1,-1,1],[1,-1,1],[0,-1,1-Math.sqrt(3)],[-1,1,1],[1,1,1],[0,1,1-Math.sqrt(3)]]),
    faces: [[0,1,4,3],[1,2,5,4],[2,0,3,5],[1,0,2],[3,4,5]],
    parents: [-1,0,0,0,0],
  },
}

export const getPolyhedron = (shape: string) => Object.hasOwn(polyhedra, shape) ? polyhedra[shape] : undefined

export const add = (a: SolidPoint, b: SolidPoint): SolidPoint => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z })
export const subtract = (a: SolidPoint, b: SolidPoint): SolidPoint => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z })
export const scale = (v: SolidPoint, s: number): SolidPoint => ({ x: v.x*s, y: v.y*s, z: v.z*s })
export const dot = (a: SolidPoint, b: SolidPoint) => a.x*b.x + a.y*b.y + a.z*b.z
export const cross = (a: SolidPoint, b: SolidPoint): SolidPoint => ({ x: a.y*b.z-a.z*b.y, y: a.z*b.x-a.x*b.z, z: a.x*b.y-a.y*b.x })
export const unit = (v: SolidPoint) => scale(v, 1 / Math.hypot(v.x, v.y, v.z))
export const center = (vertices: SolidPoint[]) => scale(vertices.reduce(add), 1/vertices.length)

function normal(vertices: SolidPoint[]) {
  const [a, b, c] = vertices
  return unit(cross(subtract(b, a), subtract(c, a)))
}

function rotateAround(point: SolidPoint, origin: SolidPoint, axis: SolidPoint, angle: number) {
  const v = subtract(point, origin)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return add(origin, add(add(scale(v, cos), scale(cross(axis, v), sin)), scale(axis, dot(axis, v)*(1-cos))))
}

export function solidFaces(model: Polyhedron, unfold: number, separation: number): SolidPoint[][] {
  const originalFaces = model.faces.map(face => face.map(vertex => model.vertices[vertex]))
  const solidCenter = center(model.vertices)
  const transforms: ((point: SolidPoint) => SolidPoint)[] = []
  return originalFaces.map((face, index) => {
    const parent = model.parents[index]
    if (parent < 0) {
      transforms.push(point => point)
    } else {
      const [a, b] = model.faces[index].filter(vertex => model.faces[parent].includes(vertex))
      const origin = model.vertices[a]
      const axis = unit(subtract(model.vertices[b], origin))
      const from = normal(face)
      const to = normal(originalFaces[parent])
      const angle = Math.atan2(dot(axis, cross(from, to)), dot(from, to))
      transforms.push(point => transforms[parent](rotateAround(point, origin, axis, unfold*angle)))
    }
    const offset = scale(unit(subtract(center(face), solidCenter)), separation)
    return face.map(point => add(transforms[index](point), offset))
  })
}

export function edgeCount(model: Polyhedron) {
  const edges = new Set<string>()
  for (const face of model.faces) {
    face.forEach((a, index) => {
      const b = face[(index+1)%face.length]
      edges.add([Math.min(a,b), Math.max(a,b)].join(":"))
    })
  }
  return edges.size
}
