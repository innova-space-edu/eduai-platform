import type { Metadata } from "next"
import SharedMaterialViewer from "./shared-material-viewer"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Material compartido · Nube EduAI",
  description: "Material educativo compartido desde Nube EduAI.",
  robots: { index: false, follow: false },
}

export default async function SharedMaterialPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SharedMaterialViewer token={token} />
}
