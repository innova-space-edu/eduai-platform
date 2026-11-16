"use client"

import { useEffect, useState, useRef } from "react"
import MathRenderer from "@/components/ui/MathRenderer"
import QuizMode from "./QuizMode"
import QuizResults from "./QuizResults"
import { useStudySession, type StudySession } from "@/hooks/useStudySession"
import VoiceNarrator from "@/components/ui/VoiceNarrator"
import SummaryDownload from "./SummaryDownload"
import VisualBlock from "./VisualBlock"

// ── Tipos IDÉNTICOS al original ───────────────────────────────────────────────
interface Suggestion  { id: number; title: string; description: string; emoji: string }
interface ChatMessage { role: "ai" | "user"; content: string }
interface StudyType   { id: string; label: string; description: string; emoji: string }
interface QuizResult  { question: string; userAnswer: string; correct: string; isCorrect: boolean; feedback: string }
interface Props { topic: string; subtopic: string | null; initialSession: StudySession | null }

const STUDY_TYPES: StudyType[] = [
  { id: "theory",    label: "Teoría",     description: "Explicación del concepto",        emoji: "📖" },
  { id: "examples",  label: "Ejemplos",   description: "Casos resueltos paso a paso",     emoji: "🔢" },
  { id: "exercises", label: "Ejercicios", description: "Practica con problemas",          emoji: "✏️" },
  { id: "summary",   label: "Resumen",    description: "Puntos clave en poco tiempo",     emoji: "⚡" },
  { id: "socratic",  label: "Sócrates",   description: "Descubre la respuesta tú mismo",  emoji: "🏛️" },
]

