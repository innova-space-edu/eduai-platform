import VideoStudioClient from "@/components/video/VideoStudioClient"

export const metadata = {
  title: "Video Studio | EduAI",
  description: "Generación de videos desde texto o imagen",
}

export default function VideoStudioPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8">
          <div className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
            🎬 Video AI Studio
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
            Genera videos con IA desde texto o imagen
          </h1>

          <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
            Crea clips cortos de hasta 6 segundos, con opción de extensión hasta
            10 segundos. Puedes usar un prompt, subir una imagen base y agregar
            audio o voz para acompañar el video.
          </p>
        </div>

        <VideoStudioClient />
      </div>
    </main>
  )
}
