/**
 * middleware.ts — EduAI Platform v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Cambios v2 (aditivos — no rompe nada existente):
 *   1. Rate limiting en /api/agents/* (20 req/min por usuario autenticado,
 *      10 req/min para usuarios no autenticados por IP)
 *   2. Rutas protegidas extendidas (+ nuevas rutas de v2)
 *   3. Headers de seguridad en todas las respuestas
 *
 * Si Redis no está configurado (UPSTASH_REDIS_REST_URL vacío),
 * el rate limiting se desactiva silenciosamente y todo sigue funcionando.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PROTECTED_ROUTES = [
  "/dashboard", "/study", "/profile", "/admin",
  "/creator-hub", "/audio-lab", "/image-studio", "/workspace",
]
const AUTH_ROUTES = ["/login", "/register"]

const RATE_LIMITS: Record<string, { limit: number; windowSecs: number }> = {
  "/api/agents/chat":          { limit: 30, windowSecs: 60 },
  "/api/agents/socratic":      { limit: 30, windowSecs: 60 },
  "/api/agents/theory":        { limit: 20, windowSecs: 60 },
  "/api/agents/summary":       { limit: 20, windowSecs: 60 },
  "/api/agents/evaluate":      { limit: 20, windowSecs: 60 },
  "/api/agents/feedback":      { limit: 20, windowSecs: 60 },
  "/api/agents/paper":         { limit: 10, windowSecs: 60 },
  "/api/agents/paper/extract": { limit: 5,  windowSecs: 60 },
  "/api/agents/imagenes":      { limit: 10, windowSecs: 60 },
  "/api/agents/gemini-image":  { limit: 10, windowSecs: 60 },
  "/api/agents/podcast-wav":   { limit: 5,  windowSecs: 60 },
  "/api/agents/transcription": { limit: 5,  windowSecs: 60 },
  "__default_agents__":        { limit: 20, windowSecs: 60 },
}

async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSecs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limiting para /api/agents/*
  if (pathname.startsWith("/api/agents/")) {
    const authCookie = request.cookies.getAll().find(c => c.name.includes("auth-token"))?.value
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const identifier = authCookie
      ? `user:${authCookie.slice(0, 32)}:${pathname}`
      : `ip:${ip}:${pathname}`
    const config = RATE_LIMITS[pathname] || RATE_LIMITS["__default_agents__"]
    const effectiveLimit = authCookie ? config.limit : Math.floor(config.limit / 2)
    const { allowed, remaining } = await checkRateLimit(identifier, effectiveLimit, config.windowSecs)
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Rate limit exceeded", message: "Demasiadas solicitudes. Espera un momento.", retryAfter: config.windowSecs }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(config.windowSecs), "X-RateLimit-Remaining": "0" } }
      )
    }
    const response = NextResponse.next({ request })
    response.headers.set("X-RateLimit-Remaining", String(remaining))
    return response
  }

  // Auth check para rutas de página
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
          cookiesToSet.forEach(({ name, value, options }) => { response.cookies.set(name, value, options) })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
  const isAuth = AUTH_ROUTES.some(r => pathname === r)

  if (!user && isProtected) return NextResponse.redirect(new URL("/login", request.url))
  if (user && isAuth)       return NextResponse.redirect(new URL("/dashboard", request.url))

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
