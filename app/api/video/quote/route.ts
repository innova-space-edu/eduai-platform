import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"
import { ensureWallet, getBillingSettings } from "@/lib/credits/server"
import {
  estimateProviderUsd,
  getVideoStudioModel,
  validateVideoModelSelection,
  type StudioResolution,
  type StudioVideoMode,
} from "@/lib/video/premium-models"

export const runtime = "nodejs"

type QuoteBody = {
  modelKey?: string
  mode?: StudioVideoMode
  duration?: number
  resolution?: StudioResolution
  withAudio?: boolean
}

export async function POST(req: NextRequest) {
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

    const body = (await req.json()) as QuoteBody
    const model = getVideoStudioModel(body.modelKey)
    const mode: StudioVideoMode = body.mode === "image_to_video" ? "image_to_video" : "text_to_video"
    const duration = Number(body.duration ?? model.durations[0] ?? 6)
    const resolution = (body.resolution || model.resolutions[0] || "720p") as StudioResolution
    const withAudio = model.provider === "google" ? true : Boolean(body.withAudio)

    const validation = validateVideoModelSelection({ model, mode, duration, resolution })
    if (validation) return NextResponse.json({ ok: false, error: validation }, { status: 400 })

    const wallet = await ensureWallet(user.id)
    if (model.provider === "auto") {
      return NextResponse.json({
        ok: true,
        modelKey: model.key,
        billing: "free",
        billingLabel: "Gratis / sin Créditos IA",
        estimatedUsd: 0,
        estimatedCredits: 0,
        availableCredits: wallet.availableCredits,
        enoughCredits: true,
      })
    }

    if (model.provider === "google") {
      const googleReady = Boolean(
        process.env.GEMINI_API_KEY_VIDEO?.trim()
        || process.env.GEMINI_API_KEY?.trim()
        || process.env.GOOGLE_API_KEY?.trim()
      )
      if (!googleReady) {
        return NextResponse.json({ ok: false, error: "Veo 3.1 directo no está configurado en el servidor." }, { status: 503 })
      }
    } else if (!process.env.FAL_KEY?.trim()) {
      return NextResponse.json({ ok: false, error: "fal.ai todavía no está configurado." }, { status: 503 })
    }

    const settings = await getBillingSettings()
    if (!settings.premiumVideoEnabled) {
      return NextResponse.json({ ok: false, error: "La generación de video de pago está temporalmente deshabilitada." }, { status: 503 })
    }

    const estimatedUsd = estimateProviderUsd({ modelKey: model.key, duration, resolution, withAudio })
    const estimatedCredits = Math.max(
      settings.minGenerationCredits,
      Math.ceil(estimatedUsd * settings.usdToClp * settings.markupMultiplier * settings.creditsPerClp)
    )

    return NextResponse.json({
      ok: true,
      modelKey: model.key,
      provider: model.provider,
      billing: "credits",
      billingLabel: model.provider === "google" ? "Créditos IA · Google directo" : "Créditos IA · fal.ai",
      estimatedUsd: Number(estimatedUsd.toFixed(6)),
      estimatedCredits,
      availableCredits: wallet.availableCredits,
      enoughCredits: wallet.availableCredits >= estimatedCredits,
      estimateOnly: true,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo calcular el costo." }, { status: 500 })
  }
}
