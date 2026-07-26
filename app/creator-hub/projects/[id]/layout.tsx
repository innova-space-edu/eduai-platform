import Link from "next/link"
import { MessageSquareShare } from "lucide-react"

export default async function CreatorProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <>
      {children}
      <Link
        href={`/creator-hub/collaboration/${encodeURIComponent(id)}`}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-xs font-bold text-white shadow-xl transition hover:-translate-y-0.5"
        title="Abrir colaboración, comentarios y enlaces compartidos"
      >
        <MessageSquareShare size={16} /> Colaborar
      </Link>
    </>
  )
}
