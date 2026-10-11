/**
 * proxy.ts — EduAI Platform v5.6
 * ─────────────────────────────────────────────────────────────────────────────
 * v5.2: Protege las APIs de Creator Hub y limita el análisis de videos.
 * v5.3: Protege también /api/process-content, usado por todos los creadores.
 * v5.4: Reabre proyectos guardados en el editor universal por capas.
 * v5.5: Reserva capacidad para generar el elenco y las viñetas de una historieta.
 * v5.6: Aísla y protege las APIs de la pizarra matemática.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { requiredPrivacyPermissionsForRoute } from "@/lib/privacy/consent-guard"
import { createFamilyAdminClient } from "@/lib/family-consent/server"

const PROTECTED_ROUTES = [
  "/dashboard", "/study", "/profile", "/admin",
  "/creator-hub", "/audio-lab", "/image-studio", "/workspace",
  "/educador", "/superagent", "/chat-global", "/music", "/exam-focus",
  "/pizarra-interactiva",
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
  "/api/creator/comics/image":  { limit: 24, windowSecs: 60 },
  "/api/process-content":       { limit: 8, windowSecs: 60 },
  "/api/exam-security/event":   { limit: 60, windowSecs: 60 },
  "/api/whiteboard/recognize":  { limit: 24, windowSecs: 60 },
  "/api/whiteboard/solve":      { limit: 14, windowSecs: 60 },
  "/api/whiteboard/notebooks":  { limit: 36, windowSecs: 60 },
  "__default_agents__":         { limit: 20, windowSecs: 60 },
  "__default_creator__":        { limit: 10, windowSecs: 60 },
  "__default_whiteboard__":     { limit: 30, windowSecs: 60 },
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

  // Family signature != verified parental authority; the institution must approve.
  // The flag stays OFF until all existing minor accounts have been offered a
  // suitable lawful onboarding or alternative route.
  if (process.env.EDUAI_FAMILY_CONSENT_ENFORCE === "true" && user) {
    const dob = String(user.user_metadata?.birth_date || "")
    const born = new Date(dob + "T00:00:00")
    const today = new Date()
    const minor = !dob || Number.isNaN(born.getTime()) ||
      born > new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    const isFamilyPage = pathname.startsWith("/autorizacion-familiar") ||
      pathname === "/autorizacion-pendiente" || pathname.startsWith("/api/family-consent")
    if (minor && !isFamilyPage) {
      try {
        const db = createFamilyAdminClient()
        const { data, error } = await db.from("family_authorization_requests")
          .select("id,status,decisions,document_version").eq("platform","eduai").eq("student_user_id",user.id)
          .in("status", ["approved","revoked"]).order("updated_at", { ascending: false })
          .limit(1).maybeSingle()
        if (error || !data || data.status !== "approved" || data.document_version !== "family-2026-10-v1" || data.decisions?.platform_access !== true) {
          if (pathname.startsWith("/api/")) return NextResponse.json(
            { error: "Autorización familiar pendiente de verificación" }, { status: 403 })
          const isAuthOrLegal = pathname === "/login" || pathname === "/register" ||
            pathname === "/privacidad" || pathname === "/terminos" ||
            pathname === "/seguridad" || pathname === "/gobernanza-ia"
          if (!isAuthOrLegal) return NextResponse.redirect(new URL("/autorizacion-pendiente", request.url))
        }
      } catch {
        if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No fue posible validar la autorización familiar" }, { status: 503 })
        if (pathname !== "/autorizacion-pendiente") return NextResponse.redirect(new URL("/autorizacion-pendiente", request.url))
      }
    }
  }

  const isAgentAPI = pathname.startsWith("/api/agents/")
  const isSuperagentAPI = pathname.startsWith("/api/superagent/")
  const isCreatorAPI = pathname.startsWith("/api/creator/") || pathname === "/api/process-content"
  const isWhiteboardAPI = pathname.startsWith("/api/whiteboard/")

  // Rollout flag: turn on only after deploying the RLS/RPC migration and reviewing all
  // affected routes. Until then, the consent UI must remain in draft, not production.
  if (process.env.EDUAI_PRIVACY_ENFORCE_CHOICES === "true") {
    const required = requiredPrivacyPermissionsForRoute(pathname, request.method)
    if (required.length > 0) {
      if (!user) return NextResponse.json({ error: "Debes iniciar sesión antes de usar herramientas de IA." }, { status: 401 })

      const { data: privacy, error: privacyError } = await supabase
        .from("eduai_privacy_choices")
        .select("ai_generation, ai_documents, ai_voice")
        .eq("user_id", user.id)
        .maybeSingle()

      if (privacyError || !privacy || required.some(key => privacy[key] !== true)) {
        return NextResponse.json({
          error: "La función requiere una autorización opcional vigente.",
          action: "Revisa y actualiza tus preferencias en Configuración del perfil.",
          missing_permission: required.filter(key => privacy?.[key] !== true),
        }, { status: 403, headers: { "Cache-Control": "no-store" } })
      }
    }
  }

  if ((isCreatorAPI || isWhiteboardAPI) && !user) {
    return new NextResponse(
      JSON.stringify({
        error: "Unauthorized",
        message: isWhiteboardAPI
          ? "Debes iniciar sesión para utilizar la pizarra matemática."
          : "Debes iniciar sesión para utilizar las herramientas de Creator Hub.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
      },
    )
  }

  if (isAgentAPI || isSuperagentAPI || isCreatorAPI || isWhiteboardAPI) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const identifier = user ? `user:${user.id}:${pathname}` : `ip:${ip}:${pathname}`
    const rateConfig = RATE_LIMITS[pathname] || (
      isCreatorAPI
        ? RATE_LIMITS["__default_creator__"]
        : isWhiteboardAPI
          ? RATE_LIMITS["__default_whiteboard__"]
          : RATE_LIMITS["__default_agents__"]
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
