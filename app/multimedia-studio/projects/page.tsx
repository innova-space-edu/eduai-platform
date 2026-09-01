import MultimediaProjectLibraryClient from "@/components/multimedia/MultimediaProjectLibraryClient";

export const metadata = {
  title: "Mis proyectos multimedia | EduAI",
  description: "Biblioteca de proyectos de audio y video de EduAI con guardado local y sincronización en la nube.",
};

export default function MultimediaProjectsPage() {
  return <MultimediaProjectLibraryClient />;
}
