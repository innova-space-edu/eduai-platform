"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import QuizMode from "./QuizMode"
import QuizResults from "./QuizResults"
import { useStudySession } from "@/hooks/useStudySession"

interface Suggestion { id: number; title: string; description: string; emoji: string }
interface ChatMessage { role: "ai" | "user"; content: string }
interface StudyType { id: string; label: string; description: string; emoji: string }
interface QuizResult { question: string; userAnswer: string; correct: string; isCorrect: boolean; feedback: string }

interface Props { topic: string; subtopic: string | null; level: number }

const STUDY_TYPES: StudyType[] = [
  { id: "theory",    label: "Teoría",     description: "Explicación del concepto",    emoji: "📖" },
  { id: "examples",  label: "Ejemplos",   description: "Casos resueltos paso a paso", emoji: "🔢" },
  { id: "exercises", label: "Ejercicios", description: "Practica con problemas",      emoji: "✏️" },
  { id: "summary",   label: "Resumen",    description: "Puntos clave en poco tiempo", emoji: "⚡" },
]

function MathContent({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-lg max-w-none
      prose-headings:text-white prose-headings:font-bold prose-headings:text-left
      prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:border-gray-800 prose-h2:pb-2
      prose-h3:text-lg prose-h3:text-blue-300
      prose-p:text-gray-300 prose-p:leading-relaxed prose-p:text-justify
      prose-strong:text-white
      prose-code:text-blue-300 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
      prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800
      prose-ul:text-gray-300 prose-li:my-1
      prose-table:text-gray-300 prose-th:text-white prose-th:bg-gray-800">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default function StudyClient({ topic, subtopic, level }: Props) {
  const router = useRouter()

  const [step, setStep] = useState<"suggest" | "type" | "study" | "quiz" | "results">(
    subtopic ? "type" : "suggest"
  )
  const [selectedSubtopic, setSelectedSubtopic] = useState(subtopic || "")
  const [selectedType, setSelectedType] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [userInput, setUserInput] = useState("")
  const [suggestedFollowups, setSuggestedFollowups] = useState<string[]>([])
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  const [quizXP, setQuizXP] = useState(0)
  const { session, completeSession } = useStudySession(topic, selectedType || "normal")
  const [error, setError] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === "suggest") loadSuggestions()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streaming])

  async function loadSuggestions() {
    setLoadingSuggestions(true)
    try {
      const res = await fetch("/api/agents/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      })
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  function selectSubtopic(title: string) {
    setSelectedSubtopic(title)
    setStep("type")
  }

  function selectType(typeId: string) {
    setSelectedType(typeId)
    setStep("study")
    const typeLabel = STUDY_TYPES.find(t => t.id === typeId)?.label || typeId
    sendMessage(`Quiero aprender sobre "${selectedSubtopic}" — modo: ${typeLabel}`, [], true)
  }

  async function sendMessage(userText: string, history: ChatMessage[], isFirst = false) {
    const recentHistory = history.slice(-2)

    if (!isFirst) {
      setMessages(prev => [...prev, { role: "user", content: userText }])
    }

    setStreaming(true)
    setSuggestedFollowups([])
    setMessages(prev => [...prev, { role: "ai", content: "" }])

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedSubtopic || topic,
          studyType: selectedType,
          userMessage: userText,
          history: recentHistory,
          level,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value)

        const splitMarker = "\n---FOLLOWUPS---\n"
        let aiContent = buffer

        if (buffer.includes(splitMarker)) {
          const parts = buffer.split(splitMarker)
          aiContent = parts[0]
          try { setSuggestedFollowups(JSON.parse(parts[1])) } catch {}
        }

        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: "ai", content: aiContent }
          return updated
        })
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setStreaming(false)
    }
  }

  function handleUserSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userInput.trim() || streaming) return
    const text = userInput.trim()
    setUserInput("")
    sendMessage(text, messages)
  }

  function handleQuizFinish(results: QuizResult[], xp: number) {
    const correct = results.filter(r => r.isCorrect).length
    completeSession(correct, results.length, level, xp)
    setQuizResults(results)
    setQuizXP(xp)
    setStep("results")
  }

  // ── PASO 1: Sugerencias ───────────────────────────────────
  if (step === "suggest") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-2">¿Qué quieres aprender sobre</h2>
          <h3 className="text-3xl font-bold text-blue-400 mb-3">{topic}?</h3>
          <p className="text-gray-500 text-sm">Elige un subtema para una explicación más precisa</p>
        </div>

        {loadingSuggestions ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Preparando opciones...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((s) => (
                <button key={s.id} onClick={() => selectSubtopic(s.title)}
                  className="bg-gray-900 border border-gray-800 hover:border-blue-500 hover:bg-gray-800/80 rounded-2xl p-6 text-left transition-all group">
                  <div className="text-3xl mb-3">{s.emoji}</div>
                  <h4 className="text-white font-semibold text-lg mb-1 group-hover:text-blue-400 transition-colors">{s.title}</h4>
                  <p className="text-gray-500 text-sm">{s.description}</p>
                </button>
              ))}
            </div>
            <div className="text-center mt-8">
              <button onClick={() => selectSubtopic(topic)}
                className="text-gray-500 hover:text-gray-300 text-sm underline transition-colors">
                Estudiar "{topic}" de forma general →
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── PASO 2: Tipo de estudio ───────────────────────────────
  if (step === "type") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <p className="text-gray-500 text-sm mb-1">{topic} →</p>
          <h2 className="text-3xl font-bold text-white mb-2">{selectedSubtopic}</h2>
          <p className="text-gray-500 text-sm">¿Qué tipo de contenido quieres?</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STUDY_TYPES.map((t) => (
            <button key={t.id} onClick={() => selectType(t.id)}
              className="bg-gray-900 border border-gray-800 hover:border-blue-500 hover:bg-gray-800/80 rounded-2xl p-6 text-center transition-all group">
              <div className="text-4xl mb-3">{t.emoji}</div>
              <h4 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">{t.label}</h4>
              <p className="text-gray-500 text-xs">{t.description}</p>
            </button>
          ))}
        </div>
        <div className="text-center mt-8">
          <button onClick={() => setStep("suggest")}
            className="text-gray-600 hover:text-gray-400 text-sm underline transition-colors">
            ← Cambiar subtema
          </button>
        </div>
      </div>
    )
  }

  // ── PASO 3: Quiz ──────────────────────────────────────────
  if (step === "quiz") {
    return (
      <QuizMode
        topic={selectedSubtopic || topic}
        initialLevel={level}
        onFinish={handleQuizFinish}
        onExit={() => setStep("study")}
      />
    )
  }

  // ── PASO 4: Resultados ────────────────────────────────────
  if (step === "results") {
    return (
      <QuizResults
        topic={selectedSubtopic || topic}
        results={quizResults}
        xpEarned={quizXP}
        onStudyMore={() => setStep("study")}
        onRetry={() => setStep("quiz")}
      />
    )
  }

  // ── PASO 5: Conversación ──────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-6 py-6">

      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <button onClick={() => setStep("suggest")} className="hover:text-gray-400 transition-colors">{topic}</button>
          <span>→</span>
          <button onClick={() => setStep("type")} className="hover:text-gray-400 transition-colors">{selectedSubtopic}</button>
          <span>→</span>
          <span className="text-blue-400">{STUDY_TYPES.find(t => t.id === selectedType)?.label}</span>
        </div>

        {/* Botón Evalúame — aparece después de 3 mensajes */}
        {messages.length >= 1 && !streaming && (
          <button
            onClick={() => setStep("quiz")}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors"
          >
            🎯 Evalúame
          </button>
        )}
      </div>

      {/* Mensajes */}
      <div className="space-y-6 mb-6">
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "ai" ? (
              <div>
                <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-3">
                  <div className={`w-1.5 h-1.5 bg-blue-400 rounded-full ${streaming && i === messages.length - 1 ? "animate-pulse" : ""}`} />
                  <span className="text-blue-400 text-xs font-medium">AGT</span>
                </div>
                <MathContent content={msg.content} />
                {streaming && i === messages.length - 1 && (
                  <span className="inline-block w-0.5 h-5 bg-blue-400 animate-pulse ml-1 align-middle" />
                )}
              </div>
            ) : (
              <div className="flex justify-end">
                <div className="bg-blue-600/20 border border-blue-600/30 rounded-2xl rounded-tr-sm px-4 py-3 max-w-lg">
                  <p className="text-gray-200 text-sm text-left">{msg.content}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sugerencias followup */}
      {!streaming && suggestedFollowups.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-600 mb-2">Sugerencias:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedFollowups.map((f, i) => (
              <button key={i} onClick={() => sendMessage(f, messages)}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 text-gray-300 hover:text-white text-sm px-4 py-2 rounded-full transition-all">
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Input */}
      {!streaming && messages.length > 0 && (
        <form onSubmit={handleUserSubmit} className="flex gap-3 sticky bottom-6">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Escribe tu pregunta o duda..."
            className="flex-1 bg-gray-900 border border-gray-700 focus:border-blue-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors text-sm"
          />
          <button type="submit" disabled={!userInput.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-5 py-3 rounded-xl transition-colors text-sm font-medium">
            Enviar →
          </button>
        </form>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
// Este archivo fue modificado - ver implementación completa
