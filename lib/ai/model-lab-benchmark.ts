import { callModelLabText, supportsTextSmoke } from "@/lib/ai/model-lab-smoke"

export type ModelLabBenchmarkCase = {
  id: string
  label: string
  passed: boolean
  latencyMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  detail: string
}

export type ModelLabTextBenchmarkResult = {
  suite: "model-lab-text-v1"
  provider: string
  model: string
  supported: boolean
  passed: boolean
  qualityScore: number
  reliabilityScore: number
  averageLatencyMs: number | null
  inputTokens: number
  outputTokens: number
  cases: ModelLabBenchmarkCase[]
  detail: string
}

type BenchmarkDefinition = {
  id: string
  label: string
  prompt: string
  maxTokens: number
  check: (text: string) => boolean
}

const CASES: BenchmarkDefinition[] = [
  {
    id: "instruction_exact",
    label: "Instruction following",
    prompt: "Prueba de instrucciones. Responde exactamente EDUAI_BENCH_OK y nada más.",
    maxTokens: 32,
    check: text => text.trim() === "EDUAI_BENCH_OK",
  },
  {
    id: "arithmetic",
    label: "Razonamiento aritmético",
    prompt: "Calcula 37 × 19. Responde únicamente con el número final, sin explicación.",
    maxTokens: 32,
    check: text => text.trim().replace(/[.,]$/, "") === "703",
  },
  {
    id: "structured_json",
    label: "Salida estructurada",
    prompt: 'Responde únicamente con JSON válido y exactamente estas claves: {"curso":"1 medio","preguntas":3,"ok":true}. No uses markdown.',
    maxTokens: 80,
    check: text => {
      try {
        const clean = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")
        const parsed = JSON.parse(clean)
        return parsed?.curso === "1 medio" && parsed?.preguntas === 3 && parsed?.ok === true && Object.keys(parsed).length === 3
      } catch {
        return false
      }
    },
  },
  {
    id: "spanish_education",
    label: "Instrucción educativa en español",
    prompt: "Escribe exactamente tres líneas. Cada línea debe comenzar con OA-. Tema: conservación de la materia para 1° medio. No agregues título ni explicación.",
    maxTokens: 120,
    check: text => {
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      return lines.length === 3 && lines.every(line => line.startsWith("OA-") && line.length >= 12)
    },
  },
]

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
}

export async function runModelLabTextBenchmark(provider: string, model: string, capabilities: string[]): Promise<ModelLabTextBenchmarkResult> {
  if (!supportsTextSmoke(capabilities)) {
    return {
      suite: "model-lab-text-v1",
      provider,
      model,
      supported: false,
      passed: false,
      qualityScore: 0,
      reliabilityScore: 0,
      averageLatencyMs: null,
      inputTokens: 0,
      outputTokens: 0,
      cases: [],
      detail: "El candidato no declara capacidades de texto. Debe usar una suite específica de modalidad.",
    }
  }

  const results: ModelLabBenchmarkCase[] = []
  for (const definition of CASES) {
    const call = await callModelLabText(provider, model, capabilities, definition.prompt, definition.maxTokens)
    const passed = call.ok && definition.check(call.text)
    results.push({
      id: definition.id,
      label: definition.label,
      passed,
      latencyMs: call.latencyMs,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
      detail: call.ok ? (passed ? "PASS" : "Respuesta válida del endpoint, pero no cumplió el criterio determinista.") : call.detail,
    })
    if (!call.supported) break
  }

  const passedCases = results.filter(item => item.passed).length
  const qualityScore = results.length ? passedCases / results.length : 0
  const successfulTransport = results.filter(item => item.latencyMs != null && !item.detail.toLowerCase().includes("falta api key")).length
  const reliabilityScore = results.length ? successfulTransport / results.length : 0
  const latencies = results.map(item => item.latencyMs).filter((value): value is number => typeof value === "number")
  const inputTokens = results.reduce((sum, item) => sum + (item.inputTokens || 0), 0)
  const outputTokens = results.reduce((sum, item) => sum + (item.outputTokens || 0), 0)
  const supported = results.length ? !results.some(item => item.detail.includes("requiere un benchmark") || item.detail.includes("adapter")) : true
  const passed = supported && results.length === CASES.length && qualityScore >= 0.75 && reliabilityScore >= 0.75

  return {
    suite: "model-lab-text-v1",
    provider,
    model,
    supported,
    passed,
    qualityScore,
    reliabilityScore,
    averageLatencyMs: average(latencies),
    inputTokens,
    outputTokens,
    cases: results,
    detail: passed
      ? `Benchmark aprobado: ${passedCases}/${CASES.length} casos.`
      : `Benchmark no aprobado: ${passedCases}/${CASES.length} casos. Requiere revisión antes de validar.`,
  }
}
