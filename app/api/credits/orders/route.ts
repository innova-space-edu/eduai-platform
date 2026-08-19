import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"
import { getAdminSupabase, getBillingSettings, mercadoPagoRequest } from "@/lib/credits/server"

export const runtime = "nodejs"

const ALLOWED_AMOUNTS = new Set([5000, 10000, 20000, 50000])

type PreferenceResponse = { id?: string }

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

    const settings = await getBillingSettings()
    if (!settings.paymentsEnabled) {
      return NextResponse.json({ ok: false, error: "La compra de créditos está temporalmente deshabilitada." }, { status: 503 })
    }
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || !process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim()) {
      return NextResponse.json({ ok: false, error: "Mercado Pago aún no está configurado en este entorno." }, { status: 503 })
    }

    const body = await req.json().catch(() => ({})) as { amountClp?: number }
    const amountClp = Number(body.amountClp)
    if (!Number.isInteger(amountClp) || !ALLOWED_AMOUNTS.has(amountClp)) {
      return NextResponse.json({ ok: false, error: "Monto de recarga no válido." }, { status: 400 })
    }

    const credits = Math.round(amountClp * settings.creditsPerClp)
    const admin = getAdminSupabase()
    const { data: order, error: orderError } = await admin
      .from("ai_payment_orders")
      .insert({
        user_id: user.id,
        amount_clp: amountClp,
        credits,
        status: "pending",
        payer_email: user.email || null,
        metadata: { source: "video-studio", credits_per_clp: settings.creditsPerClp },
      })
      .select("id,idempotency_key,amount_clp,credits")
      .single()

    if (orderError || !order) throw new Error(orderError?.message || "No se pudo crear la orden de créditos.")

    const origin = req.nextUrl.origin
    let preferenceId: string | null = null
    try {
      const preference = await mercadoPagoRequest<PreferenceResponse>("/checkout/preferences", {
        method: "POST",
        idempotencyKey: String(order.idempotency_key),
        body: {
          items: [{
            id: `eduai-credits-${credits}`,
            title: `${credits.toLocaleString("es-CL")} Créditos IA EduAI`,
            description: "Créditos de consumo para herramientas de IA dentro de EduAI",
            currency_id: "CLP",
            quantity: 1,
            unit_price: amountClp,
          }],
          payer: user.email ? { email: user.email } : undefined,
          external_reference: `eduai-credit-order:${order.id}`,
          metadata: { eduai_order_id: order.id, eduai_user_id: user.id, credits },
          payment_methods: { installments: 1 },
          back_urls: {
            success: `${origin}/video-studio?payment=success`,
            pending: `${origin}/video-studio?payment=pending`,
            failure: `${origin}/video-studio?payment=failure`,
          },
          auto_return: "approved",
          notification_url: `${origin}/api/webhooks/mercadopago`,
        },
      })
      preferenceId = preference.id || null
      if (preferenceId) {
        await admin.from("ai_payment_orders").update({ mp_preference_id: preferenceId, updated_at: new Date().toISOString() }).eq("id", order.id)
      }
    } catch (preferenceError) {
      console.warn("[MercadoPago][preference]", preferenceError instanceof Error ? preferenceError.message : String(preferenceError))
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amountClp,
      credits,
      preferenceId,
      publicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo crear la recarga." }, { status: 500 })
  }
}
