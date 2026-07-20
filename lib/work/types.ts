import type { NotebookCitation, NotebookOutput, NotebookSource } from "@/lib/notebook/types"

export type WorkMode = "ask" | "research" | "create" | "collaborate" | "execute"

export type ResearchScope = "sources" | "sources_web" | "web"

export type WorkNotebookSummary = {
  id: string
  title: string
  specialist_role: string
  description?: string | null
  created_at: string
  updated_at: string
  notebook_sources?: Array<{ count: number }>
  notebook_messages?: Array<{ count: number }>
}

export type WorkCitation = NotebookCitation & {
  sourceUrl?: string | null
  sourceType?: string | null
}

export type WorkContextData = {
  sources: NotebookSource[]
  outputs: NotebookOutput[]
}

export type WorkTask = {
  id: string
  title: string
  completed: boolean
}
