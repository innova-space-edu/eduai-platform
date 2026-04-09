// lib/superagent/draft-engine.ts

import { SUPERAGENT_CONFIG } from "./config"
import { canWriteToTarget } from "./guardrails"
import {
  logSuperAgentBlocked,
  logSuperAgentInfo,
  serializeSuperAgentLog,
} from "./logger"
import type {
  SuperAgentRunLog,
  SuperAgentUserContext,
} from "./types"

export type DraftType =
  | "study_guide"
  | "lesson_plan"
  | "exam"
  | "research_outline"
  | "prompt_pack"
  | "generic"

export interface SuperAgentDraftFile {
  id: string
  title: string
  filename: string
  draftType: DraftType
  content: string
  summary: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface SuperAgentDraftResult {
  ok: boolean
  message: string
  target: "drafts"
  draft?: SuperAgentDraftFile
  logs: Record<string, unknown>[]
}

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase()
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function detectDraftType(goal?: string): DraftType {
  const text = normalizeText(goal)

  if (
    text.includes("guía") ||
    text.includes("guia") ||
    text.includes("estudio")
  ) {
    return "study_guide"
  }

  if (
    text.includes("planificación") ||
    text.includes("planificacion") ||
    text.includes("clase") ||
    text.includes("oa") ||
    text.includes("indicador")
  ) {
    return "lesson_plan"
  }

  if (
    text.includes("prueba") ||
    text.includes("examen") ||
    text.includes("evaluación") ||
    text.includes("evaluacion") ||
    text.includes("rubrica") ||
    text.includes("rúbrica")
  ) {
    return "exam"
  }

  if (
    text.includes("paper") ||
    text.includes("investigación") ||
    text.includes("investigacion") ||
    text.includes("estado del arte") ||
    text.includes("referencia")
  ) {
    return "research_outline"
  }

  if (
    text.includes("prompt") ||
    text.includes("mejorar prompt") ||
    text.includes("optimizar prompt")
  ) {
    return "prompt_pack"
  }

  return "generic"
}

function buildDraftTitle(
  draftType: DraftType,
  context: SuperAgentUserContext
): string {
  const goal = context.userGoal?.trim()

  if (goal && goal.length > 0) {
    return `Borrador anticipado: ${goal}`
  }

  switch (draftType) {
    case "study_guide":
      return "Borrador anticipado de guía de estudio"
    case "lesson_plan":
      return "Borrador anticipado de planificación"
    case "exam":
      return "Borrador anticipado de evaluación"
    case "research_outline":
      return "Borrador anticipado de investigación"
    case "prompt_pack":
      return "Borrador anticipado de prompts"
    default:
      return "Borrador anticipado general"
  }
}

function buildDraftSummary(
  draftType: DraftType,
  context: SuperAgentUserContext
): string {
  const page = context.currentPage || "sin página"
  const goal = context.userGoal || "sin objetivo explícito"

  return `EduAI Claw anticipó un borrador tipo "${draftType}" basándose en el objetivo "${goal}" desde la página "${page}".`
}

function buildDraftBody(
  draftType: DraftType,
  context: SuperAgentUserContext
): string {
  const goal = context.userGoal || "Objetivo no especificado"
  const page = context.currentPage || "Página no especificada"
  const tags = (context.tags || []).join(", ") || "sin etiquetas"

  switch (draftType) {
    case "study_guide":
      return `# Guía de estudio anticipada

## Objetivo detectado
${goal}

## Contexto
- Página actual: ${page}
- Etiquetas: ${tags}

## Propuesta inicial
1. Introducción breve al tema.
2. Explicación paso a paso.
3. Ejemplos resueltos.
4. Ejercicios para practicar.
5. Cierre o síntesis.

## Sugerencia de desarrollo
EduAI Claw detectó que podría ser útil preparar una guía estructurada antes de que el usuario la solicite directamente.
`

    case "lesson_plan":
      return `# Planificación anticipada

## Objetivo detectado
${goal}

## Contexto
- Página actual: ${page}
- Etiquetas: ${tags}

## Estructura sugerida
- Objetivo de aprendizaje
- Indicadores
- Inicio
- Desarrollo
- Cierre
- Evaluación
- Recursos

## Observación
Este borrador fue creado como propuesta preliminar segura por EduAI Claw.
`

    case "exam":
      return `# Evaluación anticipada

## Objetivo detectado
${goal}

## Contexto
- Página actual: ${page}
- Etiquetas: ${tags}

## Propuesta de estructura
- Ítem 1: alternativas
- Ítem 2: verdadero y falso
- Ítem 3: desarrollo

## Sugerencias
- Ajustar dificultad
- Definir tiempo estimado
- Incluir criterios de corrección
`

    case "research_outline":
      return `# Esquema de investigación anticipado

## Objetivo detectado
${goal}

## Contexto
- Página actual: ${page}
- Etiquetas: ${tags}

## Estructura preliminar
1. Problema o pregunta central
2. Justificación
3. Marco teórico inicial
4. Posibles referencias
5. Metodología sugerida
6. Próximos pasos
`

    case "prompt_pack":
      return `# Pack de prompts anticipado

## Objetivo detectado
${goal}

## Contexto
- Página actual: ${page}
- Etiquetas: ${tags}

## Prompt base
"${goal}"

## Variante 1
Reformula el objetivo de manera más clara, precisa y útil.

## Variante 2
Convierte este objetivo en una instrucción más detallada para un agente especializado.

## Variante 3
Genera una versión optimizada para obtener una respuesta más estructurada.
`

    default:
      return `# Borrador anticipado general

## Objetivo detectado
${goal}

## Contexto
- Página actual: ${page}
- Etiquetas: ${tags}

## Nota
EduAI Claw creó este borrador como propuesta inicial segura para ayudar al usuario a avanzar más rápido.
`
  }
}

export async function createSafeDraft(
  context: SuperAgentUserContext
): Promise<SuperAgentDraftResult> {
  const logs: SuperAgentRunLog[] = []

  if (!canWriteToTarget("drafts")) {
    logs.push(
      logSuperAgentBlocked({
        action: "draft_creation_blocked",
        target: "drafts",
        message:
          "EduAI Claw no tiene permitido escribir en el target drafts según la configuración actual.",
      })
    )

    return {
      ok: false,
      message: "La creación de borradores fue bloqueada por configuración.",
      target: "drafts",
      logs: logs.map(serializeSuperAgentLog),
    }
  }

  if (!SUPERAGENT_CONFIG.features.draftCreationEnabled) {
    logs.push(
      logSuperAgentBlocked({
        action: "draft_feature_disabled",
        target: "drafts",
        message: "La creación de borradores está deshabilitada.",
      })
    )

    return {
      ok: false,
      message: "La creación de borradores está deshabilitada.",
      target: "drafts",
      logs: logs.map(serializeSuperAgentLog),
    }
  }

  const draftType = detectDraftType(context.userGoal)
  const title = buildDraftTitle(draftType, context)
  const summary = buildDraftSummary(draftType, context)
  const content = buildDraftBody(draftType, context)

  const timestamp = new Date().toISOString()
  const filenameBase = slugify(title) || "borrador_anticipado"

  const draft: SuperAgentDraftFile = {
    id: crypto.randomUUID(),
    title,
    filename: `${filenameBase}.md`,
    draftType,
    content,
    summary,
    createdAt: timestamp,
    metadata: {
      source: "EduAI Claw",
      engineAlias: SUPERAGENT_CONFIG.identity.engineAlias,
      currentPage: context.currentPage || null,
      userGoal: context.userGoal || null,
      tags: context.tags || [],
    },
  }

  logs.push(
    logSuperAgentInfo({
      action: "draft_created",
      target: "drafts",
      message: `EduAI Claw creó el borrador "${draft.filename}".`,
      skillName: "create_draft_file",
      metadata: {
        draftId: draft.id,
        draftType: draft.draftType,
        filename: draft.filename,
      },
    })
  )

  return {
    ok: true,
    message: "Borrador creado correctamente en memoria segura.",
    target: "drafts",
    draft,
    logs: logs.map(serializeSuperAgentLog),
  }
}
