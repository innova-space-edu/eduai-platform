import MediaStudioClient from "@/components/media-studio/MediaStudioClient";
import MediaExportMenu from "@/components/media-studio/MediaExportMenu";

export const metadata = {
  title: "Media Studio | EduAI",
  description: "Editor audiovisual por capas con biblioteca multimedia y asistencia IA",
};

export default function MediaStudioPage() {
  return (
    <>
      <MediaStudioClient />
      <MediaExportMenu />
    </>
  );
}
