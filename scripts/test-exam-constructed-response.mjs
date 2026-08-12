import { readFileSync } from "node:fs"

const checks = [
  ["app/examen/crear/page.tsx", [
    "EXAM_CONSTRUCTED_RESPONSE_V1",
    "RESPONSE_MODE_OPTIONS",
    "Respuesta corta",
    "Respuesta construida",
    "showStimulusToStudent",
    "aiShowSourceToStudent",
    "acceptedAnswers",
    "math_steps",
  ]],
  ["app/api/agents/examen-docente/route.ts", [
    "EXAM_CONSTRUCTED_RESPONSE_API_V1",
    "responseMode",
    "stimulusText",
    "showStimulusToStudent",
  ]],
  ["app/examen/p/[code]/page.tsx", [
    "EXAM_CONSTRUCTED_PUBLIC_V1",
    'return ["math", "text_math", "math_steps"].includes',
  ]],
  ["components/exam/QuestionCard.tsx", [
    "Respuesta construida",
    "Respuesta breve",
    "Texto + matemática",
    "Procedimiento paso a paso",
    "stimulusText",
    "shouldUseNotebook",
  ]],
]

for (const [path, needles] of checks) {
  const source = readFileSync(path, "utf8")
  for (const needle of needles) {
    if (!source.includes(needle)) {
      throw new Error(`[test-exam-constructed] Falta ${needle} en ${path}`)
    }
  }
}

console.log("[test-exam-constructed] respuestas construidas, estímulos y modos matemáticos OK")
