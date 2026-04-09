// app/api/superagent/social/route.ts

import { NextRequest } from "next/server"
import { SUPERAGENT_CONFIG } from "@/lib/superagent/config"
import { startSocialConversation } from "@/lib/superagent/social-engine"
import type {
  SuperAgentTarget,
  SuperAgentUserContext,
} from "@/lib/superagent/types"

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

function buildContextFromBody(
  body: Record<string, unknown>
): SuperAgentUserContext {
  return {
    userId: typeof body.userId === "string" ? body.userId : undefined,
    currentPage:
      typeof body.currentPage === "string" ? body.currentPage : undefined,
    activeAgent: normalizeActiveAgent(body.activeAgent),
    userGoal: typeof body.userGoal === "string" ? body.userGoal : undefined,
    recentMessages: Array.isArray(body.recentMessages)
      ? body.recentMessages.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    tags: Array.isArray(body.tags)
      ? body.tags.filter((item): item is string => typeof item === "string")
      : [],
    metadata:
      body.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : {},
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    name: SUPERAGENT_CONFIG.identity.displayName,
    alias: SUPERAGENT_CONFIG.identity.engineAlias,
    endpoint: "/api/superagent/social",
    message: "Endpoint social del superagente disponible.",
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const context = buildContextFromBody(body)

    const result = await startSocialConversation(context)

    return Response.json(
      {
        name: SUPERAGENT_CONFIG.identity.displayName,
        alias: SUPERAGENT_CONFIG.identity.engineAlias,
        ...result,
      },
      {
        status: result.ok ? 200 : 400,
      }
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo iniciar la conversación social."

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
