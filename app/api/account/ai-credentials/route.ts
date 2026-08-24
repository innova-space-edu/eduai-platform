import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  credentialEncryptionSource,
  deletePersonalCredential,
  listPersonalCredentials,
  savePersonalCredential,
  updatePersonalCredentialSettings,
  type PersonalAIProvider,
} from "@/lib/ai/personal-credentials"

export const runtime = "nodejs"

const PROVIDERS = new Set<PersonalAIProvider>(["fal", "huggingface", "replicate"])

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user || null
}

function provider(value: unknown): PersonalAIProvider | null {
  const normalized = String(value || "").trim().toLowerCase() as PersonalAIProvider
  return PROVIDERS.has(normalized) ? normalized : null
}

function optionalMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 10000) throw new Error("Límite de gasto inválido")
  return Math.round(number * 10000) / 10000
}

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  try {
    const credentials = await listPersonalCredentials(user.id)
    return NextResponse.json({
      ok: true,
      credentials,
      encryption: {
        configured: credentialEncryptionSource() !== "missing",
        dedicatedKey: credentialEncryptionSource() === "dedicated",
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible leer las conexiones" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const selectedProvider = provider(body.provider)
  if (!selectedProvider) return NextResponse.json({ error: "Proveedor no compatible" }, { status: 400 })
  const secret = String(body.secret || "").trim()
  if (!secret) return NextResponse.json({ error: "Debes ingresar una API key" }, { status: 400 })

  try {
    const credential = await savePersonalCredential({
      userId: user.id,
      provider: selectedProvider,
      secret,
      label: typeof body.label === "string" ? body.label : null,
      enabled: body.enabled !== false,
      maxRequestUsd: optionalMoney(body.maxRequestUsd),
      dailyBudgetUsd: optionalMoney(body.dailyBudgetUsd),
    })
    return NextResponse.json({ ok: true, credential })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible guardar la API key" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const selectedProvider = provider(body.provider)
  if (!selectedProvider) return NextResponse.json({ error: "Proveedor no compatible" }, { status: 400 })

  try {
    const credential = await updatePersonalCredentialSettings({
      userId: user.id,
      provider: selectedProvider,
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "maxRequestUsd") ? { maxRequestUsd: optionalMoney(body.maxRequestUsd) } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "dailyBudgetUsd") ? { dailyBudgetUsd: optionalMoney(body.dailyBudgetUsd) } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "label") ? { label: typeof body.label === "string" ? body.label : null } : {}),
    })
    if (!credential) return NextResponse.json({ error: "Conexión no encontrada" }, { status: 404 })
    return NextResponse.json({ ok: true, credential })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible actualizar la conexión" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  const url = new URL(req.url)
  const selectedProvider = provider(url.searchParams.get("provider"))
  if (!selectedProvider) return NextResponse.json({ error: "Proveedor no compatible" }, { status: 400 })
  try {
    await deletePersonalCredential(user.id, selectedProvider)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible eliminar la conexión" }, { status: 500 })
  }
}
