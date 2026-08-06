import type { Metadata } from "next"
import PublicCloudClient from "./public-cloud-client"

export const metadata: Metadata = {
  title: "Nube EduAI · Acceso público",
  description: "Espacio público para consultar, descargar, subir y compartir material educativo.",
  robots: { index: false, follow: false },
}

export default async function PublicCloudPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <PublicCloudClient token={token} />
}
