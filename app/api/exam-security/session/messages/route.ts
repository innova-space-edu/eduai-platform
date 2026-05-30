// app/api/exam-security/session/messages/route.ts
// Entrega mensajes/notificaciones enviados por administradores a una sesión de examen.
// Usa polling corto desde el cliente del examen como respaldo robusto, incluso si
// Supabase Realtime no está habilitado para usuarios anónimos.

import { NextRequest } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { getSecuritySessionById } from "@/lib/exam-security/session"

export const dynamic = "force-dynamic"
export const revalidate = 0

type AdminExamMessage = {
  id: string
  action: string
  kind: "notification" | "message"
  title: string
  message: string
  created_at: string
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL no configurada")
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")

  return createAdminClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function normalizeMessage(row: {
  id: unknown
  action_type?: unknown
  reason?: unknown
  payload?: unknown
  created_at?: unknown
}): AdminExamMessage | null {
  const payload = asRecord(row.payload)
  if (payload.message_channel !== "exam_admin_message") return null

  const text = String(payload.message || row.reason || "").trim()
  if (!text) return null

  const rawKind = String(payload.message_kind || "message")
  const kind: AdminExamMessage["kind"] =
    rawKind === "notification" ? "notification" : "message"

  return {
    id: String(row.id || ""),
    action: String(payload.action || row.action_type || "message"),
    kind,
    title: String(
      payload.title ||
        (kind === "notification"
          ? "Notificación del administrador"
          : "Mensaje del administrador")
    ),
    message: text,
    created_at: String(row.created_at || ""),
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get("sessionId") || "").trim()
    const examId = String(req.nextUrl.searchParams.get("examId") || "").trim()
    const runtimeId = String(
      req.headers.get("x-exam-runtime-id") ||
        req.nextUrl.searchParams.get("runtimeId") ||
        ""
    ).trim()

    if (!sessionId || !examId) {
      return Response.json(
        { success: false, error: "Faltan sessionId o examId." },
        { status: 400 }
      )
    }

    const session = await getSecuritySessionById(sessionId)

    if (!session || session.exam_id !== examId) {
      return Response.json(
        { success: false, error: "La sesión solicitada no existe." },
        { status: 404 }
      )
    }

    // Si la sesión tiene identificador de runtime, exigir coincidencia. Esto
    // evita que otro navegador consulte mensajes con solo conocer el UUID.
    const storedRuntimeId = String(
      session.client_metadata?.examSecurityRuntimeId || ""
    ).trim()

    if (storedRuntimeId && runtimeId !== storedRuntimeId) {
      return Response.json(
        { success: false, error: "Runtime de sesión inválido." },
        { status: 403 }
      )
    }

    const admin = getAdmin()
    const { data, error } = await admin
      .from("exam_security_actions")
      .select("id, action_type, reason, payload, created_at")
      .eq("session_id", sessionId)
      .gte("created_at", session.started_at)
      .order("created_at", { ascending: false })
      .limit(40)

    if (error) {
      console.error("[exam-security/session/messages:GET]", error.message)
      return Response.json(
        { success: false, error: "No se pudieron cargar los mensajes." },
        { status: 500 }
      )
    }

    const messages = (data ?? [])
      .map(normalizeMessage)
      .filter((item): item is AdminExamMessage => Boolean(item?.id))
      .reverse()

    return Response.json(
      { success: true, data: { messages } },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    )
  } catch (error) {
    console.error("[exam-security/session/messages:GET]", error)
    return Response.json(
      { success: false, error: "No se pudieron cargar los mensajes." },
      { status: 500 }
    )
  }
}
