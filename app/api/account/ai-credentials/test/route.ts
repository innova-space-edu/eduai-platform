import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getPersonalCredentialSecret,
  markCredentialTest,
  type PersonalAIProvider,
} from "@/lib/ai/personal-credentials"
import { testPersonalProvider } from "@/lib/ai/personal-provider-marketplace"

export const runtime = "nodejs"

const PROVIDERS = new Set<PersonalAIProvider>(["fal", "huggingface", "replicate"])

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const provider = String(body.provider || "").toLowerCase() as PersonalAIProvider
  if (!PROVIDERS.has(provider)) return NextResponse.json({ error: "Proveedor no compatible" }, { status: 400 })

  try {
    const credential = await getPersonalCredentialSecret(user.id, provider)
    if (!credential) return NextResponse.json({ error: "Primero conecta una API key para este proveedor" }, { status: 404 })
    const result = await testPersonalProvider(provider, credential.secret)
    await markCredentialTest({
      userId: user.id,
      provider,
      status: result.status,
      message: result.message,
    })
    return NextResponse.json({ provider, ...result }, { status: result.ok ? 200 : 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible probar la conexión"
    try {
      await markCredentialTest({ userId: user.id, provider, status: "error", message })
    } catch {}
    return NextResponse.json({ ok: false, provider, error: message }, { status: 500 })
  }
}
