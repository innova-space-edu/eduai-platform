import MultimediaStudioResponsiveClient from "@/components/multimedia/MultimediaStudioResponsiveClient";
import MultimediaAudioProDockController from "@/components/multimedia/MultimediaAudioProDockController";

export const metadata = {
  title: "Editor Multimedia | EduAI",
  description: "Editor profesional de audio, video e imágenes por capas con timeline responsiva, seguimiento de cabezal, recorte, división, música, videos editables y exportación integrada.",
};

export default function MultimediaStudioPage() {
  return (
    <>
      <MultimediaStudioResponsiveClient />
      <MultimediaAudioProDockController />
    </>
  );
}
