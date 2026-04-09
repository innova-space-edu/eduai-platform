// app/api/superagent/social/session/route.ts

import { NextRequest } from "next/server"
import { SUPERAGENT_CONFIG } from "@/lib/superagent/config"
import {
  appendSocialMessage,
  checkAndPauseInactiveSessions,
  closeSocialSession,
  createSocialSession,
  getAllSocialSessions,
  getSocialSession,
  pauseSocialSession,
  resumeSocialSession,
  touchUserActivity,
} from "@/lib/superagent/social-session-store"
import type { SuperAgentTarget, SuperAgentUserContext } from "@/lib/superagent/types"

function normalizeActiveAgent(value: unknown): SuperAgentTarget | undefined {
  if (typeof value !== "string") return undefined

  const normalized = value.trim().toLowerCase()

  const allowed: SuperAgentTarget[] = [
    "chat",
    "educador",
    "investigador",
    "matematico",
    "paper",
    "imagenes",
    "audio",
    "examen",
    "social",
    "drafts",
    "unknown",
  ]

  return allowed.includes(normalized as SuperAgentTarget)
    ? (normalized as SuperAgentTarget)
    : undefined
}

function buildContextFromBody(body: Record<string, unknown>): SuperAgentUserContext {
  return {
    userId: typeof body.userId === "string" ? body.userId : undefined,
    currentPage: typeof body.currentPage === "string" ? body.currentPage : undefined,
    activeAgent: normalizeActiveAgent(body.activeAgent),
    userGoal: typeof body.userGoal === "string" ? body.userGoal : undefined,
    recentMessages: Array.isArray(body.recentMessages)
      ? body.recentMessages.filter((item): item is string => typeof item === "string")
      : [],
    tags: Array.isArray(body.tags)
      ? body.tags.filter((item): item is string => typeof item === "string")
      : [],
    metadata:
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : {},
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")
  const runCleanup = searchParams.get("cleanup") === "true"

  if (runCleanup) {
    const paused = checkAndPauseInactiveSessions()
    return Response.json({
      ok: true,
      name: SUPERAGENT_CONFIG.identity.displayName,
      alias: SUPERAGENT_CONFIG.identity.engineAlias,
      action: "cleanup",
      pausedCount: paused.length,
      sessions: paused,
    })
  }

  if (sessionId) {
    const session = getSocialSession(sessionId)

    if (!session) {
      return Response.json(
        {
          ok: false,
          error: "Sesión social no encontrada.",
        },
        { status: 404 }
      )
    }

    return Response.json({
      ok: true,
      name: SUPERAGENT_CONFIG.identity.displayName,
      alias: SUPERAGENT_CONFIG.identity.engineAlias,
      session,
    })
  }

  return Response.json({
    ok: true,
    name: SUPERAGENT_CONFIG.identity.displayName,
    alias: SUPERAGENT_CONFIG.identity.engineAlias,
    sessions: getAllSocialSessions(),
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const action =
      typeof body.action === "string" ? body.action.trim().toLowerCase() : "create"

    if (action === "create") {
      const context = buildContextFromBody(body)
      const timeoutMs =
        typeof body.inactivityTimeoutMs === "number" &&
        body.inactivityTimeoutMs >= 5000
          ? body.inactivityTimeoutMs
          : 60000

      const session = await createSocialSession(context, timeoutMs)

      return Response.json({
        ok: true,
        name: SUPERAGENT_CONFIG.identity.displayName,
        alias: SUPERAGENT_CONFIG.identity.engineAlias,
        action: "create",
        session,
      })
    }

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : ""

    if (!sessionId) {
      return Response.json(
        {
          ok: false,
          error: "Debes enviar sessionId para esta acción.",
        },
        { status: 400 }
      )
    }

    if (action === "touch") {
      const session = touchUserActivity(sessionId)

      if (!session) {
        return Response.json(
          {
            ok: false,
            error: "Sesión no encontrada para actualizar actividad.",
          },
          { status: 404 }
        )
      }

      return Response.json({
        ok: true,
        action: "touch",
        session,
      })
    }

    if (action === "pause") {
      const session = pauseSocialSession(sessionId)

      if (!session) {
        return Response.json(
          {
            ok: false,
            error: "Sesión no encontrada para pausar.",
          },
          { status: 404 }
        )
      }

      return Response.json({
        ok: true,
        action: "pause",
        session,
      })
    }

    if (action === "resume") {
      const session = resumeSocialSession(sessionId)

      if (!session) {
        return Response.json(
          {
            ok: false,
            error: "Sesión no encontrada para reanudar.",
          },
          { status: 404 }
        )
      }

      return Response.json({
        ok: true,
        action: "resume",
        session,
      })
    }

    if (action === "close") {
      const session = closeSocialSession(sessionId)

      if (!session) {
        return Response.json(
          {
            ok: false,
            error: "Sesión no encontrada para cerrar.",
          },
          { status: 404 }
        )
      }

      return Response.json({
        ok: true,
        action: "close",
        session,
      })
    }

    if (action === "append-message") {
      const content =
        typeof body.content === "string" ? body.content.trim() : ""

      if (!content) {
        return Response.json(
          {
            ok: false,
            error: "Debes enviar contenido para agregar un mensaje.",
          },
          { status: 400 }
        )
      }

      const authorId =
        typeof body.authorId === "string" ? body.authorId : "user"
      const authorName =
        typeof body.authorName === "string" ? body.authorName : "Usuario"
      const role =
        typeof body.role === "string"
          ? (body.role as
              | "supervisor"
              | "researcher"
              | "educator"
              | "mathematician"
              | "creative"
              | "assistant")
          : "assistant"

      const fromUser = body.fromUser === true

      const session = appendSocialMessage({
        sessionId,
        authorId,
        authorName,
        role,
        content,
        fromUser,
      })

      if (!session) {
        return Response.json(
          {
            ok: false,
            error: "Sesión no encontrada para agregar el mensaje.",
          },
          { status: 404 }
        )
      }

      return Response.json({
        ok: true,
        action: "append-message",
        session,
      })
    }

    return Response.json(
      {
        ok: false,
        error: `Acción no soportada: ${action}`,
      },
      { status: 400 }
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo procesar la sesión social."

    return Response.json(
      {
        ok: false,
        name: SUPERAGENT_CONFIG.identity.displayName,
        alias: SUPERAGENT_CONFIG.identity.engineAlias,
        error: message,
      },
      { status: 500 }
    )
  }
}
