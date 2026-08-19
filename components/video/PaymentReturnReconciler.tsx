"use client"

import { useEffect, useState } from "react"

type ReconcileResponse = {
  ok?: boolean
  status?: string
  error?: string
}

export default function PaymentReturnReconciler() {
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<"ok" | "warn" | "error">("warn")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paymentId = params.get("payment_id") || params.get("collection_id")
    const paymentHint = params.get("payment")

    if (!paymentId) {
      if (paymentHint === "failure") {
        setTone("error")
        setMessage("El pago no se completó. No se agregaron créditos.")
      } else if (paymentHint === "pending") {
        setTone("warn")
        setMessage("El pago está pendiente de confirmación. Los créditos aparecerán cuando Mercado Pago lo apruebe.")
      }
      return
    }

    let cancelled = false
    const reconcile = async () => {
      setTone("warn")
      setMessage("Verificando tu pago con Mercado Pago…")
      try {
        const response = await fetch("/api/credits/mercadopago/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId }),
        })
        const body = (await response.json().catch(() => null)) as ReconcileResponse | null
        if (cancelled) return
        if (!response.ok || !body?.ok) throw new Error(body?.error || "No se pudo verificar el pago.")

        if (body.status === "approved") {
          setTone("ok")
          setMessage("Pago confirmado. Tus Créditos IA ya fueron acreditados.")
        } else if (body.status === "rejected" || body.status === "cancelled" || body.status === "canceled") {
          setTone("error")
          setMessage("El pago no fue aprobado. No se agregaron créditos.")
        } else {
          setTone("warn")
          setMessage("El pago está en proceso. EduAI lo acreditará cuando Mercado Pago confirme la aprobación.")
        }

        const cleanUrl = new URL(window.location.href)
        cleanUrl.searchParams.delete("payment_id")
        cleanUrl.searchParams.delete("collection_id")
        cleanUrl.searchParams.delete("collection_status")
        cleanUrl.searchParams.delete("payment_type")
        cleanUrl.searchParams.delete("merchant_order_id")
        cleanUrl.searchParams.delete("preference_id")
        cleanUrl.searchParams.delete("site_id")
        cleanUrl.searchParams.delete("processing_mode")
        cleanUrl.searchParams.delete("merchant_account_id")
        cleanUrl.searchParams.set("payment", body.status === "approved" ? "confirmed" : body.status || "pending")
        window.history.replaceState({}, "", cleanUrl.toString())

        if (body.status === "approved") {
          window.setTimeout(() => window.location.reload(), 900)
        }
      } catch (error) {
        if (cancelled) return
        setTone("error")
        setMessage(error instanceof Error ? error.message : "No se pudo verificar el pago.")
      }
    }

    void reconcile()
    return () => { cancelled = true }
  }, [])

  if (!message) return null

  const className = tone === "ok"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800"
    : tone === "error"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-800"
      : "border-amber-500/30 bg-amber-500/10 text-amber-800"

  return (
    <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${className}`} role="status">
      {message}
    </div>
  )
}
