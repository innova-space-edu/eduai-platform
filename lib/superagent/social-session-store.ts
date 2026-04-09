// lib/superagent/social-session-store.ts

import { startSocialConversation } from "./social-engine"
import type { SuperAgentUserContext } from "./types"
import type {
  SocialConversationResult,
  SocialMessage,
  SocialParticipant,
  SocialRoomSlug,
} from "./social-engine"

export type SocialSessionStatus = "active" | "paused" | "closed"

export interface SocialSession {
  sessionId: string
  userId?: string
  status: SocialSessionStatus
  room: {
    id: string
    slug: SocialRoomSlug
    title: string
    topic: string
    createdAt: string
  }
  participants: SocialParticipant[]
  messages: SocialMessage[]
  summary: string
  createdAt: string
  updatedAt: string
  lastUserActivityAt: string
  lastAgentActivityAt: string
  inactivityTimeoutMs: number
}

const DEFAULT_TIMEOUT_MS = 60_000

const socialSessions = new Map<string, SocialSession>()

function nowIso(): string {
  return new Date().toISOString()
}

function buildFallbackSummary(session: SocialSession): string {
  const lastMessages = session.messages.slice(-3).map((m) => m.content).join(" ")
  return (
    session.summary ||
    `La conversación en la sala "${session.room.title}" fue pausada. Últimas ideas: ${lastMessages || "sin mensajes recientes"}.`
  )
}

export function getAllSocialSessions(): SocialSession[] {
  return Array.from(socialSessions.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )
}

export function getSocialSession(sessionId: string): SocialSession | null {
  return socialSessions.get(sessionId) || null
}

export async function createSocialSession(
  context: SuperAgentUserContext,
  inactivityTimeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<SocialSession> {
  const conversation: SocialConversationResult =
    await startSocialConversation(context)

  const timestamp = nowIso()

  const session: SocialSession = {
    sessionId: crypto.randomUUID(),
    userId: context.userId,
    status: "active",
    room: conversation.room,
    participants: conversation.participants,
    messages: conversation.messages,
    summary: conversation.summary,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastUserActivityAt: timestamp,
    lastAgentActivityAt: timestamp,
    inactivityTimeoutMs,
  }

  socialSessions.set(session.sessionId, session)
  return session
}

export function touchUserActivity(sessionId: string): SocialSession | null {
  const session = socialSessions.get(sessionId)
  if (!session) return null

  const timestamp = nowIso()

  const updated: SocialSession = {
    ...session,
    status: "active",
    updatedAt: timestamp,
    lastUserActivityAt: timestamp,
  }

  socialSessions.set(sessionId, updated)
  return updated
}

export function touchAgentActivity(sessionId: string): SocialSession | null {
  const session = socialSessions.get(sessionId)
  if (!session) return null

  const timestamp = nowIso()

  const updated: SocialSession = {
    ...session,
    status: "active",
    updatedAt: timestamp,
    lastAgentActivityAt: timestamp,
  }

  socialSessions.set(sessionId, updated)
  return updated
}

export function appendSocialMessage(params: {
  sessionId: string
  authorId: string
  authorName: string
  role: SocialMessage["role"]
  content: string
  fromUser?: boolean
}): SocialSession | null {
  const session = socialSessions.get(params.sessionId)
  if (!session) return null

  const timestamp = nowIso()

  const newMessage: SocialMessage = {
    id: crypto.randomUUID(),
    authorId: params.authorId,
    authorName: params.authorName,
    role: params.role,
    content: params.content,
    createdAt: timestamp,
  }

  const updated: SocialSession = {
    ...session,
    status: "active",
    messages: [...session.messages, newMessage],
    updatedAt: timestamp,
    lastUserActivityAt: params.fromUser ? timestamp : session.lastUserActivityAt,
    lastAgentActivityAt: params.fromUser ? session.lastAgentActivityAt : timestamp,
  }

  socialSessions.set(params.sessionId, updated)
  return updated
}

export function pauseSocialSession(sessionId: string): SocialSession | null {
  const session = socialSessions.get(sessionId)
  if (!session) return null

  const timestamp = nowIso()

  const updated: SocialSession = {
    ...session,
    status: "paused",
    updatedAt: timestamp,
    summary: buildFallbackSummary(session),
  }

  socialSessions.set(sessionId, updated)
  return updated
}

export function closeSocialSession(sessionId: string): SocialSession | null {
  const session = socialSessions.get(sessionId)
  if (!session) return null

  const timestamp = nowIso()

  const updated: SocialSession = {
    ...session,
    status: "closed",
    updatedAt: timestamp,
    summary: buildFallbackSummary(session),
  }

  socialSessions.set(sessionId, updated)
  return updated
}

export function resumeSocialSession(sessionId: string): SocialSession | null {
  const session = socialSessions.get(sessionId)
  if (!session) return null

  const timestamp = nowIso()

  const updated: SocialSession = {
    ...session,
    status: "active",
    updatedAt: timestamp,
    lastUserActivityAt: timestamp,
  }

  socialSessions.set(sessionId, updated)
  return updated
}

export function checkAndPauseInactiveSessions(): SocialSession[] {
  const now = Date.now()
  const paused: SocialSession[] = []

  for (const session of socialSessions.values()) {
    if (session.status !== "active") continue

    const lastUserActivity = new Date(session.lastUserActivityAt).getTime()
    const inactiveFor = now - lastUserActivity

    if (inactiveFor >= session.inactivityTimeoutMs) {
      const updated = pauseSocialSession(session.sessionId)
      if (updated) paused.push(updated)
    }
  }

  return paused
}
