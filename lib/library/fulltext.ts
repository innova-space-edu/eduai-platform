export type FullTextSourceId = "google-books" | "scielo" | "wikisource" | "wikibooks" | "openstax" | "open-textbook-library" | "memoria-chilena" | "open-book-publishers"

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
  licenseUrl?: string
  complete: boolean
  format: string
  coverUrl: string
  sourceUrl: string
  readerType: FullTextReaderType
  readerUrl?: string
  downloadUrl?: string
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
  "memoria-chilena": "Memoria Chilena",
  "open-book-publishers": "Open Book Publishers",
  wikisource: "Wikisource",
  wikibooks: "Wikibooks",
  openstax: "OpenStax",
  "open-textbook-library": "Open Textbook Library",
}
