import assert from "node:assert/strict"
import { extrudePolygon, edgeCount, solidFaces } from "../components/whiteboard/polyhedra"
import { recognizeSketch } from "../components/whiteboard/sketch"

const point = (x: number, y: number) => ({ x, y })
const square = [point(0, 0), point(100, 0), point(100, 100), point(0, 100)]
const triangle = [point(0, 100), point(45, 0), point(100, 100)]
const circle = Array.from({ length: 65 }, (_, i) => point(50 + 48*Math.cos(i*Math.PI/32), 50 + 48*Math.sin(i*Math.PI/32)))
assert.equal(recognizeSketch([circle])?.kind, "ellipse")
assert.deepEqual(recognizeSketch([[...square, square[0]]]), { kind: "polygon", points: square })
assert.equal(recognizeSketch([[point(50, 0), ...square.slice(1), square[0], point(50, 0)]])?.points?.length, 4)
assert.deepEqual(recognizeSketch(triangle.map((vertex, i) => [vertex, triangle[(i+1)%3]])),
  { kind: "polygon", points: triangle })
assert.equal(recognizeSketch([[point(0, 50), point(100, 50)], [point(50, 0), point(50, 100)]])?.kind, "axes")
assert.deepEqual(recognizeSketch([[point(100, 0), point(0, 100)]])?.points, [point(100, 0), point(0, 100)])
assert.equal(recognizeSketch([square]), null)

for (const outline of [square, triangle]) {
  const model = extrudePolygon(outline.map(p => point(p.x / 100, p.y / 100)))
  assert.ok(model)
  assert.equal(model.vertices.length, 2 * outline.length)
  assert.equal(edgeCount(model), 3 * outline.length)
  assert.equal(solidFaces(model, 0, .85).length, outline.length + 2)
}
assert.equal(extrudePolygon([square[0], square[2], square[1], square[3]]), undefined)
console.log("EduAI sketch conversion: closed outlines, ellipse, axes, oriented vector, and polygon extrusion verified")
