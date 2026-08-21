import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureWallet, getAdminSupabase, mercadoPagoRequest } from "@/lib/credits/server"

export const runtime = "nodejs"

type PaymentResult = {
  id?: number | string
  status?: string
  status_detail?: string
  payment_method_id?: string
  payer?: { email?: string }
}

function cleanString(value: unknown, max = 250) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 })

    const body = await req.json() as { orderId?: string; formData?: Record<string, unknown> }
    const orderId = cleanString(body.orderId, 80)
    const form = body.formData || {}
    if (!orderId) return NextResponse.json({ ok: false, error: "Orden inválida." }, { status: 400 })

    const admin = getAdminSupabase()
    const { data: order, error: orderError } = await admin
      .from("ai_payment_orders")
      .select("id,user_id,amount_clp,credits,status,idempotency_key,mp_payment_id")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (orderError) throw new Error(orderError.message)
    if (!order) return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 })
    if (order.status === "approved") {
      return NextResponse.json({ ok: true, status: "approved", paymentId: order.mp_payment_id, wallet: await ensureWallet(user.id), alreadyProcessed: true })
    }
    if (["refunded", "charged_back", "cancelled"].includes(order.status)) {
      return NextResponse.json({ ok: false, error: "La orden ya no puede procesarse." }, { status: 409 })
    }

    const token = cleanString(form.token, 500)
    const paymentMethodId = cleanString(form.payment_method_id, 80)
    if (!token || !paymentMethodId) {
      return NextResponse.json({ ok: false, error: "Faltan los datos tokenizados del medio de pago." }, { status: 400 })
    }

    const payerInput = (form.payer && typeof form.payer === "object" ? form.payer : {}) as Record<string, unknown>
    const identificationInput = (payerInput.identification && typeof payerInput.identification === "object" ? payerInput.identification : {}) as Record<string, unknown>
    const payerEmail = cleanString(payerInput.email, 320) || user.email
    if (!payerEmail) return NextResponse.json({ ok: false, error: "Mercado Pago requiere el correo del pagador." }, { status: 400 })

    const paymentBody: Record<string, unknown> = {
      transaction_amount: Number(order.amount_clp),
      token,
      description: `${Number(order.credits).toLocaleString("es-CL")} Créditos IA EduAI`,
      installments: 1,
      payment_method_id: paymentMethodId,
      external_reference: `eduai-credit-order:${order.id}`,
      metadata: {
        eduai_order_id: order.id,
        eduai_user_id: user.id,
        credits: Number(order.credits),
      },
      payer: {
        email: payerEmail,
        ...(cleanString(identificationInput.type, 20) && cleanString(identificationInput.number, 40)
          ? { identification: { type: cleanString(identificationInput.type, 20), number: cleanString(identificationInput.number, 40) } }
          : {}),
      },
    }

    const issuerId = cleanString(form.issuer_id, 80)
    if (issuerId) paymentBody.issuer_id = issuerId

    const payment = await mercadoPagoRequest<PaymentResult>("/v1/payments", {
      method: "POST",
      idempotencyKey: String(order.idempotency_key),
      body: paymentBody,
    })

    if (!payment.id) throw new Error("Mercado Pago no devolvió un identificador de pago.")
    const paymentId = String(payment.id)
    const mpStatus = String(payment.status || "pending")
    const orderStatus = mpStatus === "approved"
      ? "processing"
      : mpStatus === "rejected"
        ? "rejected"
        : mpStatus === "cancelled" || mpStatus === "canceled"
          ? "cancelled"
          : "processing"

    const { error: updateError } = await admin
      .from("ai_payment_orders")
      .update({
        status: orderStatus,
        mp_payment_id: paymentId,
        payment_status_detail: payment.status_detail || null,
        payer_email: payment.payer?.email || payerEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
    if (updateError) throw new Error(updateError.message)

    if (mpStatus === "approved") {
      const { error: creditError } = await admin.rpc("eduai_credit_approved_payment", {
        p_order_id: order.id,
        p_payment_id: paymentId,
        p_status_detail: payment.status_detail || null,
      })
      if (creditError) throw new Error(`Pago aprobado, pero no se pudo conciliar el saldo: ${creditError.message}`)
    }

    return NextResponse.json({
      ok: true,
      status: mpStatus,
      statusDetail: payment.status_detail || null,
      paymentId,
      wallet: mpStatus === "approved" ? await ensureWallet(user.id) : undefined,
    })
  } catch (error) {
    const typed = error as Error & { status?: number }
    return NextResponse.json(
      { ok: false, error: typed.message || "No se pudo procesar el pago." },
      { status: typed.status && typed.status >= 400 && typed.status < 600 ? typed.status : 500 }
    )
  }
}
