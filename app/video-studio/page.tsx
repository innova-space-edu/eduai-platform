import VideoStudioClient from "@/components/video/VideoStudioClient"

export const metadata = {
  title: "Video Studio | EduAI",
  description: "Generación de videos con IA desde texto o imagen",
}

export default function VideoStudioPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-blue-50/40 to-white text-main">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <VideoStudioClient />
      </div>
    </main>
  )
}
