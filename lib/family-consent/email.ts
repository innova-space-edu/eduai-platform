/** Transactional guardian invitations: fail closed if no real email provider is configured. */
export async function sendGuardianConsentEmail(recipient: string, url: string, platform: "eduai" | "sello"): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const sender = process.env.FAMILY_CONSENT_FROM_EMAIL
  if (!apiKey || !sender) throw new Error("El correo transaccional no está configurado")
  const product = platform === "eduai" ? "EDUAI" : "Sello Tecnológico"
  // Avoid names, RUT and student identifiers in third-party email payloads.
  const text = [
    `Solicitud de autorización familiar — ${product}`,
    "Se requiere que un padre, madre o representante con facultades legales revise y firme este formulario.",
    "Revisa cada finalidad de forma separada. Puedes aceptar o rechazar cada uso.",
    "Abre el enlace privado (no lo reenvíes):", url,
    "La firma se someterá a verificación de identidad y representación por la institución.",
    "Innova Space Edu SpA · contacto@innova-space-edu.cl",
  ].join("\n\n")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: {
      Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender, to: [recipient],
      subject: `Autorización familiar para ${product}`,
      text,
    }),
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error(`El proveedor no aceptó el envío (${response.status})`)
}
