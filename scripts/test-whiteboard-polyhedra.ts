import assert from "node:assert/strict"
import { dot, edgeCount, getPolyhedron, solidFaces, subtract, type SolidPoint } from "../components/whiteboard/polyhedra"

const epsilon = 1e-8
const distance = (a: SolidPoint, b: SolidPoint) => {
  const d = subtract(a, b)
  return Math.hypot(d.x, d.y, d.z)
}

function overlap(a: SolidPoint[], b: SolidPoint[]) {
  // Convex faces have disjoint interiors if any edge normal separates their projections.
  return [a, b].every(face => face.every((point, index) => {
    const edge = subtract(face[(index + 1) % face.length], point)
    const axis = { x: -edge.y, y: edge.x, z: 0 }
    const first = a.map(vertex => dot(axis, vertex))
    const second = b.map(vertex => dot(axis, vertex))
    return Math.min(Math.max(...first), Math.max(...second)) -
      Math.max(Math.min(...first), Math.min(...second)) > epsilon
  }))
}

for (const [shape, expected] of Object.entries({
  cube: [6, 12, 8],
  prism: [6, 12, 8],
  pyramid: [5, 8, 5],
  tetrahedron: [4, 6, 4],
  "triangular-prism": [5, 9, 6],
})) {
  const model = getPolyhedron(shape)!
  assert.deepEqual([model.faces.length, edgeCount(model), model.vertices.length], expected)
  const closed = solidFaces(model, 0, 0)
  assert.deepEqual(closed, model.faces.map(face => face.map(vertex => model.vertices[vertex])))

  for (const progress of [.25, .5, .75, 1]) {
    const faces = solidFaces(model, progress, 0)
    faces.forEach((face, index) => {
      face.forEach((point, i) => {
        face.forEach((other, j) => {
          assert.ok(Math.abs(distance(point, other) - distance(closed[index][i], closed[index][j])) < epsilon)
        })
      })
      const parent = model.parents[index]
      if (parent < 0) return
      const shared = model.faces[index].filter(vertex => model.faces[parent].includes(vertex))
      assert.equal(shared.length, 2)
      for (const vertex of shared) {
        assert.ok(distance(face[model.faces[index].indexOf(vertex)], faces[parent][model.faces[parent].indexOf(vertex)]) < epsilon)
      }
    })
  }

  const net = solidFaces(model, 1, 0)
  net.forEach((face, index) => {
    assert.ok(face.every(vertex => Math.abs(vertex.z - net[0][0].z) < epsilon), `${shape}: nonplanar face`)
    for (const other of net.slice(index + 1)) {
      assert.ok(!overlap(face, other), `${shape}: overlapping faces`)
    }
  })
}
console.log("EduAI polyhedra: all five nets are planar, preserve face dimensions and hinges, and have no interior overlap")
