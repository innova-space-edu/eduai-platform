// src/app/examen/crear/page.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function CrearExamenPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<"config" | "generating" | "preview" | "published">("config")
  const [topic, setTopic] = useState("")
  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [questionCount, setQuestionCount] = useState(10)
  const [timeLimit, setTimeLimit] = useState(30)
  const [showResult, setShowResult] = useState(true)
  const [exigencia, setExigencia] = useState(60)
  const [questions, setQuestions] = useState<any[]>([])
  const [examData, setExamData] = useState<any>(null)
  const [error, setError] = useState("")
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
      else setUser(user)
      setLoading(false)
    })
  }, [])

  const generateExam = async () => {
    if (!topic.trim()) return
    setStep("generating")
    setError("")

    try {
      const res = await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "topic",
          content: topic,
          outputFormat: "quiz",
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      const quizData = data.output.data
      let qs = quizData.questions || []
      if (qs.length > questionCount) qs = qs.slice(0, questionCount)

      setQuestions(qs)
      setTitle(quizData.title || `Examen: ${topic}`)
      setStep("preview")
    } catch (err: any) {
      setError(err.message)
      setStep("config")
    }
  }

  const publishExam = async () => {
    if (!user || questions.length === 0) return
    setError("")

    try {
      const res = await fetch("/api/agents/examen-docente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          teacherId: user.id,
          title,
          topic,
          instructions,
          questions,
          settings: { timeLimit, questionCount: questions.length, showResultToStudent: showResult, examPercentage: exigencia },
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      setExamData(data)
      setStep("published")
    } catch (err: any) {
      setError(err.message)
    }
  }

  const examUrl = examData ? `${window.location.origin}/examen/p/${examData.code}` : ""

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/examen" className="text-gray-500 hover:text-white transition-colors">←</Link>
          <div>
            <h1 className="text-xl font-bold text-white">📝 Crear Examen para Estudiantes</h1>
            <p className="text-gray-500 text-sm">La IA genera las preguntas, tú compartes el link</p>
          </div>
        </div>

        {/* ── CONFIG ── */}
        {step === "config" && (
          <div className="space-y-5">
            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1.5">TEMA DEL EXAMEN *</label>
              <input value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="Ej: Fotosíntesis, Segunda Guerra Mundial, Ecuaciones cuadráticas..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/30" />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1.5">INSTRUCCIONES (opcional)</label>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                placeholder="Instrucciones adicionales para los estudiantes..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/30 min-h-[60px] resize-vertical" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-1.5">PREGUNTAS</label>
                <select value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none">
                  {[5, 8, 10, 15, 20, 25, 30].map(n => (
                    <option key={n} value={n} className="bg-gray-900">{n} preguntas</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-1.5">TIEMPO LÍMITE</label>
                <select value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none">
                  {[15, 20, 30, 45, 60, 90, 120].map(n => (
                    <option key={n} value={n} className="bg-gray-900">{n} minutos</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1.5">EXIGENCIA PARA EL 4.0</label>
              <div className="flex gap-2">
                {[50, 60, 70].map(p => (
                  <button key={p} onClick={() => setExigencia(p)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                      exigencia === p ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "border-white/[0.06] text-gray-500 hover:bg-white/[0.04]"
                    }`}>{p}%</button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
              <div>
                <p className="text-sm font-semibold text-gray-300">Mostrar nota al alumno</p>
                <p className="text-xs text-gray-600">El estudiante verá su resultado al terminar</p>
              </div>
              <button onClick={() => setShowResult(!showResult)}
                className={`w-12 h-7 rounded-full transition-all relative ${showResult ? "bg-blue-500" : "bg-gray-700"}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${showResult ? "left-6" : "left-1"}`} />
              </button>
            </div>

            <button onClick={generateExam} disabled={!topic.trim()}
              className="w-full py-3.5 rounded-2xl bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-sm disabled:opacity-30 transition-all">
              🤖 Generar examen con IA
            </button>

            {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-xl p-3">❌ {error}</p>}
          </div>
        )}

        {/* ── GENERATING ── */}
        {step === "generating" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin mx-auto mb-4" />
            <h3 className="text-white font-bold mb-1">Generando examen...</h3>
            <p className="text-gray-600 text-sm">Creando {questionCount} preguntas sobre "{topic}"</p>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{title}</h2>
              <button onClick={() => setStep("config")} className="text-gray-500 text-xs hover:text-white">← Volver</button>
            </div>
            <p className="text-gray-500 text-sm">{questions.length} preguntas • {timeLimit} min • {exigencia}% exigencia</p>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {questions.map((q: any, i: number) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
                  <p className="text-sm font-semibold text-gray-200 mb-2">{i + 1}. {q.question}</p>
                  <div className="space-y-1">
                    {(q.options || []).map((opt: string, j: number) => (
                      <div key={j} className={`text-xs px-3 py-1.5 rounded-lg ${
                        j === q.correctAnswer ? "bg-green-500/10 text-green-400 border border-green-500/20" : "text-gray-500"
                      }`}>
                        {String.fromCharCode(65 + j)}) {opt} {j === q.correctAnswer && "✓"}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={generateExam} className="flex-1 py-3 rounded-2xl border border-white/10 text-gray-400 font-semibold text-sm hover:bg-white/[0.04]">
                🔄 Regenerar
              </button>
              <button onClick={publishExam}
                className="flex-1 py-3 rounded-2xl bg-green-600/90 hover:bg-green-500 text-white font-bold text-sm">
                ✅ Publicar examen
              </button>
            </div>

            {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-xl p-3">❌ {error}</p>}
          </div>
        )}

        {/* ── PUBLISHED ── */}
        {step === "published" && examData && (
          <div className="text-center space-y-6">
            <div className="text-5xl mb-2">🎉</div>
            <h2 className="text-xl font-bold text-white">¡Examen publicado!</h2>
            <p className="text-gray-500 text-sm">Comparte este link con tus estudiantes</p>

            {/* Link */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
              <p className="text-blue-400 text-sm font-mono break-all mb-3">{examUrl}</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => navigator.clipboard?.writeText(examUrl)}
                  className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-semibold hover:bg-blue-600/30">
                  📋 Copiar link
                </button>
                <button onClick={() => {
                  if (navigator.share) navigator.share({ title: title, url: examUrl })
                }}
                  className="px-4 py-2 rounded-xl bg-green-600/20 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-600/30">
                  📤 Compartir
                </button>
              </div>
            </div>

            {/* Código */}
            <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
              <p className="text-gray-500 text-xs mb-1">CÓDIGO DEL EXAMEN</p>
              <p className="text-3xl font-mono font-bold text-white tracking-widest">{examData.code}</p>
            </div>

            {/* Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                <p className="text-gray-600 text-xs">Preguntas</p>
                <p className="text-white font-bold">{questions.length}</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                <p className="text-gray-600 text-xs">Tiempo</p>
                <p className="text-white font-bold">{timeLimit} min</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                <p className="text-gray-600 text-xs">Exigencia</p>
                <p className="text-white font-bold">{exigencia}%</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href={`/examen/resultados/${examData.exam.id}`}
                className="flex-1 py-3 rounded-2xl bg-blue-600/90 text-white font-bold text-sm text-center">
                📊 Ver resultados
              </Link>
              <button onClick={() => { setStep("config"); setTopic(""); setQuestions([]) }}
                className="flex-1 py-3 rounded-2xl border border-white/10 text-gray-400 font-semibold text-sm">
                + Crear otro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
