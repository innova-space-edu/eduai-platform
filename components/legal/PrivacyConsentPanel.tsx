"use client"

import Link from "next/link"
import { useState } from "react"

export const PRIVACY_TERMS_VERSION = "2026-10-11-v1"

export type OptionalPrivacyPurpose = "ai_generation" | "ai_documents" | "ai_voice" | "optional_analytics"
export type OptionalPrivacyChoices = Record<OptionalPrivacyPurpose, boolean>

export const EMPTY_OPTIONAL_PRIVACY_CHOICES: OptionalPrivacyChoices = {
  ai_generation: false,
  ai_documents: false,
  ai_voice: false,
  optional_analytics: false,
}

export const OPTIONAL_PRIVACY_PURPOSES: Array<{
  key: OptionalPrivacyPurpose
  title: string
  explanation: string
}> = [
  {
    key: "ai_generation",
    title: "Asistentes y generación de contenido mediante IA",
    explanation: "Autoriza solicitudes de generación de texto, imágenes, explicaciones y recursos educativos con modelos externos. Solo se debe enviar información necesaria para la consulta.",
  },
  {
    key: "ai_documents",
    title: "Analizar archivos mediante modelos de IA",
    explanation: "Autoriza enviar a proveedores los fragmentos de documentos necesarios para la función solicitada. No permite enviar expedientes sensibles ni publicar los archivos.",
  },
  {
    key: "ai_voice",
    title: "Voz, transcripción y audio mediante IA",
    explanation: "Autoriza las funciones opcionales de voz y transcripción. El navegador puede solicitar permiso de micrófono por separado. No autoriza clonación de voz, que requiere un permiso específico.",
  },
  {
    key: "optional_analytics",
    title: "Medición opcional para mejorar el servicio",
    explanation: "Permite estadísticas no indispensables para el servicio. Las métricas estrictamente necesarias para seguridad y funcionamiento se informan separadamente.",
  },
]

type PrivacyPreferencesProps = {
  value: OptionalPrivacyChoices
  onChange: (value: OptionalPrivacyChoices) => void
  minorRestricted?: boolean
}

export function PrivacyPreferences({ value, onChange, minorRestricted = false }: PrivacyPreferencesProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold text-main">Permisos opcionales, independientes y revocables</legend>
      <p className="text-xs leading-5 text-sub">
        Todos empiezan desactivados. Rechazar una finalidad opcional no impide crear una cuenta o
        utilizar las funciones básicas disponibles. Una función que requiera este permiso deberá
        comprobarlo antes de procesar datos.
      </p>
      {minorRestricted && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5 text-sub">
          Cuenta de menor de edad: estas opciones permanecerán desactivadas durante esta etapa.
          Los permisos de representantes legales o establecimientos deben verificarse mediante
          un procedimiento separado; una casilla no acredita representación.
        </p>
      )}
      {OPTIONAL_PRIVACY_PURPOSES.map((purpose) => (
        <label key={purpose.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-soft p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
            checked={minorRestricted ? false : value[purpose.key]}
            disabled={minorRestricted}
            onChange={(event) => onChange({ ...value, [purpose.key]: event.target.checked })}
            aria-label={purpose.title}
          />
          <span className="space-y-1 text-xs leading-5 text-sub">
            <span className="block font-semibold text-main">{purpose.title}</span>
            <span className="block">{purpose.explanation}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

type PrivacyConsentPanelProps = PrivacyPreferencesProps & {
  acceptedTerms: boolean
  onAcceptedTerms: (accepted: boolean) => void
  acknowledgedDataWarning: boolean
  onAcknowledgedDataWarning: (acknowledged: boolean) => void
}

export default function PrivacyConsentPanel({
  acceptedTerms,
  onAcceptedTerms,
  acknowledgedDataWarning,
  onAcknowledgedDataWarning,
  ...preferences
}: PrivacyConsentPanelProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="space-y-4 rounded-2xl border border-soft bg-card-soft-theme p-4" aria-label="Condiciones y preferencias de privacidad">
      <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-main">
        <input type="checkbox" checked={expanded} onChange={e=>setExpanded(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-600"/>
        <span>Desplegar formulario de términos y consentimiento por finalidad
          <span className="block text-xs font-normal text-sub">Al marcar esta casilla aparecerán todos los permisos. No se acepta nada automáticamente.</span>
        </span>
      </label>
      {expanded && <>
      <div>
        <h3 className="text-sm font-bold text-main">Condiciones de uso y decisiones de privacidad</h3>
        <p className="mt-1 text-xs leading-5 text-sub">
          Innova Space Edu SpA informa sobre la creación de cuentas, proyectos, almacenamiento,
          evaluaciones y funciones educativas. Consulta las{" "}
          <Link href="/terminos" target="_blank" className="font-semibold text-blue-600 underline">condiciones</Link>,{" "}
          <Link href="/privacidad" target="_blank" className="font-semibold text-blue-600 underline">privacidad</Link>,{" "}
          <Link href="/gobernanza-ia" target="_blank" className="font-semibold text-blue-600 underline">uso de IA</Link> y{" "}
          <Link href="/seguridad" target="_blank" className="font-semibold text-blue-600 underline">seguridad</Link>.
        </p>
      </div>
      <label className="flex items-start gap-3 text-xs leading-5 text-sub">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-blue-600" checked={acceptedTerms} onChange={(event) => onAcceptedTerms(event.target.checked)} />
        <span>Declaro que he leído y acepto las <strong>condiciones necesarias del servicio</strong> (versión {PRIVACY_TERMS_VERSION}) y que he podido consultar la información sobre tratamiento de datos. Esta aceptación no autoriza automáticamente los usos opcionales.</span>
      </label>
      <label className="flex items-start gap-3 text-xs leading-5 text-sub">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-blue-600" checked={acknowledgedDataWarning} onChange={(event) => onAcknowledgedDataWarning(event.target.checked)} />
        <span>Comprendo que no debo incluir RUT, diagnósticos, información familiar, expedientes, notas identificables u otros datos sensibles que la IA no solicita en chats o archivos. Si incorporo esa información, puede ser transmitida y tratada por el proveedor; mi reconocimiento <strong>no implica renuncia a derechos ni exime a EDUAI de proteger los datos</strong>.</span>
      </label>
      <PrivacyPreferences {...preferences} />
      <p className="text-xs leading-5 text-sub">
        La publicación de trabajos o fotografías, el tratamiento especial de datos sensibles y la
        clonación de voz requieren autorizaciones distintas y verificables, según corresponda.
        Los permisos opcionales podrán cambiarse en la configuración de cuenta. El consentimiento
        no sustituye otras bases legales ni las autorizaciones de responsables institucionales.
      </p>
      </>}
    </section>
  )
}
