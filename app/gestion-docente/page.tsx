import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

type Search = { page?: string | string[]; tipo?: string | string[] }
const PAGE_SIZE = 25
const kinds = ["examenes", "planificaciones", "documentos"] as const
type Kind = (typeof kinds)[number]
type Item = { id: string; title: string; detail: string; date: string | null }

function pageNumber(raw: Search["page"]) {
  if (typeof raw !== "string" || !/^\d{1,4}$/.test(raw)) return 1
  return Math.max(1, Math.min(400, Number(raw)))
}
function category(raw: Search["tipo"]): Kind {
  return kinds.find((kind) => kind === raw) ?? "examenes"
}
function dateLabel(date: string | null) {
  if (!date) return "Sin fecha"
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium", timeZone: "America/Santiago"
  }).format(d)
}
const labels: Record<Kind, string> = {
  examenes: "Evaluaciones",
  planificaciones: "Planificaciones",
  documentos: "Documentos",
}

export default async function GestionDocente({ searchParams }: { searchParams: Promise<Search> }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect("/login")
  const params = await searchParams
  const kind = category(params.tipo)
  const page = pageNumber(params.page)
  const from = (page - 1) * PAGE_SIZE
  // Extra row detects another page; no expensive exact counts, no personal data.
  const to = from + PAGE_SIZE
  let items: Item[] = []
  let failed = false
  if (kind === "examenes") {
    const result = await supabase.from("teacher_exams")
      .select("id,title,topic,status,updated_at,created_at")
      .eq("teacher_id", user.id).is("deleted_at", null)
      .order("created_at", { ascending: false }).order("id")
      .range(from, to)
    failed = Boolean(result.error)
    if (!failed) items = (result.data ?? []).map((r) => ({
      id: r.id, title: r.title || "Evaluación sin título",
      detail: [r.topic, r.status].filter(Boolean).join(" · "),
      date: r.updated_at || r.created_at,
    }))
  } else if (kind === "planificaciones") {
    const result = await supabase.from("saved_plannings")
      .select("id,title,course,subject,curso,asignatura,unidad_id,updated_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }).order("id")
      .range(from, to)
    failed = Boolean(result.error)
    if (!failed) items = (result.data ?? []).map((r) => ({
      id: r.id, title: r.title || "Planificación sin título",
      detail: [r.curso || r.course, r.asignatura || r.subject].filter(Boolean).join(" · "),
      date: r.updated_at || r.created_at,
    }))
  } else {
    const result = await supabase.from("eduai_assets")
      .select("id,title,asset_type,source_module,updated_at,created_at")
      .eq("owner_id", user.id).is("deleted_at", null)
      .order("created_at", { ascending: false }).order("id")
      .range(from, to)
    failed = Boolean(result.error)
    if (!failed) items = (result.data ?? []).map((r) => ({
      id: r.id, title: r.title || "Recurso sin título",
      detail: [r.asset_type, r.source_module].filter(Boolean).join(" · "),
      date: r.updated_at || r.created_at,
    }))
  }
  const hasMore = items.length > PAGE_SIZE
  const href = (type: Kind, p: number) => `/gestion-docente?tipo=${type}&page=${p}`

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <header className="space-y-2">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">← Volver al panel</Link>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">EDUAI · Gestión docente</p>
        <h1 className="text-3xl font-semibold tracking-tight">Mi actividad docente</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Consulta los recursos que has creado. Este inventario es personal; el libro de calificaciones institucional y las integraciones requieren autorización adicional.</p>
      </header>
      <nav aria-label="Categorías" className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <Link key={k} href={href(k, 1)} aria-current={kind === k ? "page" : undefined}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${kind === k ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
            {labels[k]}
          </Link>
        ))}
      </nav>
      <section className="overflow-hidden rounded-xl border bg-card" aria-label={labels[kind]}>
        <div className="border-b p-4"><h2 className="font-semibold">{labels[kind]}</h2><p className="text-xs text-muted-foreground">Tus recursos · página {page}</p></div>
        {failed ? <p role="alert" className="p-6 text-sm">No fue posible consultar esta categoría. Vuelve a intentarlo.</p>
          : !items.length ? <p className="p-6 text-sm text-muted-foreground">No hay recursos en esta página.</p>
          : <ul className="divide-y">{items.slice(0, PAGE_SIZE).map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="break-words font-medium">{item.title}</p><p className="break-words text-xs text-muted-foreground">{item.detail || "Sin clasificación"}</p></div>
              <time className="text-xs text-muted-foreground">{dateLabel(item.date)}</time>
            </li>
          ))}</ul>}
        <div className="flex items-center justify-between border-t p-4 text-sm">
          {page > 1 ? <Link href={href(kind, page - 1)} className="underline">Anterior</Link> : <span className="text-muted-foreground">Anterior</span>}
          <span>Página {page}</span>
          {hasMore && page < 400 ? <Link href={href(kind, page + 1)} className="underline">Siguiente</Link> : <span className="text-muted-foreground">Siguiente</span>}
        </div>
      </section>
      <aside className="rounded-xl border bg-muted/30 p-4 text-sm">
        <h2 className="font-semibold">Gestión institucional y EDUAI Connect</h2>
        <p className="mt-1 text-muted-foreground">Los cursos, periodos, calificaciones, accesos externos y permisos institucionales se incorporarán después de verificar las reglas de acceso. Ningún recurso de esta vista se comparte automáticamente.</p>
      </aside>
    </main>
  )
}
