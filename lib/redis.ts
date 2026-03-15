/**
 * lib/redis.ts — EduAI Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * Cliente Redis (Upstash) con degradación elegante.
 *
 * Si UPSTASH_REDIS_REST_URL no está configurado, todas las operaciones
 * de cache retornan null silenciosamente — la plataforma funciona igual,
 * solo sin cache.
 *
 * Setup en Vercel:
 *   1. Ir a Vercel Dashboard → Storage → Create → Upstash KV
 *   2. Connect al proyecto → las env vars se añaden automáticamente
 *   3. O añadir manualmente:
 *      UPSTASH_REDIS_REST_URL=https://...upstash.io
 *      UPSTASH_REDIS_REST_TOKEN=...
 *
 * Uso:
 *   import { getRedis, rateLimit } from "@/lib/redis"
 *
 *   // Cache
 *   const redis = getRedis()
 *   if (redis) await redis.set("key", value, { ex: 300 })
 *
 *   // Rate limit
 *   const { allowed, remaining } = await rateLimit("user_id:route", 20, 60)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Tipos mínimos para compatibilidad sin instalar @upstash/redis ─────────────
interface RedisClient {
  get<T = unknown>(key: string): Promise<T | null>
  set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<"OK" | null>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  del(key: string): Promise<number>
  ttl(key: string): Promise<number>
}

// ── Singleton ─────────────────────────────────────────────────────────────────
let _redis: RedisClient | null = null
let _initialized = false

export function getRedis(): RedisClient | null {
  if (_initialized) return _redis

  _initialized = true

  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    // No configurado — modo sin cache (funciona igual, solo sin rate limiting ni cache)
    console.warn("[Redis] UPSTASH_REDIS_REST_URL not set. Cache and rate limiting disabled.")
    _redis = null
    return null
  }

  // Cliente HTTP minimalista para Upstash REST API
  // Evita instalar @upstash/redis si el usuario prefiere no hacerlo
  _redis = createUpstashClient(url, token)
  return _redis
}

// ── Cliente Upstash REST (sin dependencia extra) ───────────────────────────────
function createUpstashClient(url: string, token: string): RedisClient {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  async function execute<T = unknown>(...args: unknown[]): Promise<T> {
    const res = await fetch(`${url}`, {
      method: "POST",
      headers,
      body: JSON.stringify(args),
    })
    if (!res.ok) throw new Error(`Upstash error: ${res.status} ${res.statusText}`)
    const data = await res.json()
    return data.result as T
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      const result = await execute<string | null>("GET", key)
      if (result === null) return null
      try {
        return JSON.parse(result) as T
      } catch {
        return result as unknown as T
      }
    },

    async set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<"OK" | null> {
      const serialized = typeof value === "string" ? value : JSON.stringify(value)
      const args: unknown[] = ["SET", key, serialized]
      if (opts?.ex) { args.push("EX", opts.ex) }
      if (opts?.nx) { args.push("NX") }
      return execute<"OK" | null>(...args)
    },

    async incr(key: string): Promise<number> {
      return execute<number>("INCR", key)
    },

    async expire(key: string, seconds: number): Promise<number> {
      return execute<number>("EXPIRE", key, seconds)
    },

    async del(key: string): Promise<number> {
      return execute<number>("DEL", key)
    },

    async ttl(key: string): Promise<number> {
      return execute<number>("TTL", key)
    },
  }
}

// ── Rate Limiter ──────────────────────────────────────────────────────────────
/**
 * Rate limiting con sliding window simple usando Redis INCR + EXPIRE.
 *
 * @param identifier  - Clave única para esta ventana (ej: `${userId}:chat`)
 * @param limit       - Máximo de requests permitidos en la ventana
 * @param windowSecs  - Duración de la ventana en segundos
 *
 * @returns { allowed: boolean, remaining: number, resetIn: number }
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSecs: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const redis = getRedis()

  // Sin Redis configurado → siempre permitir
  if (!redis) {
    return { allowed: true, remaining: limit, resetIn: windowSecs }
  }

  const key = `rl:${identifier}`

  try {
    const current = await redis.incr(key)

    // Primera vez que se usa esta clave → establecer TTL
    if (current === 1) {
      await redis.expire(key, windowSecs)
    }

    const remaining = Math.max(0, limit - current)
    const ttl = await redis.ttl(key)

    return {
      allowed: current <= limit,
      remaining,
      resetIn: ttl > 0 ? ttl : windowSecs,
    }
  } catch (e: any) {
    console.warn("[Rate Limit] Redis error, allowing request:", e.message)
    return { allowed: true, remaining: limit, resetIn: windowSecs }
  }
}

// ── Helpers de cache específicos ──────────────────────────────────────────────

/** Cache para resultados del AGT-Investigador por tema */
export async function getCachedInvestigation(topic: string): Promise<string | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    return await redis.get<string>(`inv:${topic.slice(0, 80)}`)
  } catch { return null }
}

export async function setCachedInvestigation(topic: string, result: string, ttl = 600): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(`inv:${topic.slice(0, 80)}`, result, { ex: ttl })
  } catch { /* ignorar */ }
}

/** Cache para extracción de papers (complementa el cache de Supabase) */
export async function getCachedPaperSummary(fileHash: string): Promise<string | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    return await redis.get<string>(`paper:${fileHash}`)
  } catch { return null }
}

export async function setCachedPaperSummary(fileHash: string, summary: string, ttl = 3600): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(`paper:${fileHash}`, summary, { ex: ttl })
  } catch { /* ignorar */ }
}
