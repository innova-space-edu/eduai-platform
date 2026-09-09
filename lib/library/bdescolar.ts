export const BDESCOLAR_HOME = "https://bdescolar.mineduc.cl/"
export const BDESCOLAR_HELP = "https://ayudamineduc.cl/ficha/biblioteca-digital-escolar"
export const BDESCOLAR_CRA = "https://bibliotecas-cra.cl/fomento-lector/biblioteca-digital-escolar/"
export const BDESCOLAR_APP_STORE = "https://apps.apple.com/cl/app/bdescolar/id1435884518"

function cleanSearch(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180)
}

export function buildBdescolarSearchUrl(value: string) {
  const query = cleanSearch(value)
  if (!query) return BDESCOLAR_HOME

  const params = new URLSearchParams({
    limit: "24",
    offset: "0",
    query: `allfields_txt:${query}`,
    order: "relevance:desc",
  })

  return `${BDESCOLAR_HOME}results?${params.toString()}`
}

export const BDESCOLAR_QUICK_SEARCHES = [
  { id: "audiobooks", label: "Audiolibros", query: "audiolibros" },
  { id: "literature", label: "Literatura", query: "literatura" },
  { id: "science", label: "Ciencias", query: "ciencias" },
  { id: "history", label: "Historia", query: "historia" },
  { id: "math", label: "Matemática", query: "matemática" },
  { id: "english", label: "Inglés", query: "inglés" },
] as const

export const BDESCOLAR_FEATURES = [
  {
    id: "ebooks",
    title: "Libros electrónicos",
    description: "Catálogo digital para lectura online y préstamo desde la plataforma oficial.",
  },
  {
    id: "audio",
    title: "Audiolibros",
    description: "Contenidos de audio disponibles según el perfil y la disponibilidad del catálogo.",
  },
  {
    id: "loans",
    title: "Préstamos y reservas",
    description: "Los préstamos, renovaciones, devoluciones y reservas se administran en la cuenta BDEscolar.",
  },
  {
    id: "streaming",
    title: "Lectura online",
    description: "Los títulos compatibles pueden abrirse en el lector web oficial sin copiar el contenido a EDUAI.",
  },
  {
    id: "accessibility",
    title: "Accesibilidad",
    description: "La plataforma oficial contempla texto a voz en EPUB y opciones de lectura como OpenDyslexic.",
  },
  {
    id: "mobile",
    title: "App y lectura móvil",
    description: "BDEscolar dispone de aplicación móvil y opciones de descarga/lectura compatibles con sus licencias.",
  },
] as const
