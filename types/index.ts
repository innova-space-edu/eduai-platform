export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  level: number
  xp: number
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  topic: string
  status: "active" | "completed" | "paused"
  current_level: number
  score: number
  created_at: string
  updated_at: string
}

export interface AgentMessage {
  agent: string
  type: "theory" | "example" | "question" | "feedback" | "visual"
  content: string
  metadata?: Record<string, unknown>
}

export interface Question {
  id: string
  type: "multiple_choice" | "true_false" | "fill_blank" | "application"
  question: string
  options?: string[]
  correct_answer: string
  explanation: string
  difficulty: 1 | 2 | 3 | 4 | 5 | 6
  bloom_level: "remember" | "understand" | "apply" | "analyze"
}

export interface Progress {
  user_id: string
  topic: string
  level: number
  correct_answers: number
  total_answers: number
  last_studied: string
  needs_review: boolean
}

export type StudyMode = "normal" | "socratic" | "feynman" | "exam" | "competitive"
