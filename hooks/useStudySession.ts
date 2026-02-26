import { useState, useEffect, useRef } from "react"

interface StudySession {
  id: string
  topic: string
  status: string
  current_level: number
  score: number
  total_questions: number
  correct_answers: number
}

export function useStudySession(topic: string, studyMode = "normal") {
  const [session, setSession] = useState<StudySession | null>(null)
  const createdRef = useRef(false)

  useEffect(() => {
    if (createdRef.current || !topic) return
    createdRef.current = true
    createSession()
  }, [topic])

  async function createSession() {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, study_mode: studyMode }),
      })
      if (!res.ok) return
      const data = await res.json()
      setSession(data)
    } catch (e) {
      console.error("Error creating session:", e)
    }
  }

  async function updateSession(updates: Partial<StudySession>) {
    if (!session) return
    try {
      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id, ...updates }),
      })
      if (!res.ok) return
      const data = await res.json()
      setSession(data)
    } catch (e) {
      console.error("Error updating session:", e)
    }
  }

  async function completeSession(correct: number, total: number, level: number) {
    await updateSession({
      status: "completed",
      correct_answers: correct,
      total_questions: total,
      current_level: level,
      score: Math.round((correct / total) * 100),
    })
  }

  return { session, updateSession, completeSession }
}
