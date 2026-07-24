import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react"
import LegalFooter from "@/components/legal/LegalFooter"

type LegalReference = {
  label: string
  href: string
  detail: string
}

type LegalPageProps = {
  eyebrow: string
  title: string
  summary: string
  updatedAt: string
  children: ReactNode
  references?: LegalReference[]
}

export default function LegalPage({
  eyebrow,
  title,
  summary,
  updatedAt,
  children,
  references = [],
}: LegalPageProps) {
  return (
    <main className="min-h-screen bg-app text-main">
      <header className="sticky top-0 z-30 border-b border-soft bg-app/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="grid h-9 w-9 place-items-center rounded-xl border border-soft bg-card-soft-theme text-sub transition hover:text-main" aria-label="Volver">
            <ArrowLeft size={16} />
          </Link>
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-900/15">
            <ShieldCheck size={19} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-500">{eyebrow}</p>
            <p className="text-sm font-bold">EduAI · Innova Space Edu SpA</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="rounded-3xl border border-soft bg-card-soft-theme p-6 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">Información institucional</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-sub sm:text-base">{summary}</p>
          <p className="mt-4 text-[11px] text-muted2">Última actualización: {updatedAt}</p>
        </section>

        <article className="legal-content mt-6 space-y-6 rounded-3xl border border-soft bg-card-soft-theme p-6 text-sm leading-7 text-sub sm:p-9 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-main [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-main [&_li]:ml-5 [&_li]:list-disc [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-main">
          {children}
        </article>

        {references.length > 0 && (
          <section className="mt-6 rounded-3xl border border-soft bg-card-soft-theme p-6 sm:p-9">
            <h2 className="text-xl font-bold">Referencias oficiales</h2>
            <p className="mt-2 text-sm text-sub">Fuentes normativas y técnicas consultadas para esta versión.</p>
            <div className="mt-5 grid gap-3">
              {references.map(reference => (
                <a
                  key={reference.href}
                  href={reference.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 rounded-2xl border border-soft bg-app/40 p-4 transition hover:border-blue-500/30"
                >
                  <ExternalLink size={16} className="mt-0.5 shrink-0 text-blue-500" />
                  <span>
                    <span className="block text-sm font-semibold text-main">{reference.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted2">{reference.detail}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-xs leading-6 text-sub">
          Este documento entrega información institucional y operativa. No sustituye asesoría jurídica especializada ni una evaluación formal de cumplimiento aplicable a cada establecimiento o contrato.
        </div>

        <LegalFooter />
      </div>
    </main>
  )
}
