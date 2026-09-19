import type { TiempoPlanificacion } from "@/lib/planificador-curriculum"

export type SchoolPlanningHorizon = Extract<TiempoPlanificacion, "mensual" | "semestral" | "anual">

export interface SchoolPlanningWeek {
  key: string
  month: string
  week: number
  oaIds: string[]
}

export const SCHOOL_YEAR_MONTHS = [
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const

export const SCHOOL_SEMESTER_OPTIONS = [
  { id: "primer-semestre", label: "I SEMESTRE · marzo a junio" },
  { id: "segundo-semestre", label: "II SEMESTRE · julio a diciembre" },
] as const

export function isSchoolPlanningMacro(value: TiempoPlanificacion): value is SchoolPlanningHorizon {
  return value === "mensual" || value === "semestral" || value === "anual"
}

export function getSchoolPlanningMonths(
  horizon: TiempoPlanificacion,
  periodoId: string,
  fallbackMonth = "marzo"
): string[] {
  if (horizon === "mensual") {
    const month = SCHOOL_YEAR_MONTHS.includes(periodoId as (typeof SCHOOL_YEAR_MONTHS)[number])
      ? periodoId
      : SCHOOL_YEAR_MONTHS.includes(fallbackMonth as (typeof SCHOOL_YEAR_MONTHS)[number])
        ? fallbackMonth
        : "marzo"
    return [month]
  }

  if (horizon === "semestral") {
    return periodoId === "segundo-semestre"
      ? ["julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
      : ["marzo", "abril", "mayo", "junio"]
  }

  if (horizon === "anual") return [...SCHOOL_YEAR_MONTHS]
  return []
}

export function getSchoolPlanningPeriodLabel(
  horizon: TiempoPlanificacion,
  periodoId: string,
  fallbackMonth = "marzo"
): string {
  if (horizon === "mensual") {
    const month = getSchoolPlanningMonths(horizon, periodoId, fallbackMonth)[0] || fallbackMonth
    return `PLANIFICACIÓN MENSUAL · ${month.toUpperCase()}`
  }
  if (horizon === "semestral") {
    return periodoId === "segundo-semestre" ? "II SEMESTRE" : "I SEMESTRE"
  }
  if (horizon === "anual") return "PLANIFICACIÓN ANUAL"
  if (horizon === "semanal") return "PLANIFICACIÓN SEMANAL"
  return "PLANIFICACIÓN DIARIA"
}

export function buildSchoolWeekPlan(
  horizon: TiempoPlanificacion,
  periodoId: string,
  fallbackMonth = "marzo",
  previous: SchoolPlanningWeek[] = []
): SchoolPlanningWeek[] {
  const previousByKey = new Map(previous.map((item) => [item.key, item]))
  const months = getSchoolPlanningMonths(horizon, periodoId, fallbackMonth)
  return months.flatMap((month) =>
    [1, 2, 3, 4].map((week) => {
      const key = `${month}-${week}`
      return {
        key,
        month,
        week,
        oaIds: previousByKey.get(key)?.oaIds || [],
      }
    })
  )
}

export function schoolPlanningMonthLabel(month: string) {
  return month ? month.charAt(0).toUpperCase() + month.slice(1) : month
}

export function expectedSchoolWeekLabel(month: string, week: number) {
  return week === 1 ? `${schoolPlanningMonthLabel(month)}\n1` : String(week)
}

export function normalizeSchoolWeekLabel(value: string) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

export function validateSchoolPlanningWeeks(
  actual: SchoolPlanningWeek[],
  horizon: TiempoPlanificacion,
  periodoId: string,
  fallbackMonth = "marzo"
) {
  const expected = buildSchoolWeekPlan(horizon, periodoId, fallbackMonth)
  if (actual.length !== expected.length) {
    return { valid: false, error: `Se esperaban ${expected.length} semanas y se recibieron ${actual.length}.`, expected }
  }
  for (let index = 0; index < expected.length; index += 1) {
    const got = actual[index]
    const want = expected[index]
    if (!got || got.key !== want.key || got.month !== want.month || got.week !== want.week) {
      return {
        valid: false,
        error: `La semana ${index + 1} no corresponde al período solicitado. Se esperaba ${want.key}.`,
        expected,
      }
    }
  }
  return { valid: true, error: "", expected }
}
