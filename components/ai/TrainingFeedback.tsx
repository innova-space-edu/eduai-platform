"use client"

import { useId, useState } from "react"
import MathRenderer from "@/components/ui/MathRenderer"

type Rating = "useful" | "incorrect" | "corrected"
type Choice = "A" | "B"
type Props = { answer: string; prompt?: string; module?: string }

export default function TrainingFeedback({ answer, prompt = "", module = "chat" }: Props) {
  const groupId = useId()
  const [rating, setRating] = useState<Rating | null>(null)
  const [question, setQuestion] = useState(prompt)
  const [correction, setCorrection] = useState("")
  const [alternative, setAlternative] = useState("")
  const [choice, setChoice] = useState<Choice | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [validationHint, setValidationHint] = useState("")

  function startRating(next: Rating) {
    setRating(next)
    setAlternative("")
    setChoice(null)
    setConfirmed(false)
    setNotice("")
    setValidationHint("")
  }

  async function compare() {
    if (busy || question.trim().length < 8) return
    setBusy(true)
    setRating(null)
    setAlternative("")
    setChoice(null)
    setConfirmed(false)
    setNotice("")
    setValidationHint("")
    try {
      const response = await fetch("/api/ai/training/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: question, answer, module }),
      })
      const data = await response.json()
      if (!response.ok || typeof data.answerB !== "string")
        throw new Error(data.error || "No fue posible generar otra respuesta")
      setAlternative(data.answerB)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo comparar")
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    const selectedRating: Rating | null = alternative
      ? choice === "A" ? "useful" : choice === "B" ? "corrected" : null
      : rating
    const selectedCorrection = alternative && choice === "B" ? alternative : correction
    if (busy) return
    // Mantener el botón visible y accionable: nunca fallar silenciosamente.
    if (!selectedRating) {
      setValidationHint("Selecciona la respuesta A o B antes de enviarla.")
      return
    }
    if (question.trim().length < 8) {
      setValidationHint("La pregunta original debe tener al menos 8 caracteres.")
      return
    }
    if (selectedRating === "corrected" && selectedCorrection.trim().length < 12) {
      setValidationHint("Escribe una respuesta correcta de al menos 12 caracteres.")
      return
    }
    if (!confirmed) {
      setValidationHint("Para enviar, marca la casilla que confirma que revisaste el contenido y puedes aportarlo.")
      return
    }

    setBusy(true)
    setNotice("")
    setValidationHint("")
    try {
      const response = await fetch("/api/ai/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feedback",
          rating: selectedRating,
          prompt: question,
          answer,
          correction: selectedCorrection,
          module: alternative ? module + "-ab-" + choice : module,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo enviar")
      setNotice(selectedRating === "incorrect"
        ? "Respuesta marcada como incorrecta y excluida del entrenamiento."
        : "Elección recibida. Solo la respuesta seleccionada queda pendiente de revisión, no se entrena automáticamente.")
      setRating(null)
      setAlternative("")
      setChoice(null)
      setConfirmed(false)
      setCorrection("")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo enviar")
    } finally {
      setBusy(false)
    }
  }

  // This is a text-only supervised-training workflow. Never offer A/B text
  // preference for generated images, audio or video; these require separate
  // multimodal evaluation and consent before they can become training examples.
  const isMediaResult = /!\[[^\]]*\]\((?:data:image\/|https?:\/\/|\/api\/)/i.test(answer) ||
    /<(?:audio|video)\b/i.test(answer)
  if (!answer.trim() || isMediaResult) return null

  return (
    <div className="mt-2 border-t border-slate-400/15 pt-2 text-xs" aria-label="Valorar respuesta para mejorar EDUAI">
      <div className="flex flex-wrap items-center gap-3">
        <span className="opacity-60">Mejorar EDUAI:</span>
        <button type="button" disabled={busy || question.trim().length < 8} onClick={() => void compare()}
          className="font-semibold underline underline-offset-2 disabled:opacity-40">
          {busy && !rating ? "Generando alternativa…" : "Comparar 2 respuestas"}
        </button>
        <button type="button" disabled={busy} onClick={() => startRating("useful")}>Útil</button>
        <button type="button" disabled={busy} onClick={() => startRating("incorrect")}>Incorrecta</button>
        <button type="button" disabled={busy} onClick={() => startRating("corrected")}>Escribir respuesta correcta</button>
      </div>

      {alternative && (
        <section className="mt-4 space-y-3" aria-label="Evaluación comparativa de respuestas">
          <div>
            <h3 className="text-sm font-bold text-main">Elige la mejor respuesta</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted2">
              Compara la claridad, exactitud y utilidad de ambas explicaciones. Selecciona la opción que prefieres.
            </p>
          </div>
          <div className="grid min-w-0 gap-3 lg:grid-cols-2" role="radiogroup" aria-label="Elegir la mejor respuesta">
            {([{ key: "A" as Choice, label: "Respuesta A", description: "Original", text: answer },
              { key: "B" as Choice, label: "Respuesta B", description: "Alternativa", text: alternative }]).map(option => (
              <section
                key={option.key}
                className={"min-w-0 overflow-hidden rounded-2xl border shadow-sm transition-colors " +
                  (choice === option.key
                    ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/25"
                    : "border-soft bg-card-theme hover:border-blue-300/60")}
                aria-label={option.label + " " + option.description}
              >
                <label htmlFor={groupId + "-" + option.key}
                  className="flex min-h-14 cursor-pointer items-center gap-2 border-b border-soft px-3 py-2.5 text-main focus-within:bg-blue-500/5">
                  <input
                    id={groupId + "-" + option.key}
                    name={groupId}
                    type="radio"
                    value={option.key}
                    checked={choice === option.key}
                    onChange={() => { setChoice(option.key); setValidationHint("") }}
                    className="h-4 w-4 shrink-0 accent-blue-600"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold">{option.label}</span>
                    <span className="block text-[11px] font-normal text-muted2">{option.description}</span>
                  </span>
                  {choice === option.key && (
                    <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">Seleccionada</span>
                  )}
                </label>
                <div className="h-80 min-w-0 overflow-y-auto overflow-x-hidden px-3 py-3 text-sm leading-relaxed lg:px-4"
                  aria-label={"Contenido de " + option.label}>
                  <MathRenderer
                    content={option.text}
                    className="min-w-0 text-sm [&_h1:first-child]:mt-0 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0 [&_p:last-child]:mb-0 [&_.katex-display]:max-w-full"
                  />
                </div>
              </section>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted2">
            La comparación no modifica el mensaje original ni entrena automáticamente al modelo.
            Si ambas respuestas tienen errores, puedes escribir una corrección.
          </p>
          <button type="button" disabled={busy} onClick={() => startRating("corrected")}
            className="font-semibold text-blue-700 underline underline-offset-2 disabled:opacity-50">
            Ninguna es correcta: escribir una respuesta
          </button>
        </section>
      )}

      {rating && (
        <div className="mt-2 grid gap-2">
          <label>Pregunta o instrucción original, sin datos personales
            <textarea className="mt-1 w-full rounded border border-slate-400/30 bg-transparent p-2"
              value={question} maxLength={24000} onChange={e => setQuestion(e.target.value)} />
          </label>
          {rating === "corrected" && (
            <label>Respuesta correcta a la pregunta (no una corrección ortográfica de la pregunta)
              <textarea className="mt-1 w-full rounded border border-slate-400/30 bg-transparent p-2"
                value={correction} maxLength={24000} onChange={e => setCorrection(e.target.value)} />
            </label>
          {correction.trim() && (
            <div className="min-w-0 rounded-xl border border-soft bg-card-theme p-3" aria-label="Vista previa de respuesta correcta">
              <p className="mb-2 text-xs font-bold text-main">Vista previa de tu respuesta</p>
              <MathRenderer content={correction} className="text-sm [&_p:last-child]:mb-0" />
            </div>
          )}
          )}
        </div>
      )}

      {(rating || alternative) && (
        <div className="mt-3 grid gap-2">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={confirmed} onChange={e => { setConfirmed(e.target.checked); setValidationHint("") }} />
            Revisé el contenido: no incluye datos personales ni material que no pueda aportar.
          </label>
          <p>Participación voluntaria de adultos.{" "}
            <a className="underline" href="/training-contribution" target="_blank" rel="noopener noreferrer">
              Autorizar o retirar aportes al entrenamiento
            </a>.
          </p>
          {validationHint && (
            <p role="alert" id="training-send-hint" className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 font-medium text-amber-800 dark:text-amber-200">
              {validationHint}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              aria-describedby={validationHint ? "training-send-hint" : undefined}
              onClick={() => void submit()}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "Enviando respuesta…" : alternative && choice ? `Enviar respuesta ${choice}` : "Enviar respuesta"}
            </button>
            <button type="button" disabled={busy} className="px-2 py-2 font-medium underline underline-offset-2"
              onClick={() => { setRating(null); setAlternative(""); setChoice(null); setConfirmed(false); setValidationHint("") }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {notice && <p role="status" className="mt-2">{notice}</p>}
    </div>
  )
}
