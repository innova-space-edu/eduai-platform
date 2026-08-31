import MediaStudioClient from "@/components/media-studio/MediaStudioClient";
import MediaExportMenu from "@/components/media-studio/MediaExportMenu";
import MediaLibraryDrawer from "@/components/media-studio/MediaLibraryDrawer";
import MediaStudioProDock from "@/components/media-studio/MediaStudioProDock";
import MediaAudioAutomation from "@/components/media-studio/MediaAudioAutomation";
import MediaIntelligencePanel from "@/components/media-studio/MediaIntelligencePanel";

export const metadata = {
  title: "Media Studio | EduAI",
  description: "Editor audiovisual por capas con biblioteca multimedia y asistencia IA",
};

export default function MediaStudioPage() {
  return (
    <>
      <MediaStudioClient />
      <MediaLibraryDrawer />
      <MediaStudioProDock />
      <MediaAudioAutomation />
      <MediaIntelligencePanel />
      <MediaExportMenu />
    </>
  );
}
