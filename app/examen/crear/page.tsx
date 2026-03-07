
"use client"

function MathText({ text }: { text: string }) {
  if (!text) return null
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g)
  return (
    <span>
      {parts.map((part, i) => {
        const isBlock = part.startsWith("$$") && part.endsWith("$$")
        const isInline = !isBlock && part.startsWith("$") && part.endsWith("$")
        if (isBlock || isInline) {
          const tex = isBlock ? part.slice(2, -2) : part.slice(1, -1)
          const html = tex
            .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "(<sup>$1</sup>&frasl;<sub>$2</sub>)")
            .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
            .replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\div/g, "÷")
            .replace(/\\leq/g, "≤").replace(/\\geq/g, "≥").replace(/\\neq/g, "≠").replace(/\\pm/g, "±")
            .replace(/\^(\{[^}]+\}|\w)/g, (_, p) => `<sup>${p.replace(/[{}]/g, "")}</sup>`)
            .replace(/_(\{[^}]+\}|\w)/g, (_, p) => `<sub>${p.replace(/[{}]/g, "")}</sub>`)
          return <span key={i} className={`text-blue-300 font-mono ${isBlock ? "block my-2 text-center text-base" : ""}`} dangerouslySetInnerHTML={{ __html: html }} />
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function CrearExamenPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<"config" | "generating" | "preview" | "published">("config")

  // Config
  const [topic, setTopic] = useState("")
  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [timeLimit, setTimeLimit] = useState(30)
  const [exigencia, setExigencia] = useState(60)
  const [showResult, setShowResult] = useState(true)
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed")

  // Question distribution
  const [mcCount, setMcCount] = useState(5)
  const [tfCount, setTfCount] = useState(3)
  const [devCount, setDevCount] = useState(2)

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

  const totalQuestions = mcCount + tfCount + devCount

  const generateExam = async () => {
    if (!topic.trim() || totalQuestions < 1) return
    setStep("generating")
    setError("")

    const diffText = difficulty === "easy" ? "nivel fácil, preguntas básicas de comprensión"
      : difficulty === "hard" ? "nivel difícil, preguntas de análisis, síntesis y evaluación"
      : difficulty === "medium" ? "nivel intermedio, preguntas de comprensión y aplicación"
      : "mezcla de niveles: fácil, intermedio y difícil"

    const prompt = `Genera un examen educativo sobre: "${topic}"

DISTRIBUCIÓN DE PREGUNTAS:
- ${mcCount} preguntas de ALTERNATIVAS (multiple_choice): 4 opciones A-D, solo 1 correcta
- ${tfCount} preguntas de VERDADERO O FALSO (true_false): opciones ["Verdadero", "Falso"]
- ${devCount} preguntas de DESARROLLO (development): respuesta abierta, incluye una "modelAnswer" (respuesta modelo) y "rubric" con criterios de evaluación

NIVEL DE DIFICULTAD: ${diffText}

IMPORTANTE para contenido matemático:
- Usa notación LaTeX entre $...$ para fórmulas inline
- Usa $$...$$ para fórmulas en bloque
- Ejemplo: $x^2 + 2x + 1 = (x+1)^2$
- Ejemplo: $\\frac{a}{b}$, $\\sqrt{x}$, $\\sum_{i=1}^{n}$

Responde SOLO con JSON válido:
{
  "title": "Título del examen",
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Pregunta con $LaTeX$ si aplica",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Explicación detallada de la respuesta correcta",
      "difficulty": 1
    },
    {
      "type": "true_false",
      "question": "Afirmación verdadera o falsa",
      "options": ["Verdadero", "Falso"],
      "correctAnswer": 0,
      "explanation": "Explicación",
      "difficulty": 2
    },
    {
      "type": "development",
      "question": "Pregunta de desarrollo",
      "modelAnswer": "Respuesta modelo completa y detallada",
      "rubric": [
        {"criteria": "Criterio 1", "points": 3},
        {"criteria": "Criterio 2", "points": 2}
      ],
      "maxPoints": 5,
      "difficulty": 3
    }
  ]
}

difficulty: 1=fácil, 2=medio, 3=difícil
Total: ${totalQuestions} preguntas (${mcCount} alternativas + ${tfCount} V/F + ${devCount} desarrollo)
Todo en español.`

    try {
      const res = await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "text", content: prompt, outputFormat: "quiz" }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      let qs = data.output?.data?.questions || []
      setQuestions(qs)
      setTitle(data.output?.data?.title || `Examen: ${topic}`)
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
          settings: {
            timeLimit,
            questionCount: questions.length,
            showResultToStudent: showResult,
            examPercentage: exigencia,
            difficulty,
            distribution: { mc: mcCount, tf: tfCount, dev: devCount },
          },
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

  const removeQuestion = (idx: number) => setQuestions(questions.filter((_, i) => i !== idx))

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
          <Link href="/examen/docente" className="text-gray-500 hover:text-white transition-colors">←</Link>
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
                placeholder="Ej: Fotosíntesis, Productos notables, Segunda Guerra Mundial..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/30" />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1.5">INSTRUCCIONES (opcional)</label>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                placeholder="Instrucciones adicionales para los estudiantes..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/30 min-h-[60px] resize-vertical" />
            </div>

            {/* Question distribution */}
            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-2">DISTRIBUCIÓN DE PREGUNTAS</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 text-center">
                  <p className="text-blue-400 text-lg font-bold mb-1">📋</p>
                  <p className="text-gray-400 text-[10px] font-semibold mb-2">Alternativas</p>
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setMcCount(Math.max(0, mcCount - 1))} className="w-7 h-7 rounded-lg bg-white/[0.06] text-gray-400 text-sm">-</button>
                    <span className="text-white font-bold text-lg w-6 text-center">{mcCount}</span>
                    <button onClick={() => setMcCount(Math.min(20, mcCount + 1))} className="w-7 h-7 rounded-lg bg-white/[0.06] text-gray-400 text-sm">+</button>
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 text-center">
                  <p className="text-green-400 text-lg font-bold mb-1">✓✗</p>
                  <p className="text-gray-400 text-[10px] font-semibold mb-2">Verdadero/Falso</p>
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setTfCount(Math.max(0, tfCount - 1))} className="w-7 h-7 rounded-lg bg-white/[0.06] text-gray-400 text-sm">-</button>
                    <span className="text-white font-bold text-lg w-6 text-center">{tfCount}</span>
                    <button onClick={() => setTfCount(Math.min(20, tfCount + 1))} className="w-7 h-7 rounded-lg bg-white/[0.06] text-gray-400 text-sm">+</button>
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 text-center">
                  <p className="text-orange-400 text-lg font-bold mb-1">✍️</p>
                  <p className="text-gray-400 text-[10px] font-semibold mb-2">Desarrollo</p>
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setDevCount(Math.max(0, devCount - 1))} className="w-7 h-7 rounded-lg bg-white/[0.06] text-gray-400 text-sm">-</button>
                    <span className="text-white font-bold text-lg w-6 text-center">{devCount}</span>
                    <button onClick={() => setDevCount(Math.min(10, devCount + 1))} className="w-7 h-7 rounded-lg bg-white/[0.06] text-gray-400 text-sm">+</button>
                  </div>
                </div>
              </div>
              <p className="text-center text-gray-500 text-xs mt-2">Total: {totalQuestions} preguntas</p>
            </div>

            {/* Difficulty */}
            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-2">DIFICULTAD</label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { id: "easy", label: "Fácil", color: "green" },
                  { id: "medium", label: "Medio", color: "yellow" },
                  { id: "hard", label: "Difícil", color: "red" },
                  { id: "mixed", label: "Mixto", color: "blue" },
                ] as const).map(d => (
                  <button key={d.id} onClick={() => setDifficulty(d.id)}
                    className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      difficulty === d.id
                        ? `bg-${d.color}-500/10 border-${d.color}-500/30 text-${d.color}-400`
                        : "border-white/[0.06] text-gray-500 hover:bg-white/[0.04]"
                    }`}
                    style={difficulty === d.id ? {
                      backgroundColor: d.color === "green" ? "rgba(34,197,94,0.1)" : d.color === "yellow" ? "rgba(234,179,8,0.1)" : d.color === "red" ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)",
                      borderColor: d.color === "green" ? "rgba(34,197,94,0.3)" : d.color === "yellow" ? "rgba(234,179,8,0.3)" : d.color === "red" ? "rgba(239,68,68,0.3)" : "rgba(59,130,246,0.3)",
                      color: d.color === "green" ? "#4ade80" : d.color === "yellow" ? "#facc15" : d.color === "red" ? "#f87171" : "#60a5fa",
                    } : {}}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time & Exigencia */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-1.5">TIEMPO LÍMITE</label>
                <select value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none">
                  {[15, 20, 30, 45, 60, 90, 120].map(n => (
                    <option key={n} value={n} className="bg-gray-900">{n} minutos</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-1.5">EXIGENCIA (4.0)</label>
                <select value={exigencia} onChange={e => setExigencia(Number(e.target.value))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none">
                  {[50, 55, 60, 65, 70].map(p => (
                    <option key={p} value={p} className="bg-gray-900">{p}%</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Show result toggle */}
            <div className="flex items-center justify-between bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
              <div>
                <p className="text-sm font-semibold text-gray-300">Mostrar nota y retroalimentación</p>
                <p className="text-xs text-gray-600">El estudiante verá su nota, errores y explicaciones al terminar</p>
              </div>
              <button onClick={() => setShowResult(!showResult)}
                className={`w-12 h-7 rounded-full transition-all relative ${showResult ? "bg-blue-500" : "bg-gray-700"}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${showResult ? "left-6" : "left-1"}`} />
              </button>
            </div>

            <button onClick={generateExam} disabled={!topic.trim() || totalQuestions < 1}
              className="w-full py-3.5 rounded-2xl bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-sm disabled:opacity-30 transition-all">
              🤖 Generar examen con IA ({totalQuestions} preguntas)
            </button>

            {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-xl p-3">❌ {error}</p>}
          </div>
        )}

        {/* ── GENERATING ── */}
        {step === "generating" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin mx-auto mb-4" />
            <h3 className="text-white font-bold mb-1">Generando examen...</h3>
            <p className="text-gray-600 text-sm">Creando {totalQuestions} preguntas sobre "{topic}"</p>
            <p className="text-gray-700 text-xs mt-2">{mcCount} alternativas + {tfCount} V/F + {devCount} desarrollo</p>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{title}</h2>
              <button onClick={() => setStep("config")} className="text-gray-500 text-xs hover:text-white">← Volver</button>
            </div>
            <p className="text-gray-500 text-sm">
              {questions.length} preguntas • {timeLimit} min • {exigencia}% exigencia • Dificultad: {difficulty}
            </p>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {questions.map((q: any, i: number) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 relative group">
                  <button onClick={() => removeQuestion(i)}
                    className="absolute top-2 right-2 text-gray-700 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      q.type === "multiple_choice" ? "bg-blue-500/10 text-blue-400" :
                      q.type === "true_false" ? "bg-green-500/10 text-green-400" :
                      "bg-orange-500/10 text-orange-400"
                    }`}>
                      {q.type === "multiple_choice" ? "Alternativas" : q.type === "true_false" ? "V/F" : "Desarrollo"}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      q.difficulty === 3 ? "text-red-400" : q.difficulty === 2 ? "text-yellow-400" : "text-green-400"
                    }`}>
                      {q.difficulty === 3 ? "Difícil" : q.difficulty === 2 ? "Medio" : "Fácil"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 mb-2">{i + 1}. {q.question}</p>
                  {q.type === "development" && q.modelAnswer && (
                    <div className="bg-orange-500/[0.05] rounded-lg p-2 border border-orange-500/10">
                      <p className="text-orange-400 text-[10px] font-semibold">Respuesta modelo:</p>
                      <p className="text-gray-400 text-xs"><MathText text={q.modelAnswer || ""} /></p>
                    </div>
                  )}
                  {q.type !== "development" && (
                    <div className="space-y-1">
                      {(q.options || []).map((opt: string, j: number) => (
                        <div key={j} className={`text-xs px-3 py-1.5 rounded-lg ${
                          j === q.correctAnswer ? "bg-green-500/10 text-green-400 border border-green-500/20" : "text-gray-500"
                        }`}>
                          {q.type === "true_false" ? "" : `${String.fromCharCode(65 + j)}) `}{opt} {j === q.correctAnswer && "✓"}
                        </div>
                      ))}
                    </div>
                  )}
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

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
              <p className="text-blue-400 text-sm font-mono break-all mb-3">{examUrl}</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => navigator.clipboard?.writeText(examUrl)}
                  className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                  📋 Copiar link
                </button>
                <button onClick={() => navigator.share?.({ title, url: examUrl })}
                  className="px-4 py-2 rounded-xl bg-green-600/20 border border-green-500/30 text-green-400 text-xs font-semibold">
                  📤 Compartir
                </button>
              </div>
            </div>

            <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
              <p className="text-gray-500 text-xs mb-1">CÓDIGO</p>
              <p className="text-3xl font-mono font-bold text-white tracking-widest">{examData.code}</p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Preguntas", value: questions.length },
                { label: "Tiempo", value: `${timeLimit}m` },
                { label: "Exigencia", value: `${exigencia}%` },
                { label: "Nivel", value: difficulty },
              ].map(s => (
                <div key={s.label} className="bg-white/[0.03] rounded-xl p-2.5 border border-white/[0.06]">
                  <p className="text-gray-600 text-[10px]">{s.label}</p>
                  <p className="text-white font-bold text-sm">{s.value}</p>
                </div>
              ))}
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
