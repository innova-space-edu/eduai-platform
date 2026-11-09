import type { FullTextBook, FullTextSourceId } from "./fulltext"

function patrimonio(id: string, record: number, title: string, author: string, year: string, description: string): FullTextBook {
  const pdf = `https://www.memoriachilena.gob.cl/archivos2/pdfs/${id}.pdf`
  return {
    id, title, author, year, description,
    sourceId: "memoria-chilena",
    source: "Memoria Chilena · Biblioteca Nacional de Chile",
    sourceUrl: `https://www.memoriachilena.gob.cl/602/w3-article-${record}.html`,
    language: "es",
    license: "Patrimonio cultural común",
    complete: true,
    format: "PDF digitalizado",
    coverUrl: "",
    readerType: "pdf",
    readerUrl: pdf,
    downloadUrl: pdf,
  }
}

function openBook(doi: string, title: string, author: string, year: string, description: string): FullTextBook {
  const pdf = `https://books.openbookpublishers.com/${doi}.pdf`
  return {
    id: doi, title, author, year, description,
    sourceId: "open-book-publishers",
    source: "Open Book Publishers",
    sourceUrl: `https://www.openbookpublishers.com/books/${doi}`,
    language: "en",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    complete: true,
    format: "PDF",
    coverUrl: "",
    readerType: "pdf",
    readerUrl: pdf,
    downloadUrl: pdf,
  }
}

export const OPEN_EDITIONS: readonly FullTextBook[] = [
  patrimonio("MC0005166", 8007, "Sub terra: cuadros mineros", "Baldomero Lillo", "1904", "Cuentos chilenos sobre la vida minera. Literatura, historia del trabajo y educación."),
  patrimonio("MC0005165", 8006, "Sub sole", "Baldomero Lillo", "1907", "Cuentos chilenos. Narrativa, literatura y educación."),
  patrimonio("MC0005020", 7995, "Martín Rivas", "Alberto Blest Gana", "", "Novela chilena de formación. Literatura, sociedad y educación."),
  patrimonio("MC0076198", 631574, "Cuentos", "Pedro Nolasco Cruz", "1930", "Narrativa chilena con prólogo del autor. Literatura y educación."),
  patrimonio("MC0005035", 7999, "La Araucana", "Alonso de Ercilla y Zúñiga", "1574", "Edición histórica en español. Poesía épica, literatura e historia de Chile."),
  openBook("10.11647/obp.0168", "The Essence of Mathematics Through Elementary Problems", "Alexandre Borovik y Tony Gardiner", "2019", "Problemas y soluciones de aritmética, álgebra y geometría. Matemática y educación."),
  openBook("10.11647/obp.0071", "Teaching Mathematics at Secondary Level", "Tony Gardiner", "2016", "Enseñanza de la matemática en secundaria. Didáctica y educación."),
]

function searchWords(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || []
}

export function findOpenEditions(query: string, source?: FullTextSourceId) {
  const terms = searchWords(query)
  return OPEN_EDITIONS.filter((book) => {
    if (source && book.sourceId !== source) return false
    const haystack = searchWords([book.title, book.author, book.description, book.source].join(" ")).join(" ")
    return terms.every((term) => haystack.includes(term))
  })
}
