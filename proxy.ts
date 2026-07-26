/**
 * proxy.ts — EduAI Platform v5.4
 * ─────────────────────────────────────────────────────────────────────────────
 * v5.2: Protege las APIs de Creator Hub y limita el análisis de videos.
 * v5.3: Protege también /api/process-content, usado por todos los creadores.
 * v5.4: Reabre proyectos guardados en el editor universal por capas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PROTECTED_ROUTES = [
  "/dashboard", "/study", "/profile", "/admin",
  "/creator-hub", "/audio-lab", "/image-studio", "/workspace",
  "/educador", "/superagent", "/chat-global", "/music", "/exam-focus",
]

const AUTH_ROUTES = ["/login", "/register"]
const SPECIALIZED_PROJECT_EDITORS = new Set(["infographic", "ppt", "comic", "comics"])

const RATE_LIMITS: Record<string, { limit: number; windowSecs: number }> = {
  "/api/agents/chat":          { limit: 30, windowSecs: 60 },
  "/api/agents/socratic":      { limit: 30, windowSecs: 60 },
  "/api/agents/theory":        { limit: 20, windowSecs: 60 },
  "/api/agents/summary":       { limit: 20, windowSecs: 60 },
  "/api/agents/evaluate":      { limit: 20, windowSecs: 60 },
  "/api/agents/feedback":      { limit: 20, windowSecs: 60 },
  "/api/agents/paper":         { limit: 10, windowSecs: 60 },
  "/api/agents/paper/extract": { limit: 5, windowSecs: 60 },
  "/api/agents/imagenes":      { limit: 10, windowSecs: 60 },
  "/api/agents/gemini-image":  { limit: 10, windowSecs: 60 },
  "/api/agents/podcast-wav":   { limit: 5, windowSecs: 60 },
  "/api/agents/transcription": { limit: 5, windowSecs: 60 },
  "/api/agents/tts":           { limit: 40, windowSecs: 60 },
  "/api/agents/tts-chunk":     { limit: 40, windowSecs: 60 },
  "/api/superagent/chat":      { limit: 25, windowSecs: 60 },
  "/api/creator/video-summary": { limit: 6, windowSecs: 60 },
  "/api/process-content":       { limit: 8, windowSecs: 60 },
  "/api/exam-security/event":  { limit: 60, windowSecs: 60 },
  "__default_agents__":        { limit: 20, windowSecs: 60 },
  "__default_creator__":       { limit: 10, windowSecs: 60 },
}

async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSecs: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { allowed: true, remaining: limit }
  try {
    const key = `rl:${identifier}`
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["INCR", key]),
    })
    if (!res.ok) return { allowed: true, remaining: limit }
    const { result: current } = await res.json()
    if (current === 1) {
      fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["EXPIRE", key, windowSecs]),
      }).catch(() => {})
    }
    return { allowed: current <= limit, remaining: Math.max(0, limit - current) }
  } catch {
    return { allowed: true, remaining: limit }
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => { request.cookies.set(name, value) })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAgentAPI = pathname.startsWith("/api/agents/")
  const isSuperagentAPI = pathname.startsWith("/api/superagent/")
  const isCreatorAPI = pathname.startsWith("/api/creator/") || pathname === "/api/process-content"

  if (isCreatorAPI && !user) {
    return new NextResponse(
      JSON.stringify({
        error: "Unauthorized",
        message: "Debes iniciar sesión para utilizar las herramientas de Creator Hub.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
      },
    )
  }

  if (isAgentAPI || isSuperagentAPI || isCreatorAPI) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const identifier = user ? `user:${user.id}:${pathname}` : `ip:${ip}:${pathname}`
    const rateConfig = RATE_LIMITS[pathname] || (
      isCreatorAPI ? RATE_LIMITS["__default_creator__"] : RATE_LIMITS["__default_agents__"]
    )
    const effectiveLimit = user ? rateConfig.limit : Math.floor(rateConfig.limit / 2)
    const { allowed, remaining } = await checkRateLimit(identifier, effectiveLimit, rateConfig.windowSecs)

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: "Demasiadas solicitudes. Espera un momento.",
          retryAfter: rateConfig.windowSecs,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, max-age=0",
            "Retry-After": String(rateConfig.windowSecs),
            "X-RateLimit-Remaining": "0",
          },
        },
      )
    }

    response.headers.set("X-RateLimit-Remaining", String(remaining))
    return response
  }

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  const isAuth = AUTH_ROUTES.some((route) => pathname === route)

  if (!user && isProtected) return NextResponse.redirect(new URL("/login", request.url))
  if (user && isAuth) return NextResponse.redirect(new URL("/dashboard", request.url))

  // Los enlaces antiguos de “Continuar editando” se conservan, pero ahora los
  // formatos sin hidratación especializada abren el editor universal por capas.
  const requestedProject = searchParams.get("project")
  const formatMatch = pathname.match(/^\/creator-hub\/([^/]+)$/)
  if (user && requestedProject && formatMatch && /^[a-zA-Z0-9-]{8,80}$/.test(requestedProject)) {
    const requestedFormat = formatMatch[1]
    if (!SPECIALIZED_PROJECT_EDITORS.has(requestedFormat) && requestedFormat !== "projects") {
      return NextResponse.redirect(new URL(`/creator-hub/projects/${encodeURIComponent(requestedProject)}`, request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
