import { redirect } from "next/navigation"

export const metadata = {
  title: "Image Studio | EduAI",
  description: "Redirección al generador unificado de imágenes de EduAI.",
}

export default function ImagenesRedirectPage() {
  redirect("/image-studio")
}
