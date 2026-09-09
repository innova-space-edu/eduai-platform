export type FullTextSourceId = "google-books" | "scielo" | "wikisource" | "wikibooks" | "openstax" | "open-textbook-library"

export type FullTextReaderType = "google" | "pdf" | "wikimedia" | "external"

export type FullTextBook = {
  id: string
  title: string
  author: string
  sourceId: FullTextSourceId
  source: string
  description: string
  language: string
  year: string
  license: string
  complete: boolean
  format: string
  coverUrl: string
  sourceUrl: string
  readerType: FullTextReaderType
  readerUrl?: string
  wikiProject?: "wikisource" | "wikibooks"
  wikiTitle?: string
}

export type FullTextSearchResponse = {
  query: string
  books: FullTextBook[]
  sourceCounts: Partial<Record<FullTextSourceId, number>>
  failedSources: string[]
}

export const FULLTEXT_SOURCE_LABELS: Record<FullTextSourceId, string> = {
  "google-books": "Google Books",
  scielo: "SciELO Books",
  wikisource: "Wikisource",
  wikibooks: "Wikibooks",
  openstax: "OpenStax",
  "open-textbook-library": "Open Textbook Library",
}
