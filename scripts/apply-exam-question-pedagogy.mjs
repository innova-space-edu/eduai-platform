import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/examen/crear/page.tsx"
const API = "app/api/agents/exam-generate/route.ts"
const MARKER = "EXAM_QUESTION_PEDAGOGY_META_V1"

function block(lines) {
  return lines.join("\n")
}

function load(path) {
  if (!existsSync(path)) throw new Error(`[exam-question-pedagogy] No existe ${path}`)
  return readFileSync(path, "utf8")
}

function replaceRequired(content, from, to, label) {
  if (!content.includes(from)) {
    throw new Error(`[exam-question-pedagogy] No se encontró: ${label}`)
  }
  return content.replace(from, to)
}

function patchPage() {
  let source = load(PAGE)
  if (source.includes(MARKER)) return
  if (!source.includes("EXAM_OMNI_SUBJECT_PATCH_V1")) {
    throw new Error("[exam-question-pedagogy] Ejecuta primero apply-exam-omni-subject.mjs")
  }

  source = replaceRequired(
    source,
    block([
      "type Question =",
      "  | MultipleChoiceQuestion",
      "  | TrueFalseQuestion",
      "  | DevelopmentQuestion",
      "  | MixedChoiceDevelopmentQuestion;",
    ]),
    block([
      `// ${MARKER}`,
      "type QuestionPedagogyMeta = {",
      "  oaCodes?: string[];",
      "  pedagogicalMode?: string;",
      "  skill?: string;",
      "  evidence?: string;",
      "};",
      "",
      "type Question = (",
      "  | MultipleChoiceQuestion",
      "  | TrueFalseQuestion",
      "  | DevelopmentQuestion",
      "  | MixedChoiceDevelopmentQuestion",
      ") & QuestionPedagogyMeta;",
    ]),
    "tipo pedagógico de pregunta",
  )

  source = replaceRequired(
    source,
    block([
      "  const base = {",
      "    id: uid(),",
      '    question: (raw.question ?? raw.enunciado ?? "").trim(),',
      '    imageUrl: String(raw.imageUrl ?? raw.image_url ?? raw.image ?? "").trim(),',
      "  };",
    ]),
    block([
      "  const base = {",
      "    id: uid(),",
      '    question: (raw.question ?? raw.enunciado ?? "").trim(),',
      '    imageUrl: String(raw.imageUrl ?? raw.image_url ?? raw.image ?? "").trim(),',
      "    oaCodes: Array.isArray(raw.oaCodes ?? raw.oa_codes)",
      "      ? (raw.oaCodes ?? raw.oa_codes).map(String).filter(Boolean)",
      "      : [],",
      '    pedagogicalMode: String(raw.pedagogicalMode ?? raw.pedagogical_mode ?? "").trim(),',
      '    skill: String(raw.skill ?? raw.habilidad ?? "").trim(),',
      '    evidence: String(raw.evidence ?? raw.evidencia ?? "").trim(),',
      "  };",
    ]),
    "normalización de metadatos pedagógicos",
  )

  source = replaceRequired(
    source,
    "function getQuestionPoints(q: Question): number {",
    block([
      "function getQuestionPedagogyPayload(q: Question) {",
      "  return {",
      "    oaCodes: Array.isArray(q.oaCodes) ? q.oaCodes : [],",
      '    pedagogicalMode: q.pedagogicalMode || "",',
      '    skill: q.skill || "",',
      '    evidence: q.evidence || "",',
      "  };",
      "}",
      "",
      "function getQuestionPoints(q: Question): number {",
    ]),
    "serialización de metadatos pedagógicos",
  )

  const returnStart = block([
    "          return {",
    "            type: q.type,",
  ])
  const enrichedReturnStart = block([
    "          return {",
    "            ...getQuestionPedagogyPayload(q),",
    "            type: q.type,",
  ])
  const returnCount = source.split(returnStart).length - 1
  if (returnCount < 4) {
    throw new Error(`[exam-question-pedagogy] Se esperaban 4 payloads de preguntas y se encontraron ${returnCount}`)
  }
  source = source.replaceAll(returnStart, enrichedReturnStart)

  source = replaceRequired(
    source,
    block([
      "                        </p>",
      "                      </div>",
      "                      <button",
      "                        onClick={() => removeQuestion(q.id)}",
    ]),
    block([
      "                        </p>",
      "                        {(q.oaCodes?.length || q.pedagogicalMode || q.skill || q.evidence) && (",
      '                          <div className="mt-2 max-w-3xl">',
      '                            <div className="flex flex-wrap gap-1.5">',
      "                              {q.oaCodes?.map((code) => (",
      '                                <span key={code} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">',
      "                                  {code}",
      "                                </span>",
      "                              ))}",
      "                              {q.pedagogicalMode && (",
      '                                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">',
      "                                  {q.pedagogicalMode}",
      "                                </span>",
      "                              )}",
      "                              {q.skill && (",
      '                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">',
      "                                  Habilidad: {q.skill}",
      "                                </span>",
      "                              )}",
      "                            </div>",
      "                            {q.evidence && (",
      '                              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">',
      "                                <strong>Evidencia:</strong> {q.evidence}",
      "                              </p>",
      "                            )}",
      "                          </div>",
      "                        )}",
      "                      </div>",
      "                      <button",
      "                        onClick={() => removeQuestion(q.id)}",
    ]),
    "indicadores pedagógicos en tarjeta",
  )

  source = replaceRequired(
    source,
    '      "10. Cada pregunta debe ser adecuada a " + curriculumCurso + ", evaluable y coherente con los OA seleccionados.",',
    block([
      '      "10. Cada pregunta debe ser adecuada a " + curriculumCurso + ", evaluable y coherente con los OA seleccionados.",',
      '      "11. Cada objeto de pregunta debe incluir oaCodes (códigos OA usados), pedagogicalMode, skill y evidence. No inventes códigos que no estén en los OA entregados.",',
    ]),
    "contrato de salida pedagógico",
  )

  writeFileSync(PAGE, source)
}

function patchApi() {
  let source = load(API)
  if (!source.includes("EXAM_OMNI_SUBJECT_API_V1")) {
    throw new Error("[exam-question-pedagogy] Ejecuta primero el parche de API multiasignatura")
  }

  source = replaceRequired(
    source,
    "- Verifica internamente exactitud conceptual, coherencia disciplinar, nivel de dificultad y correspondencia con los OA.",
    block([
      "- Verifica internamente exactitud conceptual, coherencia disciplinar, nivel de dificultad y correspondencia con los OA.",
      "- Cada pregunta debe incluir oaCodes, pedagogicalMode, skill y evidence. Usa solo códigos OA entregados por el docente.",
    ]),
    "contrato pedagógico en la API",
  )

  writeFileSync(API, source)
}

patchPage()
patchApi()
console.log("[exam-question-pedagogy] OA, modo, habilidad y evidencia conectados por pregunta")
