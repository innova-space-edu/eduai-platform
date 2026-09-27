import rulesData from "@/data/parvularia/safety-lexicon.json"

export type ParvulariaSafetyScope = "sala_cuna" | "parvularia"

export type ParvulariaSafetyRule = {
  termPattern: string
  scope: ParvulariaSafetyScope
  reason: string
  safeAlternative: string
}

export type ParvulariaSafetyIssue = ParvulariaSafetyRule & {
  matchedText: string
}

const RULES = rulesData as ParvulariaSafetyRule[]

function isSalaCuna(course: string) {
  return course.toLocaleLowerCase("es-CL").includes("sala cuna")
}

function appliesToCourse(rule: ParvulariaSafetyRule, course: string, secondCourse?: string) {
  if (rule.scope === "parvularia") return true
  return isSalaCuna(course) || Boolean(secondCourse && isSalaCuna(secondCourse))
}

export function findParvulariaSafetyIssues(
  value: string,
  course: string,
  secondCourse?: string,
): ParvulariaSafetyIssue[] {
  const source = String(value || "")
  return RULES.flatMap((rule) => {
    if (!appliesToCourse(rule, course, secondCourse)) return []
    const regex = new RegExp(rule.termPattern, "iu")
    const match = source.match(regex)
    return match
      ? [{ ...rule, matchedText: match[0] }]
      : []
  })
}

export function buildParvulariaSafetyPrompt(course: string, secondCourse?: string) {
  const activeRules = RULES.filter((rule) => appliesToCourse(rule, course, secondCourse))
  if (!activeRules.length) return ""

  const grouped = activeRules.map((rule) =>
    `- Evita: ${rule.termPattern}. Motivo: ${rule.reason} Alternativa: ${rule.safeAlternative}`
  )

  return [
    "SEGURIDAD DETERMINISTA PARA EDUCACIÓN PARVULARIA:",
    "Estas reglas también serán verificadas por código antes de entregar la planificación; no dependen solo de este prompt.",
    ...grouped,
    "Si un OA exige una acción con un elemento normalmente sensible, usa una versión integrada, sellada, no desprendible y apropiada para la edad, siempre que no coincida con un patrón prohibido.",
  ].join("\n")
}

export function getParvulariaSafetyRules(course: string, secondCourse?: string) {
  return RULES.filter((rule) => appliesToCourse(rule, course, secondCourse))
}
