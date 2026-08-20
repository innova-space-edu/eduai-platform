import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(relativePath) {
  const target = path.join(root, relativePath)
  if (!fs.existsSync(target)) throw new Error(`[video-payment-fixes] No se encontró ${relativePath}`)
  return fs.readFileSync(target, "utf8")
}

function write(relativePath, source) {
  fs.writeFileSync(path.join(root, relativePath), source)
}

function patch(relativePath, transform) {
  const original = read(relativePath)
  const next = transform(original)
  if (next !== original) {
    write(relativePath, next)
    console.log(`[video-payment-fixes] actualizado ${relativePath}`)
  } else {
    console.log(`[video-payment-fixes] ${relativePath} ya estaba corregido`)
  }
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`[video-payment-fixes] No se encontró ${label}`)
  return source.replace(before, after)
}

patch("components/video/VideoStudioClient.tsx", (source) => {
  let next = source

  const helper = `function paymentRejectionMessage(statusDetail?: string | null) {
  const code = (statusDetail || "").trim()
  const messages: Record<string, string> = {
    cc_rejected_other_reason: "Pago rechazado por Mercado Pago por validación de riesgo. Si estás usando credenciales TEST, utiliza una tarjeta de prueba y completa el titular como APRO con documento Otro 123456789.",
    cc_rejected_high_risk: "Pago rechazado por validación de riesgo. En pruebas usa una tarjeta de prueba, titular APRO y documento Otro 123456789.",
    cc_rejected_bad_filled_card_number: "Revisa el número de la tarjeta.",
    cc_rejected_bad_filled_date: "Revisa la fecha de vencimiento.",
    cc_rejected_bad_filled_security_code: "Revisa el código de seguridad.",
    cc_rejected_insufficient_amount: "La tarjeta no tiene saldo o cupo suficiente.",
    cc_rejected_duplicated_payment: "Mercado Pago detectó un pago duplicado. Espera antes de intentar otra vez.",
  }
  return messages[code] || (code ? \`Pago rechazado por Mercado Pago (\${code}).\` : "El pago fue rechazado por Mercado Pago.")
}
`

  if (!next.includes("function paymentRejectionMessage")) {
    next = replaceRequired(
      next,
      `function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}
`,
      `function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}

${helper}`,
      "helper de rechazo de pago",
    )
  }

  next = replaceRequired(
    next,
    `    if (data.status === "rejected") throw new Error(data.statusDetail || "El pago fue rechazado.")`,
    `    if (data.status === "rejected") throw new Error(paymentRejectionMessage(data.statusDetail))`,
    "mensaje amigable de rechazo",
  )

  next = replaceRequired(
    next,
    `      const mp = new window.MercadoPago(order.publicKey, { locale: "es-CL" })
      const builder = mp.bricks()
      const settings: Record<string, unknown> = {`,
    `      const mp = new window.MercadoPago(order.publicKey, { locale: "es-CL" })
      const builder = mp.bricks()
      const testMode = order.publicKey.startsWith("TEST-")
      const settings: Record<string, unknown> = {`,
    "detección de credenciales TEST",
  )

  next = replaceRequired(
    next,
    `            ...(order.preferenceId ? { mercadoPago: "all" } : {}),`,
    `            ...(order.preferenceId && !testMode ? { mercadoPago: "all" } : {}),`,
    "wallet de Mercado Pago solo fuera de TEST",
  )

  const walletDetails = `                  {wallet && wallet.reservedCredits > 0 && <p className="mt-1 text-xs text-amber-600">{formatCredits(wallet.reservedCredits)} reservados en generaciones</p>}`
  if (next.includes(walletDetails) && !next.includes("Comprados acumulados")) {
    next = next.replace(
      walletDetails,
      `${walletDetails}\n                  {wallet && <p className="mt-1 text-xs text-sub">Comprados acumulados: {formatCredits(wallet.lifetimePurchasedCredits)} · Gastados: {formatCredits(wallet.lifetimeSpentCredits)}</p>}`,
    )
  }

  const activeOrderSummary = `                <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex justify-between"><span>Recarga</span><strong>{formatClp(Number(activeOrder.amountClp || 0))}</strong></div>
                  <div className="mt-1 flex justify-between"><span>Créditos IA</span><strong>{formatCredits(activeOrder.credits)}</strong></div>
                </div>`
  if (next.includes(activeOrderSummary) && !next.includes("Modo de prueba de Mercado Pago")) {
    next = next.replace(
      activeOrderSummary,
      `${activeOrderSummary}\n                {activeOrder.publicKey?.startsWith("TEST-") && (\n                  <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-900">\n                    <strong>Modo de prueba de Mercado Pago.</strong> Usa una tarjeta de prueba. Para simular un pago aprobado escribe <strong>APRO</strong> como nombre del titular, selecciona documento <strong>Otro</strong> con número <strong>123456789</strong> y usa un correo distinto al de la cuenta vendedora. No uses una tarjeta real.\n                  </div>\n                )}`,
    )
  }

  return next
})

patch("app/api/credits/mercadopago/payment/route.ts", (source) => {
  let next = source
  if (!next.includes('from "node:crypto"')) {
    next = replaceRequired(
      next,
      `import { NextRequest, NextResponse } from "next/server"\n`,
      `import { createHash } from "node:crypto"\nimport { NextRequest, NextResponse } from "next/server"\n`,
      "import de hash para idempotencia por intento",
    )
  }

  next = replaceRequired(
    next,
    `    const payment = await mercadoPagoRequest<PaymentResult>("/v1/payments", {
      method: "POST",
      idempotencyKey: String(order.idempotency_key),
      body: paymentBody,
    })`,
    `    // La idempotencia se conserva para reenvíos del mismo token, pero un
    // nuevo intento con otra tarjeta obtiene una clave distinta. Así un pago
    // rechazado no queda "pegado" a la respuesta del primer intento.
    const paymentAttemptKey = createHash("sha256")
      .update(\`${String(order.idempotency_key)}:\${token}\`)
      .digest("hex")

    const payment = await mercadoPagoRequest<PaymentResult>("/v1/payments", {
      method: "POST",
      idempotencyKey: paymentAttemptKey,
      body: paymentBody,
    })`,
    "idempotencia por intento de tarjeta",
  )

  return next
})

patch("components/ui/SupportButton.tsx", (source) => {
  const before = `  useEffect(() => {
    // Revisar respuestas no leídas al montar
    fetch("/api/reports")
      .then(r => r.json())
      .then(d => {
        const withReply = (d.reports || []).filter((r: Report) => r.admin_reply && r.status !== "cerrado")
        setUnreadReply(withReply.length)
      })
      .catch(() => {})
  }, [])`
  const after = `  useEffect(() => {
    // Evita solicitar /api/reports durante el montaje inicial: en previews la
    // sesión puede no haberse hidratado todavía y generaba un 401 innecesario.
    // La historia se consulta cuando el usuario abre el panel.
    if (!open) return
    fetch("/api/reports")
      .then(async r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const withReply = (d.reports || []).filter((r: Report) => r.admin_reply && r.status !== "cerrado")
        setUnreadReply(withReply.length)
      })
      .catch(() => {})
  }, [open])`
  return replaceRequired(source, before, after, "fetch prematuro de reportes")
})

console.log("[video-payment-fixes] Payment Brick TEST, reintentos, mensajes y saldo verificados")
