import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAvailableAsignaturas, getCurriculumVerification, type NivelKey } from "@/lib/mineduc-oa"
import { getPlannerOAOptions, getPlannerSummary, getPlannerUnits } from "@/lib/planificador-curriculum"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = req.nextUrl.searchParams
  const nivel = (params.get("nivel") || "basica") as NivelKey
  const curso = params.get("curso") || "1° Básico"
  const asignatura = params.get("asignatura") || "Matemática"
  const unidadId = params.get("unidadId") || undefined
  const state = { nivel, curso, asignatura }

  return NextResponse.json({
    ok: true,
    source: "data/mineduc",
    verification: getCurriculumVerification(nivel, curso, asignatura),
    asignaturas: getAvailableAsignaturas(nivel, curso),
    units: getPlannerUnits(state),
    oas: getPlannerOAOptions(state, unidadId),
    summary: getPlannerSummary(state),
  })
}
