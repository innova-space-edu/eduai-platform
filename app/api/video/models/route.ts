import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"
import { ensureWallet, getBillingSettings } from "@/lib/credits/server"
import { VIDEO_STUDIO_MODELS } from "@/lib/video/premium-models"

export const runtime = "nodejs"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 })

    try {
      await assertAICapabilityAllowed({ supabase, userId: user.id, capability: "video" })
    } catch (accessError) {
      const typed = accessError as Error & { status?: number; code?: string }
      return NextResponse.json({ ok: false, error: typed.message, code: typed.code || "ACCESS_RESTRICTED" }, { status: typed.status || 403 })
    }

    const [wallet, settings] = await Promise.all([ensureWallet(user.id), getBillingSettings()])
    const falReady = Boolean(process.env.FAL_KEY?.trim())
    const googleReady = Boolean(
      process.env.GEMINI_API_KEY_VIDEO?.trim()
      || process.env.GEMINI_API_KEY?.trim()
      || process.env.GOOGLE_API_KEY?.trim()
    )
    const mercadoPagoReady = Boolean(
      process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim()
      && process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
      && process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()
    )

    return NextResponse.json({
      ok: true,
      wallet,
      payments: {
        enabled: settings.paymentsEnabled,
        configured: mercadoPagoReady,
      },
      models: VIDEO_STUDIO_MODELS.map(({ endpointText: _text, endpointImage: _image, ...model }) => {
        const available = model.provider === "auto"
          ? true
          : model.provider === "google"
            ? googleReady
            : settings.premiumVideoEnabled && falReady

        const unavailableReason = model.provider === "google" && !googleReady
          ? "Veo directo requiere GEMINI_API_KEY_VIDEO, GEMINI_API_KEY o GOOGLE_API_KEY en el servidor."
          : model.provider === "fal" && !falReady
            ? "Proveedor premium fal.ai pendiente de conexión en el servidor."
            : model.provider === "fal" && !settings.premiumVideoEnabled
              ? "Generación premium temporalmente deshabilitada."
              : null

        return { ...model, available, unavailableReason }
      }),
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo cargar Video Studio." }, { status: 500 })
  }
}
