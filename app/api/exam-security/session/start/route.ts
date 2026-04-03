// app/api/exam-security/session/start/route.ts

import { NextRequest } from "next/server"
import {
  getResolvedSecurityPolicy,
} from "@/lib/exam-security/policy"
import {
  startOrReuseSecuritySession,
} from "@/lib/exam-security/session"
import type {
  SecuritySessionStartInput,
  SecuritySessionStartResponse,
} from "@/lib/exam-security/types"

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

    const policy = await getResolvedSecurityPolicy(examId)

    if (!policy.enabled) {
      return Response.json(
        {
          success: false,
          error: "La seguridad del examen está deshabilitada para este examen.",
        },
        { status: 403 }
      )
    }

    const session = await startOrReuseSecuritySession({
      examId,
      submissionId,
      studentName,
      studentCourse,
      studentRut,
      clientMetadata,
    })

    const response: SecuritySessionStartResponse = {
      success: true,
      sessionId: session.id,
      policy,
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
