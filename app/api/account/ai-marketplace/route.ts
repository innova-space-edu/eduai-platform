import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getPersonalCredentialSecret,
  listPersonalCredentials,
  type PersonalAIProvider,
} from "@/lib/ai/personal-credentials"
import {
  PERSONAL_AI_PROVIDERS,
  listFalVideoModels,
  listHuggingFaceVideoModels,
  listReplicateVideoModels,
} from "@/lib/ai/personal-provider-marketplace"

export const runtime = "nodejs"
export const maxDuration = 30

const PROVIDERS = new Set<PersonalAIProvider>(["fal", "huggingface", "replicate"])

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const url = new URL(req.url)
  const providerParam = url.searchParams.get("provider")?.toLowerCase() || null
  const duration = Math.max(2, Math.min(20, Number(url.searchParams.get("duration") || 5)))

  try {
    const credentials = await listPersonalCredentials(user.id)
    const connected = new Map(credentials.map(item => [item.provider, item]))

    if (!providerParam) {
      return NextResponse.json({
        ok: true,
        providers: PERSONAL_AI_PROVIDERS.map(item => ({
          ...item,
          connected: Boolean(connected.get(item.id)?.enabled),
          credential: connected.get(item.id) || null,
        })),
      })
    }

    const provider = providerParam as PersonalAIProvider
    if (!PROVIDERS.has(provider)) return NextResponse.json({ error: "Proveedor no compatible" }, { status: 400 })

    if (provider === "huggingface") {
      const models = await listHuggingFaceVideoModels(24)
      return NextResponse.json({ ok: true, provider, models })
    }

    const credential = await getPersonalCredentialSecret(user.id, provider)
    if (!credential) {
      return NextResponse.json({
        ok: false,
        provider,
        error: "Conecta tu API key para consultar el catálogo y precios de este proveedor.",
        requiresCredential: true,
      }, { status: 403 })
    }

    const models = provider === "fal"
      ? await listFalVideoModels(credential.secret, duration, 20)
      : await listReplicateVideoModels(credential.secret, 20)

    return NextResponse.json({ ok: true, provider, models })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible cargar el marketplace",
    }, { status: 500 })
  }
}
