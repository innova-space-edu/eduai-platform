import assert from "node:assert/strict"
import { runBrainAIShadow } from "../lib/brain-ai/brain-core"

const memory = runBrainAIShadow({ input: "Recuerda lo que hicimos antes y dime el resultado", modalities: ["text"], shadowMode: true })
assert.equal(memory.route, "FAST_MEMORY")
assert.ok(memory.memoryPolicy.read.includes("episodic"))
assert.equal(memory.memoryPolicy.decision, "NOOP")
assert.equal(memory.memoryPolicy.injectIntoPrompt, false)

const audio = runBrainAIShadow({ input: "Escucha esta clase y crea una evaluación", modalities: ["text", "audio"], shadowMode: true })
assert.equal(audio.intent, "multimodal_reasoning")
assert.ok(audio.plan.some(step => step.capabilityId === "audio.whisper"))
assert.ok(audio.plan.some(step => step.capabilityId === "multimodal.fusion"))
assert.ok(audio.gates.some(gate => gate.id === "shadow" && gate.passed))

const image = runBrainAIShadow({ input: "Analiza esta imagen", modalities: ["image"], shadowMode: true })
assert.equal(image.intent, "analyze_image")
assert.ok(image.plan.some(step => step.capabilityId === "image.classification"))
assert.ok(image.plan.some(step => step.capabilityId === "image.vision"))

const video = runBrainAIShadow({ input: "Analiza profundamente este video", modalities: ["video"], shadowMode: true })
assert.equal(video.intent, "analyze_video")
assert.equal(video.route, "DEEP_COGNITION")
assert.ok(video.plan.some(step => step.capabilityId === "video.analysis"))

const assessment = runBrainAIShadow({ input: "Crea una evaluación de matemática alineada con OA MINEDUC", modalities: ["text", "tool"], shadowMode: true })
assert.ok(assessment.memoryPolicy.read.includes("curriculum"))
assert.ok(assessment.memoryPolicy.read.includes("canonical"))
assert.ok(assessment.plan.some(step => step.capabilityId === "tools.eduai"))

const defaultText = runBrainAIShadow({ input: "Hola", modalities: [], shadowMode: true })
assert.deepEqual(defaultText.modalities, ["text"])
assert.equal(defaultText.shadowMode, true)

console.log(`Brain AI checks passed · ${[memory, audio, image, video, assessment, defaultText].length} scenarios`)
