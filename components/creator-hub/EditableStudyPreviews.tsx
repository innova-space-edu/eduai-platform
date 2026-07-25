"use client"

export function EditableFlashcardPreview({ data, index, showBack }: { data: any; index: number; showBack: boolean }) {
  const cards = Array.isArray(data?.cards) ? data.cards : []
  const card = cards[index]
  if (!card) return <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-soft text-sm text-muted2">No hay tarjetas</div>

  const accent = data?._design?.palette?.primary || "#06b6d4"

  return (
    <article className="relative flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-white/10" style={{ background: "linear-gradient(145deg,#07141c,#0b2430 55%,#111827)" }}>
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(ellipse at 85% 10%,${accent},transparent 45%),radial-gradient(ellipse at 15% 85%,${accent}88,transparent 40%)` }} />
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>{showBack ? "Reverso" : "Frente"}</p>
          <p className="mt-1 text-xs font-semibold text-slate-300">{data?.deckTitle || "Flashcards EduAI"}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-bold text-slate-400">{index + 1} / {cards.length}</span>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 py-10 text-center">
        <span className="mb-5 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{ borderColor: `${accent}45`, background: `${accent}18`, color: accent }}>Nivel {card.difficulty || 1}</span>
        <h1 className="max-w-4xl text-2xl font-black leading-relaxed text-white">{showBack ? card.back : card.front}</h1>
        {!showBack && card.hint && <p className="mt-6 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm italic leading-relaxed text-slate-400">Pista: {card.hint}</p>}
        {showBack && card.mnemonic && <p className="mt-6 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-slate-300">💡 {card.mnemonic}</p>}
      </div>

      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-6 pb-5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
        <span>{data?.topic || "Estudio"}</span>
        <span>{Array.isArray(card.tags) ? card.tags.join(" · ") : "EduAI Creator Studio"}</span>
      </footer>
    </article>
  )
}

export function EditableQuizQuestionPreview({ data, index, showSolution }: { data: any; index: number; showSolution: boolean }) {
  const questions = Array.isArray(data?.questions) ? data.questions : []
  const question = questions[index]
  if (!question) return <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-soft text-sm text-muted2">No hay preguntas</div>

  const accent = data?._design?.palette?.primary || "#22c55e"
  const options = Array.isArray(question.options) ? question.options : []
  const correct = Math.min(Number(question.correctAnswer) || 0, Math.max(0, options.length - 1))

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10" style={{ background: "linear-gradient(145deg,#07150d,#0d2416 58%,#111827)" }}>
      <header className="border-b border-white/10 px-6 py-5" style={{ background: `${accent}10` }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>{data?.title || "Quiz EduAI"}</p>
            <p className="mt-1 text-xs text-slate-400">{data?.topic || "Evaluación"}</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-bold text-slate-400">{index + 1} / {questions.length}</span>
        </div>
      </header>

      <div className="space-y-5 px-6 py-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase" style={{ background: `${accent}18`, color: accent }}>{question.type || "multiple_choice"}</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-400">Dificultad {question.difficulty || 1}</span>
        </div>

        <h1 className="text-xl font-black leading-relaxed text-white">{question.question}</h1>

        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option: string, optionIndex: number) => {
            const isCorrect = showSolution && optionIndex === correct
            return (
              <div key={optionIndex} className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: isCorrect ? `${accent}66` : "rgba(255,255,255,0.10)", background: isCorrect ? `${accent}16` : "rgba(255,255,255,0.035)" }}>
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black" style={{ background: isCorrect ? accent : "rgba(255,255,255,0.08)", color: isCorrect ? "white" : "#94a3b8" }}>{String.fromCharCode(65 + optionIndex)}</span>
                <p className="text-sm leading-relaxed" style={{ color: isCorrect ? "#f8fafc" : "#cbd5e1" }}>{option}</p>
              </div>
            )
          })}
        </div>

        {showSolution && question.explanation && (
          <div className="rounded-2xl border px-4 py-4" style={{ borderColor: `${accent}40`, background: `${accent}10` }}>
            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: accent }}>Retroalimentación</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{question.explanation}</p>
          </div>
        )}
      </div>
    </article>
  )
}
