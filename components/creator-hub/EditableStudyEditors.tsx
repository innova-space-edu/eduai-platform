"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react"

type EditorProps = {
  data: any
  onChange: (next: any) => void
}

const fieldClass = "w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-main outline-none placeholder:text-muted2 focus:border-blue-500/30"
const labelClass = "text-[10px] font-bold uppercase tracking-[0.14em] text-muted2"

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function FlashcardsContentEditor({ data, onChange }: EditorProps) {
  const cards = Array.isArray(data?.cards) ? data.cards : []
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (selectedIndex >= cards.length) setSelectedIndex(Math.max(0, cards.length - 1))
  }, [cards.length, selectedIndex])

  const selected = cards[selectedIndex]
  const patch = (next: Record<string, unknown>) => onChange({ ...data, ...next })
  const setCards = (next: any[]) => patch({ cards: next })
  const updateCard = (index: number, nextPatch: Record<string, unknown>) => {
    setCards(cards.map((card: any, cardIndex: number) => cardIndex === index ? { ...card, ...nextPatch } : card))
  }

  const addCard = () => {
    const next = [
      ...cards,
      {
        id: makeId("card"),
        front: "Nueva pregunta",
        back: "Nueva respuesta",
        hint: "",
        mnemonic: "",
        difficulty: 1,
        tags: [],
      },
    ]
    setCards(next)
    setSelectedIndex(next.length - 1)
  }

  const duplicateCard = () => {
    if (!selected) return
    const copy = { ...JSON.parse(JSON.stringify(selected)), id: makeId("card") }
    const next = [...cards]
    next.splice(selectedIndex + 1, 0, copy)
    setCards(next)
    setSelectedIndex(selectedIndex + 1)
  }

  const removeCard = () => {
    if (cards.length <= 1) return
    setCards(cards.filter((_: any, index: number) => index !== selectedIndex))
  }

  const moveSelected = (direction: -1 | 1) => {
    const next = moveItem(cards, selectedIndex, direction)
    if (next === cards) return
    setCards(next)
    setSelectedIndex(selectedIndex + direction)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
        <p className="text-xs font-bold text-cyan-500">Editor de tarjetas</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted2">Corrige preguntas y respuestas, agrega pistas y organiza el mazo antes de exportarlo.</p>
      </div>

      <div className="grid gap-3">
        <label className="space-y-1.5">
          <span className={labelClass}>Nombre del mazo</span>
          <input value={data?.deckTitle || ""} onChange={(event) => patch({ deckTitle: event.target.value })} className={fieldClass} />
        </label>
        <label className="space-y-1.5">
          <span className={labelClass}>Tema</span>
          <input value={data?.topic || ""} onChange={(event) => patch({ topic: event.target.value })} className={fieldClass} />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-main">Tarjetas</p>
            <p className="text-[10px] text-muted2">Selecciona una tarjeta para editarla.</p>
          </div>
          <button type="button" onClick={addCard} className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 text-xs font-bold text-cyan-600"><Plus size={13} /> Tarjeta</button>
        </div>
        <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
          {cards.map((card: any, index: number) => (
            <button key={card.id || index} type="button" onClick={() => setSelectedIndex(index)} className="w-full rounded-xl border p-2.5 text-left transition" style={{ borderColor: selectedIndex === index ? "rgba(6,182,212,0.38)" : "var(--border-soft)", background: selectedIndex === index ? "rgba(6,182,212,0.08)" : "var(--bg-card-soft)" }}>
              <span className="block text-[10px] font-black text-cyan-600">Tarjeta {index + 1} · Nivel {card.difficulty || 1}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-sub">{card.front || "Sin pregunta"}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="space-y-3 rounded-2xl border border-soft bg-card-soft-theme p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted2">Editar tarjeta {selectedIndex + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex === 0} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex === cards.length - 1} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowDown size={12} /></button>
              <button type="button" onClick={duplicateCard} className="rounded-lg border border-soft p-1.5 text-muted2"><Copy size={12} /></button>
              <button type="button" onClick={removeCard} disabled={cards.length <= 1} className="rounded-lg border border-red-500/20 p-1.5 text-red-500 disabled:opacity-25"><Trash2 size={12} /></button>
            </div>
          </div>

          <label className="space-y-1.5">
            <span className={labelClass}>Frente · pregunta</span>
            <textarea value={selected.front || ""} onChange={(event) => updateCard(selectedIndex, { front: event.target.value })} rows={3} className={`${fieldClass} resize-y`} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Reverso · respuesta</span>
            <textarea value={selected.back || ""} onChange={(event) => updateCard(selectedIndex, { back: event.target.value })} rows={4} className={`${fieldClass} resize-y`} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Pista</span>
            <textarea value={selected.hint || ""} onChange={(event) => updateCard(selectedIndex, { hint: event.target.value })} rows={2} className={`${fieldClass} resize-y`} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Regla mnemónica</span>
            <textarea value={selected.mnemonic || ""} onChange={(event) => updateCard(selectedIndex, { mnemonic: event.target.value })} rows={2} className={`${fieldClass} resize-y`} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5">
              <span className={labelClass}>Dificultad</span>
              <select value={selected.difficulty || 1} onChange={(event) => updateCard(selectedIndex, { difficulty: Number(event.target.value) })} className={fieldClass}>
                <option value={1}>1 · Básica</option>
                <option value={2}>2 · Intermedia</option>
                <option value={3}>3 · Avanzada</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Etiquetas</span>
              <input value={Array.isArray(selected.tags) ? selected.tags.join(", ") : ""} onChange={(event) => updateCard(selectedIndex, { tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} placeholder="concepto, fórmula" className={fieldClass} />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

export function QuizContentEditor({ data, onChange }: EditorProps) {
  const questions = Array.isArray(data?.questions) ? data.questions : []
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (selectedIndex >= questions.length) setSelectedIndex(Math.max(0, questions.length - 1))
  }, [questions.length, selectedIndex])

  const selected = questions[selectedIndex]
  const patch = (next: Record<string, unknown>) => onChange({ ...data, ...next })
  const setQuestions = (next: any[]) => patch({ questions: next })
  const updateQuestion = (index: number, nextPatch: Record<string, unknown>) => {
    setQuestions(questions.map((question: any, questionIndex: number) => questionIndex === index ? { ...question, ...nextPatch } : question))
  }

  const addQuestion = () => {
    const next = [
      ...questions,
      {
        type: "multiple_choice",
        question: "Nueva pregunta",
        options: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
        correctAnswer: 0,
        explanation: "Explica aquí por qué la respuesta es correcta.",
        difficulty: 1,
        distractorHints: [],
      },
    ]
    setQuestions(next)
    setSelectedIndex(next.length - 1)
  }

  const duplicateQuestion = () => {
    if (!selected) return
    const copy = JSON.parse(JSON.stringify(selected))
    const next = [...questions]
    next.splice(selectedIndex + 1, 0, copy)
    setQuestions(next)
    setSelectedIndex(selectedIndex + 1)
  }

  const removeQuestion = () => {
    if (questions.length <= 1) return
    setQuestions(questions.filter((_: any, index: number) => index !== selectedIndex))
  }

  const moveSelected = (direction: -1 | 1) => {
    const next = moveItem(questions, selectedIndex, direction)
    if (next === questions) return
    setQuestions(next)
    setSelectedIndex(selectedIndex + direction)
  }

  const options = useMemo(() => Array.isArray(selected?.options) ? selected.options : [], [selected])

  const changeType = (type: string) => {
    if (!selected) return
    if (type === "true_false") {
      updateQuestion(selectedIndex, { type, options: ["Verdadero", "Falso"], correctAnswer: Math.min(Number(selected.correctAnswer) || 0, 1) })
      return
    }
    const currentOptions = options.length >= 4 ? options : [...options, "Alternativa", "Alternativa", "Alternativa", "Alternativa"].slice(0, 4)
    updateQuestion(selectedIndex, { type, options: currentOptions, correctAnswer: Math.min(Number(selected.correctAnswer) || 0, currentOptions.length - 1) })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
        <p className="text-xs font-bold text-green-600">Editor de evaluación</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted2">Ajusta preguntas, distractores, respuestas y retroalimentación antes de usar el quiz.</p>
      </div>

      <div className="grid gap-3">
        <label className="space-y-1.5">
          <span className={labelClass}>Título</span>
          <input value={data?.title || ""} onChange={(event) => patch({ title: event.target.value })} className={fieldClass} />
        </label>
        <label className="space-y-1.5">
          <span className={labelClass}>Tema</span>
          <input value={data?.topic || ""} onChange={(event) => patch({ topic: event.target.value })} className={fieldClass} />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div><p className="text-xs font-bold text-main">Preguntas</p><p className="text-[10px] text-muted2">Selecciona una para editarla.</p></div>
          <button type="button" onClick={addQuestion} className="inline-flex items-center gap-1.5 rounded-xl border border-green-500/25 bg-green-500/5 px-3 py-2 text-xs font-bold text-green-600"><Plus size={13} /> Pregunta</button>
        </div>
        <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
          {questions.map((question: any, index: number) => (
            <button key={index} type="button" onClick={() => setSelectedIndex(index)} className="w-full rounded-xl border p-2.5 text-left transition" style={{ borderColor: selectedIndex === index ? "rgba(34,197,94,0.36)" : "var(--border-soft)", background: selectedIndex === index ? "rgba(34,197,94,0.08)" : "var(--bg-card-soft)" }}>
              <span className="block text-[10px] font-black text-green-600">{index + 1}. {question.type || "multiple_choice"} · Nivel {question.difficulty || 1}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-sub">{question.question || "Sin enunciado"}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="space-y-3 rounded-2xl border border-soft bg-card-soft-theme p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted2">Editar pregunta {selectedIndex + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex === 0} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex === questions.length - 1} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowDown size={12} /></button>
              <button type="button" onClick={duplicateQuestion} className="rounded-lg border border-soft p-1.5 text-muted2"><Copy size={12} /></button>
              <button type="button" onClick={removeQuestion} disabled={questions.length <= 1} className="rounded-lg border border-red-500/20 p-1.5 text-red-500 disabled:opacity-25"><Trash2 size={12} /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5">
              <span className={labelClass}>Tipo</span>
              <select value={selected.type || "multiple_choice"} onChange={(event) => changeType(event.target.value)} className={fieldClass}>
                <option value="multiple_choice">Selección múltiple</option>
                <option value="true_false">Verdadero o falso</option>
                <option value="fill_blank">Completar</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Dificultad</span>
              <select value={selected.difficulty || 1} onChange={(event) => updateQuestion(selectedIndex, { difficulty: Number(event.target.value) })} className={fieldClass}>
                <option value={1}>1 · Recordar</option>
                <option value={2}>2 · Aplicar</option>
                <option value={3}>3 · Analizar</option>
              </select>
            </label>
          </div>

          <label className="space-y-1.5">
            <span className={labelClass}>Enunciado</span>
            <textarea value={selected.question || ""} onChange={(event) => updateQuestion(selectedIndex, { question: event.target.value })} rows={3} className={`${fieldClass} resize-y`} />
          </label>

          <div className="space-y-2">
            <span className={labelClass}>Alternativas</span>
            {options.map((option: string, optionIndex: number) => (
              <div key={optionIndex} className="flex items-center gap-2">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-soft bg-card-theme text-[10px] font-black text-muted2">{String.fromCharCode(65 + optionIndex)}</span>
                <input value={option} onChange={(event) => updateQuestion(selectedIndex, { options: options.map((current: string, currentIndex: number) => currentIndex === optionIndex ? event.target.value : current) })} className={fieldClass} />
              </div>
            ))}
          </div>

          <label className="space-y-1.5">
            <span className={labelClass}>Respuesta correcta</span>
            <select value={Math.min(Number(selected.correctAnswer) || 0, Math.max(0, options.length - 1))} onChange={(event) => updateQuestion(selectedIndex, { correctAnswer: Number(event.target.value) })} className={fieldClass}>
              {options.map((option: string, optionIndex: number) => <option key={optionIndex} value={optionIndex}>{String.fromCharCode(65 + optionIndex)} · {option || "Sin texto"}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className={labelClass}>Retroalimentación</span>
            <textarea value={selected.explanation || ""} onChange={(event) => updateQuestion(selectedIndex, { explanation: event.target.value })} rows={4} className={`${fieldClass} resize-y`} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Pistas de distractores · una por línea</span>
            <textarea value={Array.isArray(selected.distractorHints) ? selected.distractorHints.join("\n") : ""} onChange={(event) => updateQuestion(selectedIndex, { distractorHints: event.target.value.split("\n") })} rows={3} className={`${fieldClass} resize-y`} />
          </label>
        </div>
      )}
    </div>
  )
}
