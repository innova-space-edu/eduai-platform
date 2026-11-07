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

  function startRating(next: Rating) {
    setRating(next)
    setAlternative("")
    setChoice(null)
    setConfirmed(false)
    setNotice("")
  }

  async function compare() {
    if (busy || question.trim().length < 8) return
    setBusy(true)
    setRating(null)
    setAlternative("")
    setChoice(null)
    setConfirmed(false)
    setNotice("")
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
    if (!selectedRating || !confirmed || busy) return
    if (selectedRating === "corrected" && selectedCorrection.trim().length < 12) return

    setBusy(true)
    setNotice("")
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

  if (!answer.trim()) return null

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
                  <input type="radio" checked={choice === option.key} onChange={() => setChoice(option.key)} />
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
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
            Revisé el contenido: no incluye datos personales ni material que no pueda aportar.
          </label>
          <p>Participación voluntaria de adultos.{" "}
            <a className="underline" href="/training-contribution" target="_blank" rel="noopener noreferrer">
              Autorizar o retirar aportes al entrenamiento
            </a>.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy || !confirmed || question.trim().length < 8 ||
              Boolean(alternative && !choice) ||
              Boolean(rating === "corrected" && correction.trim().length < 12)}
              onClick={() => void submit()} className="font-semibold disabled:opacity-40">
              {busy ? "Enviando…" : alternative ? "Guardar respuesta elegida" : "Enviar valoración"}
            </button>
            <button type="button" disabled={busy} onClick={() => { setRating(null); setAlternative(""); setChoice(null); setConfirmed(false) }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {notice && <p role="status" className="mt-2">{notice}</p>}
    </div>
  )
}
