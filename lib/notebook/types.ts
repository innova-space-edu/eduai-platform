// lib/notebook/types.ts
// Tipos centrales del Notebook Hub

export type Notebook = {
  id: string
  user_id: string
  title: string
  specialist_role: string
  description?: string | null
  created_at: string
  updated_at: string
  // Joined
  source_count?: number
  message_count?: number
}

export type NotebookSourceType =
  | "url"
  | "pdf"
  | "docx"
  | "txt"
  | "text"
  | "search_result"

export type NotebookSourceStatus =
  | "pending"
  | "processing"
  | "ready"
  | "error"

export type NotebookSource = {
  id: string
  notebook_id: string
  type: NotebookSourceType
  title?: string | null
  url?: string | null
  file_path?: string | null
  raw_text?: string | null
  extracted_text?: string | null
  metadata?: Record<string, unknown>
  is_active: boolean
  status: NotebookSourceStatus
  error_message?: string | null
  created_at: string
}

export type NotebookChunk = {
  id: string
  notebook_id: string
  source_id: string
  chunk_index: number
  chunk_text: string
  token_count?: number | null
  metadata?: Record<string, unknown>
  created_at: string
  // Retrieval score (no en DB, solo en queries)
  score?: number
}

export type NotebookSummary = {
  id: string
  notebook_id: string
  summary_markdown?: string | null
  key_points: string[]
  glossary_json: Array<{ term: string; definition: string }>
  topics: string[]
  updated_at: string
}

export type NotebookMessage = {
  id: string
  notebook_id: string
  role: "user" | "assistant" | "system"
  content: string
  citations_json: NotebookCitation[]
  created_at: string
}

export type NotebookCitation = {
  sourceId: string
  sourceTitle?: string
  chunkId?: string
  snippet?: string
}

export type NotebookOutputFormat =
  | "infographic"
  | "mindmap"
  | "presentation"
  | "quiz"
  | "flashcards"
  | "timeline"
  | "podcast"
  | "cornell"
  | "glossary"
  | "story"
  | "lessonplan"

export type NotebookOutput = {
  id: string
  notebook_id: string
  format: NotebookOutputFormat
  title?: string | null
  output_json: Record<string, unknown>
  version: number
  created_at: string
  updated_at: string
}

// ─── Context Bundle para agentes ───────────────────────────────────────────

export type NotebookContextBundle = {
  notebookId: string
  title: string
  specialistRole: string
  summary?: string
  keyPoints: string[]
  glossary: Array<{ term: string; definition: string }>
  topics: string[]
  sourceIds: string[]
  chunks: Array<{
    sourceId: string
    chunkId: string
    text: string
    score?: number
  }>
}

// ─── Infografía ─────────────────────────────────────────────────────────────

export type InfographicDoc = {
  title: string
  subtitle?: string
  intro?: string
  heroStat?: { label: string; value: string; unit?: string }
  stats: Array<{ label: string; value: string; note?: string }>
  sections: Array<{
    title: string
    text: string
    bullets?: string[]
    imagePrompt?: string
  }>
  highlights?: string[]
  callouts?: Array<{ text: string }>
  timeline?: Array<{ label: string; description: string }>
  sourcesUsed: string[]
}

// ─── Mapa Mental ─────────────────────────────────────────────────────────────

export type MindMapNode = {
  id: string
  label: string
  description?: string
  children?: MindMapNode[]
  collapsed?: boolean
  metadata?: {
    sourceIds?: string[]
    summary?: string
  }
}

// ─── Web search ──────────────────────────────────────────────────────────────

export type WebSearchResult = {
  title: string
  url: string
  snippet: string
  source?: string
}
