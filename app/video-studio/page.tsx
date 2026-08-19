import VideoStudioClient from "@/components/video/VideoStudioClient"

export const metadata = {
  title: "Video Studio | EduAI",
  description: "Generación y reutilización de videos con IA, modelos seleccionables, Créditos IA y pago seguro integrado",
}

export default function VideoStudioPage() {
  return (
    <main
      className="min-h-screen bg-gradient-to-b from-white via-blue-50/40 to-white text-main"
      data-video-routing="credits-and-free-first"
    >
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <VideoStudioClient />
      </div>
    </main>
  )
}
