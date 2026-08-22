import { createHmac, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getAdminSupabase, mercadoPagoRequest } from "@/lib/credits/server"

export const runtime = "nodejs"

type PaymentResource = {
  id?: number | string
  status?: string
  status_detail?: string
  transaction_amount?: number
  external_reference?: string
  metadata?: { eduai_order_id?: string; eduai_user_id?: string; credits?: number }
  payer?: { email?: string }
}

type ChargebackResource = { payments?: Array<number | string> | number | string }

function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex")
    const right = Buffer.from(b, "hex")
    return left.length === right.length && timingSafeEqual(left, right)
  } catch {
    return false
  }
}

function validateSignature(req: NextRequest, dataId: string | null) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()
  if (!secret) return false
  const signature = req.headers.get("x-signature") || ""
  const requestId = req.headers.get("x-request-id") || ""
  const parts = Object.fromEntries(signature.split(",").map((part) => {
    const [key, ...rest] = part.trim().split("=")
    return [key, rest.join("=")]
  }))
  const ts = parts.ts
  const received = parts.v1
  if (!ts || !received) return false

  let manifest = ""
  if (dataId) manifest += `id:${dataId};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${ts};`
  const expected = createHmac("sha256", secret).update(manifest).digest("hex")
  return safeEqualHex(expected, received)
}

function orderIdFromPayment(payment: PaymentResource) {
  if (payment.metadata?.eduai_order_id) return String(payment.metadata.eduai_order_id)
  const prefix = "eduai-credit-order:"
  return payment.external_reference?.startsWith(prefix)
    ? payment.external_reference.slice(prefix.length)
    : null
}

async function reconcilePayment(paymentId: string) {
  const payment = await mercadoPagoRequest<PaymentResource>(`/v1/payments/${encodeURIComponent(paymentId)}`)
  const orderId = orderIdFromPayment(payment)
  if (!orderId || !payment.id) return

  const admin = getAdminSupabase()
  const { data: order, error } = await admin
    .from("ai_payment_orders")
    .select("id,user_id,amount_clp,credits,status,mp_payment_id")
    .eq("id", orderId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!order) return

  if (Number(payment.transaction_amount) !== Number(order.amount_clp)) {
    throw new Error("El monto de Mercado Pago no coincide con la orden EduAI.")
  }

  const status = String(payment.status || "pending")
  const id = String(payment.id)
  if (status === "approved") {
    const { error: rpcError } = await admin.rpc("eduai_credit_approved_payment", {
      p_order_id: order.id,
      p_payment_id: id,
      p_status_detail: payment.status_detail || null,
    })
    if (rpcError) throw new Error(rpcError.message)
    return
  }

  if (status === "refunded" || status === "charged_back") {
    const { error: reverseError } = await admin.rpc("eduai_reverse_payment", {
      p_payment_id: id,
      p_new_status: status,
    })
    if (reverseError) throw new Error(reverseError.message)
    return
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
      mp_payment_id: id,
      payment_status_detail: payment.status_detail || null,
      payer_email: payment.payer?.email || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
  if (updateError) throw new Error(updateError.message)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    type?: string
    action?: string
    data?: { id?: string | number; payment_id?: string | number }
  }
  const queryDataId = req.nextUrl.searchParams.get("data.id")
  const dataId = queryDataId || (body.data?.id != null ? String(body.data.id) : null)

  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ ok: false, error: "Webhook secret not configured." }, { status: 503 })
  }
  if (!validateSignature(req, dataId)) {
    return NextResponse.json({ ok: false, error: "Invalid Mercado Pago signature." }, { status: 401 })
  }

  try {
    const type = String(body.type || req.nextUrl.searchParams.get("type") || "")
    if (type === "payment" && dataId) {
      await reconcilePayment(dataId)
      return NextResponse.json({ ok: true })
    }

    if (["chargebacks", "topic_chargebacks_wh"].includes(type)) {
      let paymentId = body.data?.payment_id != null ? String(body.data.payment_id) : null
      if (!paymentId && dataId) {
        const chargeback = await mercadoPagoRequest<ChargebackResource>(`/v1/chargebacks/${encodeURIComponent(dataId)}`)
        const payments = Array.isArray(chargeback.payments) ? chargeback.payments : [chargeback.payments].filter(Boolean)
        paymentId = payments.length ? String(payments[0]) : null
      }
      if (paymentId) {
        const admin = getAdminSupabase()
        const { error } = await admin.rpc("eduai_reverse_payment", {
          p_payment_id: paymentId,
          p_new_status: "charged_back",
        })
        if (error) throw new Error(error.message)
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true, ignored: true })
  } catch (error) {
    console.error("[MercadoPago][webhook]", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
