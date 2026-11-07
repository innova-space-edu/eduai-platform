"use client"

import { useState } from "react"

type Rating = "useful" | "incorrect" | "corrected"
type Choice = "A" | "B"
type Props = { answer: string; prompt?: string; module?: string }

export default function TrainingFeedback({ answer, prompt = "", module = "chat" }: Props) {
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
        <div className="mt-3 space-y-3">
          <p className="font-semibold">¿Cuál responde mejor a tu pregunta original? Elige una para aportar al entrenamiento.</p>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Comparar respuestas">
            {([{ key: "A" as Choice, label: "Respuesta A · original", text: answer },
              { key: "B" as Choice, label: "Respuesta B · alternativa", text: alternative }]).map(option => (
              <label key={option.key}
                className={"block cursor-pointer rounded-lg border p-3 " +
                  (choice === option.key ? "border-indigo-500 bg-indigo-500/10" : "border-slate-400/30")}>
                <span className="mb-2 flex items-center gap-2 font-semibold">
                  <input type="radio" checked={choice === option.key} onChange={() => { setChoice(option.key); setValidationHint("") }} />
                  {option.label}
                </span>
                <span className="block max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {option.text}
                </span>
              </label>
            ))}
          </div>
          <p className="opacity-70">La segunda respuesta no sustituye el mensaje del chat. Si ambas son incorrectas, aporta tu propia corrección.</p>
          <button type="button" disabled={busy} onClick={() => startRating("corrected")} className="underline">
            Ninguna es correcta: escribir una respuesta
          </button>
        </div>
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
