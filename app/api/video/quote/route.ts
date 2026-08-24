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
    const withAudio = Boolean(body.withAudio)

    const validation = validateVideoModelSelection({ model, mode, duration, resolution })
    if (validation) return NextResponse.json({ ok: false, error: validation }, { status: 400 })

    const wallet = await ensureWallet(user.id)
    if (model.provider === "auto") {
      return NextResponse.json({
        ok: true,
        modelKey: model.key,
        billing: "free",
        estimatedUsd: 0,
        estimatedCredits: 0,
        availableCredits: wallet.availableCredits,
        enoughCredits: true,
      })
    }

    const settings = await getBillingSettings()
    if (!settings.premiumVideoEnabled || !process.env.FAL_KEY?.trim()) {
      return NextResponse.json({ ok: false, error: "El proveedor premium todavía no está disponible." }, { status: 503 })
    }

    const estimatedUsd = estimateProviderUsd({ modelKey: model.key, duration, resolution, withAudio })
    const estimatedCredits = Math.max(
      settings.minGenerationCredits,
      Math.ceil(estimatedUsd * settings.usdToClp * settings.markupMultiplier * settings.creditsPerClp)
    )

    return NextResponse.json({
      ok: true,
      modelKey: model.key,
      billing: "credits",
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