export default function StudyClient({ topic, subtopic, initialSession }: Props) {
  const restored = Array.isArray(initialSession?.messages) ? initialSession.messages.filter(m => m && ["ai", "user"].includes(m.role) && typeof m.content === "string") : []
  const initialMode = initialSession?.study_mode && STUDY_TYPES.some(t => t.id === initialSession.study_mode) ? initialSession.study_mode : ""
  const profileLabels: Record<string, string> = {personal:"Aprendizaje personal",school:"Escolar",university:"Universitario",teacher:"Docente",professional:"Profesional",languages:"Idiomas",certification:"Certificaciones"}
  const profile = initialSession?.study_profile || "personal"
  const learningContext = { profile, objective: initialSession?.objective || "", area: initialSession?.area || "" }
  const difficulty = ["university", "teacher", "professional", "certification"].includes(profile) ? 4 : 2

  // ── State IDÉNTICO al original ────────────────────────────────────────────
  const [step,               setStep]               = useState<"suggest"|"type"|"study"|"quiz"|"results">(restored.length ? "study" : subtopic ? "type" : "suggest")
  const [selectedSubtopic,   setSelectedSubtopic]   = useState(subtopic || (restored.length ? topic : ""))
  const [selectedType,       setSelectedType]       = useState(initialMode || (restored.length ? "theory" : ""))
  const [suggestions,        setSuggestions]        = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [messages,           setMessages]           = useState<ChatMessage[]>(restored)
  const [streaming,          setStreaming]          = useState(false)
  const [userInput,          setUserInput]          = useState("")
  const [suggestedFollowups, setSuggestedFollowups] = useState<string[]>([])
  const [quizResults,        setQuizResults]        = useState<QuizResult[]>([])
  const [error,              setError]              = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const { session, updateSession, completeSession, saving, saveError } = useStudySession(topic, selectedType || "normal", initialSession)
  const durationRef = useRef(initialSession?.duration_seconds || 0)
  const lastSaved = useRef(JSON.stringify(restored))
  const [finished, setFinished] = useState(initialSession?.status === "completed")
  const [studyNotice, setStudyNotice] = useState("")

  useEffect(() => { if (step === "suggest") void loadSuggestions() }, [step])
  useEffect(() => { if (messages.length) bottomRef.current?.scrollIntoView({ behavior: "auto" }) }, [messages, streaming])
  useEffect(() => {
    if (streaming || !messages.length) return
    const clean = messages.filter(m => m.content.trim())
    const serialized = JSON.stringify(clean)
    if (serialized === lastSaved.current) return
    const timer = window.setTimeout(() => {
      void updateSession({ messages: clean, study_mode: selectedType || "theory", subtopic: selectedSubtopic || topic, duration_seconds: durationRef.current }).then(ok => { if (ok) lastSaved.current = serialized })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [messages, streaming, selectedType, selectedSubtopic, topic, updateSession])
  useEffect(() => {
    if (!session?.id || (step !== "study" && step !== "quiz") || finished) return
    let last = Date.now(), pending = 0
    const timer = window.setInterval(() => {
      const now = Date.now()
      if (document.visibilityState === "visible" && document.hasFocus()) {
        const delta = Math.min(5, Math.max(0, Math.round((now-last)/1000)))
        durationRef.current += delta; pending += delta
        if (pending >= 30) { pending = 0; void updateSession({ duration_seconds: durationRef.current }) }
      }
      last = now
    }, 5000)
    return () => { window.clearInterval(timer); if (pending > 0) void updateSession({ duration_seconds: durationRef.current }) }
  }, [session?.id, step, finished, updateSession])
  async function finishStudy() {
    const ok = await updateSession({status:"completed", messages:messages.filter(m=>m.content.trim()), duration_seconds:durationRef.current})
    if (ok) { setFinished(true); setStudyNotice("Sesión completada y guardada. Puedes volver a revisarla cuando quieras.") }
  }

  // ── Toda la lógica IDÉNTICA al original ──────────────────────────────────
  async function loadSuggestions() {
    setLoadingSuggestions(true)
    try {
      const res  = await fetch("/api/agents/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, learningContext }),
      })
      if (!res.ok) throw Error("No se pudieron sugerir temas. Puedes escribir tu propio subtema.")
      const data = await res.json()
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch (e: any) { setError(e.message) }
    finally { setLoadingSuggestions(false) }
  }

  function selectSubtopic(title: string) {
    setSelectedSubtopic(title); setStep("type")
  }

  function selectType(typeId: string) {
    setSelectedType(typeId); setStep("study"); setFinished(false); setStudyNotice("")
    const typeLabel = STUDY_TYPES.find(t => t.id === typeId)?.label || typeId
    void updateSession({ study_mode:typeId, subtopic:selectedSubtopic || topic, status:"active" })
    void sendMessage(`Quiero aprender sobre "${selectedSubtopic || topic}" — modo: ${typeLabel}`, messages, false, typeId)
  }

  async function sendMessage(userText: string, history: ChatMessage[], isFirst = false, mode = selectedType) {
    setError("")
    const recentHistory = history.slice(-2)
    if (!isFirst) setMessages(prev => [...prev, { role: "user", content: userText }])
    setStreaming(true); setSuggestedFollowups([])
    setMessages(prev => [...prev, { role: "ai", content: "" }])
    try {
      const isSocratic = mode === "socratic"
      const res = await fetch(isSocratic ? "/api/agents/socratic" : "/api/agents/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedSubtopic || topic, studyType: mode,
          userMessage: userText, history: recentHistory, level: difficulty, learningContext,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const reader  = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buffer += decoder.decode(value, {stream:true})
        const splitMarker = "\n---FOLLOWUPS---\n"
        let aiContent = buffer
        if (buffer.includes(splitMarker)) {
          const parts = buffer.split(splitMarker); aiContent = parts[0]
          try { setSuggestedFollowups(JSON.parse(parts[1])) } catch {}
        }
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: "ai", content: aiContent }
          return updated
        })
      }

    } catch (e: any) { setError(e.message); setMessages(prev=>prev.filter(m=>m.content.trim())) }
    finally { setStreaming(false) }
  }

  function handleUserSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userInput.trim() || streaming) return
    const text = userInput.trim(); setUserInput("")
    sendMessage(text, messages)
  }

  async function handleQuizFinish(results: QuizResult[]) {
    setQuizResults(results); setStep("results")
    const correct=results.filter(r=>r.isCorrect).length
    const ok=await completeSession(correct,results.length,messages.filter(m=>m.content.trim()))
    if (ok) setFinished(true)
    if (!results.length) return
    const score=Math.round(correct/results.length*100)
    fetch("/api/memory",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:selectedSubtopic||topic,messages,quizResults:results})}).catch(console.error)
    fetch("/api/spaced-repetition",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:selectedSubtopic||topic,score})}).catch(console.error)
  }

  // ── PASO 1: Sugerencias ───────────────────────────────────────────────────
  if (step === "suggest") {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-main mb-2">¿Qué quieres aprender sobre</h2>
          <h3 className="text-3xl font-bold text-blue-400 mb-3">{topic}?</h3>
          <p className="text-muted2 text-sm">Elige un subtema para una explicación más precisa</p>
          <p className="mt-3 inline-flex rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600">{profileLabels[profile] || profileLabels.personal}</p>
          {learningContext.objective && <p className="mx-auto mt-2 max-w-xl text-sm text-muted2">Objetivo: {learningContext.objective}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {loadingSuggestions ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="w-10 h-10 rounded-full border-2 border-soft border-t-blue-400 animate-spin" />
            <p className="text-muted2 text-sm">Preparando opciones...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map(s => (
                <button key={s.id} onClick={() => selectSubtopic(s.title)}
                  className="rounded-3xl p-5 text-left transition-all group border shadow-sm"
                  style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLElement).style.background   = "rgba(59,130,246,0.06)"
                    ;(e.currentTarget as HTMLElement).style.borderColor  = "rgba(59,130,246,0.2)"
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLElement).style.background   = "var(--bg-card-soft)"
                    ;(e.currentTarget as HTMLElement).style.borderColor  = "var(--bg-card-soft)"
                  }}>
                  <div className="text-3xl mb-3">{s.emoji}</div>
                  <h4 className="text-main font-semibold text-lg mb-1 group-hover:text-blue-400 transition-colors">{s.title}</h4>
                  <p className="text-muted2 text-sm">{s.description}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 relative">
              <input
                type="text"
                placeholder="O escribe tu propio subtema..."
                className="w-full rounded-xl px-4 py-3 text-main placeholder-gray-400 focus:outline-none transition-all text-sm"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)" }}
                onFocus={e  => (e.target as HTMLElement).style.borderColor = "rgba(59,130,246,0.4)"}
                onBlur={e   => (e.target as HTMLElement).style.borderColor = "var(--border-soft)"}
                onKeyDown={e => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) selectSubtopic(e.currentTarget.value.trim())
                }}
              />
              <span className="absolute right-4 top-3.5 text-muted2 text-xs">Enter ↵</span>
            </div>

            <div className="text-center mt-4">
              <button onClick={() => selectSubtopic(topic)}
                className="text-muted2 hover:text-sub text-sm underline transition-colors">
                Estudiar "{topic}" de forma general →
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── PASO 2: Tipo de estudio ───────────────────────────────────────────────
  if (step === "type") {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center mb-6">
          <p className="text-muted2 text-sm mb-1">{topic} →</p>
          <h2 className="text-3xl font-bold text-main mb-2">{selectedSubtopic}</h2>
          <p className="text-muted2 text-sm">¿Qué tipo de contenido quieres?</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {STUDY_TYPES.map(t => (
            <button key={t.id} onClick={() => selectType(t.id)}
              className="rounded-3xl p-4 text-center transition-all group border shadow-sm"
              style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.background   = "rgba(59,130,246,0.06)"
                ;(e.currentTarget as HTMLElement).style.borderColor  = "rgba(59,130,246,0.2)"
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.background   = "var(--bg-card-soft)"
                ;(e.currentTarget as HTMLElement).style.borderColor  = "var(--bg-card-soft)"
              }}>
              <div className="text-4xl mb-3">{t.emoji}</div>
              <h4 className="text-main font-semibold mb-1 group-hover:text-blue-400 transition-colors">{t.label}</h4>
              <p className="text-muted2 text-xs">{t.description}</p>
            </button>
          ))}
        </div>

        <div className="text-center mt-8">
          <button onClick={() => setStep("suggest")}
            className="text-muted2 hover:text-sub text-sm underline transition-colors">
            ← Cambiar subtema
          </button>
        </div>
      </div>
    )
  }

  // ── PASO 3: Quiz ──────────────────────────────────────────────────────────
  if (step === "quiz") {
    return (
      <>
        <QuizMode
          topic={selectedSubtopic || topic}
          initialLevel={difficulty}
          learningContext={learningContext}
          onFinish={handleQuizFinish}
          onExit={() => setStep("study")}
        />
      </>
    )
  }

  // ── PASO 4: Resultados ────────────────────────────────────────────────────
  if (step === "results") {
    return (
      <QuizResults
        topic={selectedSubtopic || topic}
        results={quizResults}
        onStudyMore={() => setStep("study")}
        onRetry={() => setStep("quiz")}
      />
    )
  }

  // ── PASO 5: Conversación ──────────────────────────────────────────────────
  return (
    <>
      <div className="max-w-4xl mx-auto px-6 py-6">

        <div className="mb-5 rounded-3xl border border-violet-400/20 bg-card-theme p-4 shadow-sm" style={{backgroundImage:"linear-gradient(115deg,rgba(167,139,250,.13),rgba(96,165,250,.07),rgba(45,212,191,.10))"}}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0"><p className="text-xs font-semibold text-violet-600">{profileLabels[profile] || profileLabels.personal}</p><h2 className="text-lg font-bold">{selectedSubtopic || topic}</h2><p className="text-xs text-muted2">{STUDY_TYPES.find(t=>t.id===selectedType)?.label || "Estudio libre"} · {saving?"Guardando…":saveError?"Error de guardado":finished?"Completada":"En curso"}</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setStep("type")} className="rounded-xl border border-soft bg-card-theme px-3 py-2 text-xs font-semibold">Cambiar modo</button>{messages.length>0&&!streaming&&<button type="button" onClick={()=>setStep("quiz")} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white">Comprobar comprensión</button>}{!finished&&!streaming&&<button type="button" onClick={()=>void finishStudy()} className="rounded-xl border border-violet-400/30 bg-card-theme px-3 py-2 text-xs font-semibold">Finalizar sesión</button>}</div>
          </div>
          {learningContext.objective&&<p className="mt-2 text-sm text-muted2">Objetivo: {learningContext.objective}</p>}
          {studyNotice&&<p role="status" className="mt-2 text-sm text-emerald-700">{studyNotice}</p>}
          {saveError&&<p role="alert" className="mt-2 text-sm text-red-600">{saveError} <button type="button" className="underline" onClick={()=>void updateSession({messages:messages.filter(m=>m.content.trim()),duration_seconds:durationRef.current,study_mode:selectedType||"theory",subtopic:selectedSubtopic||topic})}>Reintentar guardado</button></p>}
        </div>

        {/* Mensajes */}
        <div className="space-y-6 mb-6">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "ai" ? (
                <div>
                  <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-3">
                    <div className={`w-1.5 h-1.5 bg-blue-400 rounded-full ${streaming && i === messages.length - 1 ? "animate-pulse" : ""}`} />
                    <span className="text-blue-400 text-xs font-medium">{selectedType === "socratic" ? "ASc — Modo Sócrates" : "AGT"}</span>
                  </div>
                  <MathRenderer content={msg.content} />
                  {!streaming && i === messages.length - 1 && msg.role === "ai" && msg.content && (
                    <VisualBlock topic={selectedSubtopic || topic} context={msg.content} />
                  )}
                  {!streaming && msg.content && (
                    <VoiceNarrator text={msg.content} autoPlay={false} addMotivation={false} />
                  )}
                  {streaming && i === messages.length - 1 && (
                    <span className="inline-block w-0.5 h-5 bg-blue-400 animate-pulse ml-1 align-middle" />
                  )}
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="chat-bubble-user max-w-lg">
                    <p className="text-main text-sm text-left">{msg.content}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Sugerencias followup */}
        {!streaming && suggestedFollowups.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted2 mb-2">Sugerencias:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedFollowups.map((f, i) => (
                <button key={i} onClick={() => sendMessage(f, messages)}
                  className="text-sm px-4 py-2 rounded-full transition-all"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)", color: "var(--text-secondary)" }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLElement).style.background   = "rgba(59,130,246,0.08)"
                    ;(e.currentTarget as HTMLElement).style.borderColor  = "rgba(59,130,246,0.2)"
                    ;(e.currentTarget as HTMLElement).style.color        = "#fff"
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLElement).style.background   = "var(--bg-input)"
                    ;(e.currentTarget as HTMLElement).style.borderColor  = "var(--border-soft)"
                    ;(e.currentTarget as HTMLElement).style.color        = "var(--text-secondary)"
                  }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        <SummaryDownload topic={selectedSubtopic || topic} messages={messages} quizResults={quizResults} />

        {error && (
          <div className="rounded-xl p-4 mb-4 border border-red-500/25" style={{ background: "rgba(239,68,68,0.08)" }}>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Input */}
        {!streaming && (
          <form onSubmit={handleUserSubmit} className="flex gap-3 sticky bottom-6">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder="Escribe tu pregunta o duda..."
              className="flex-1 rounded-xl px-4 py-3 text-main placeholder-gray-400 focus:outline-none transition-all text-sm"
              style={{ background: "var(--border-soft)", border: "1px solid var(--border-medium)" }}
              onFocus={e => (e.target as HTMLElement).style.borderColor = "rgba(59,130,246,0.4)"}
              onBlur={e  => (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)"}
            />
            <button type="submit" disabled={!userInput.trim()}
              className="px-5 py-3 rounded-xl text-sm font-medium text-main transition-all disabled:opacity-40"
              style={{ background: "#2563eb" }}>
              Enviar →
            </button>
          </form>
        )}

        <div ref={bottomRef} />
      </div>
    </>
  )
}
