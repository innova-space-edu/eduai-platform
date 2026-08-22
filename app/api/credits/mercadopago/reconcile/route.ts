import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureWallet, getAdminSupabase, mercadoPagoRequest } from "@/lib/credits/server"

export const runtime = "nodejs"

type PaymentResource = {
  id?: number | string
  status?: string
  status_detail?: string
  transaction_amount?: number
  external_reference?: string
  metadata?: { eduai_order_id?: string; eduai_user_id?: string }
  payer?: { email?: string }
}

function orderIdFromPayment(payment: PaymentResource) {
  if (payment.metadata?.eduai_order_id) return String(payment.metadata.eduai_order_id)
  const prefix = "eduai-credit-order:"
  return payment.external_reference?.startsWith(prefix)
    ? payment.external_reference.slice(prefix.length)
    : null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { paymentId?: string | number }
    const paymentId = body.paymentId != null ? String(body.paymentId).trim() : ""
    if (!paymentId || !/^\d+$/.test(paymentId)) {
      return NextResponse.json({ ok: false, error: "Identificador de pago inválido." }, { status: 400 })
    }

    const payment = await mercadoPagoRequest<PaymentResource>(`/v1/payments/${encodeURIComponent(paymentId)}`)
    const orderId = orderIdFromPayment(payment)
    if (!orderId || !payment.id) {
      return NextResponse.json({ ok: false, error: "El pago no corresponde a una recarga EduAI." }, { status: 400 })
    }

    const admin = getAdminSupabase()
    const { data: order, error: orderError } = await admin
      .from("ai_payment_orders")
      .select("id,user_id,amount_clp,credits,status,mp_payment_id")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (orderError) throw new Error(orderError.message)
    if (!order) {
      return NextResponse.json({ ok: false, error: "La orden no pertenece a esta cuenta." }, { status: 404 })
    }

    if (Number(payment.transaction_amount) !== Number(order.amount_clp)) {
      return NextResponse.json({ ok: false, error: "El monto confirmado no coincide con la orden EduAI." }, { status: 409 })
    }

    const status = String(payment.status || "pending")
    const authoritativePaymentId = String(payment.id)

    if (status === "approved") {
      const { error: creditError } = await admin.rpc("eduai_credit_approved_payment", {
        p_order_id: order.id,
        p_payment_id: authoritativePaymentId,
        p_status_detail: payment.status_detail || null,
      })
      if (creditError) throw new Error(creditError.message)
      return NextResponse.json({
        ok: true,
        status: "approved",
        statusDetail: payment.status_detail || null,
        wallet: await ensureWallet(user.id),
      })
    }

    if (status === "refunded" || status === "charged_back") {
      const { error: reverseError } = await admin.rpc("eduai_reverse_payment", {
        p_payment_id: authoritativePaymentId,
        p_new_status: status,
      })
      if (reverseError) throw new Error(reverseError.message)
      return NextResponse.json({ ok: true, status, wallet: await ensureWallet(user.id) })
    }

    const mappedStatus = status === "rejected"
      ? "rejected"
      : status === "cancelled" || status === "canceled"
        ? "cancelled"
        : "processing"

    const { error: updateError } = await admin
      .from("ai_payment_orders")
      .update({
        status: mappedStatus,
        mp_payment_id: authoritativePaymentId,
        payment_status_detail: payment.status_detail || null,
        payer_email: payment.payer?.email || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
    if (updateError) throw new Error(updateError.message)

    return NextResponse.json({ ok: true, status, statusDetail: payment.status_detail || null })
  } catch (error) {
    const typed = error as Error & { status?: number }
    return NextResponse.json(
      { ok: false, error: typed.message || "No se pudo reconciliar el pago." },
      { status: typed.status && typed.status >= 400 && typed.status < 600 ? typed.status : 500 }
    )
  }
}
