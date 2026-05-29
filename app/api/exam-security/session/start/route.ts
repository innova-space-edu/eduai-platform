// app/api/exam-security/session/start/route.ts

import { NextRequest } from "next/server"
import {
  DEFAULT_SECURITY_POLICY,
  getResolvedSecurityPolicy,
} from "@/lib/exam-security/policy"
import {
  startOrReuseSecuritySession,
} from "@/lib/exam-security/session"
import type {
  SecuritySessionStartInput,
  SecuritySessionStartResponse,
} from "@/lib/exam-security/types"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SecuritySessionStartInput

    const examId = String(body.examId || "").trim()
    const submissionId = body.submissionId ? String(body.submissionId).trim() : null
    const studentName = body.studentName ? String(body.studentName).trim() : null
    const studentCourse = body.studentCourse ? String(body.studentCourse).trim() : null
    const studentRut = body.studentRut ? String(body.studentRut).trim() : null
    const clientMetadata =
      body.clientMetadata && typeof body.clientMetadata === "object"
        ? body.clientMetadata
        : {}

    if (!examId) {
      return Response.json(
        {
          success: false,
          error: "Falta examId.",
        },
        { status: 400 }
      )
    }

    let policy = DEFAULT_SECURITY_POLICY

    try {
      policy = await getResolvedSecurityPolicy(examId)
    } catch (policyError) {
      console.error(
        "[exam-security/session/start:policy] Se usará política por defecto para registrar presencia",
        policyError
      )
      policy = DEFAULT_SECURITY_POLICY
    }

    // IMPORTANTE:
    // La sesión se crea siempre para que el panel admin pueda ver quién ingresó
    // al examen, aunque el monitoreo estricto esté deshabilitado o la tabla de
    // políticas aún no tenga configuración para ese examen.
    const session = await startOrReuseSecuritySession({
      examId,
      submissionId,
      studentName,
      studentCourse,
      studentRut,
      clientMetadata,
    })

    const clientPolicy = policy.enabled
      ? policy
      : {
          ...policy,
          requireFullscreen: false,
          blockCopyPaste: false,
          blockContextMenu: false,
          blockShortcuts: false,
          preventTextSelection: false,
          heartbeatIntervalSec: Math.max(3, Math.min(policy.heartbeatIntervalSec || 5, 10)),
        }

    const response: SecuritySessionStartResponse = {
      success: true,
      sessionId: session.id,
      policy: clientPolicy,
      session,
    }

    return Response.json(response, { status: 200 })
  } catch (error) {
    console.error("[exam-security/session/start:POST]", error)

    return Response.json(
      {
        success: false,
        error: "No se pudo iniciar la sesión de seguridad.",
      },
      { status: 500 }
    )
  }
}
