export type MineducAccessMode = "pdf" | "official"

export type MineducBook = {
  id: string
  title: string
  author: string
  year: string
  level: string
  subject: string
  kind: string
  source: "MINEDUC"
  coverUrl: string
  detailUrl: string
  pdfUrl?: string
  officialReaderUrl?: string
  access: MineducAccessMode
}

export type MineducCatalogResponse = {
  books: MineducBook[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  source: string
  catalogUrl: string
}
