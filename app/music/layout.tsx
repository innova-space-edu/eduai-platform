import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://eduaiplatformclon.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "EDUAI Music",
  description: "Escucha, explora y comparte música desde EDUAI Music.",
  openGraph: {
    title: "EDUAI Music",
    description: "Escucha, explora y comparte música desde EDUAI Music.",
    url: "/music",
    siteName: "EDUAI Music",
    type: "website",
    images: [
      {
        url: "/api/music/share-card?catalog=1",
        width: 1200,
        height: 630,
        alt: "EDUAI Music",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EDUAI Music",
    description: "Escucha, explora y comparte música desde EDUAI Music.",
    images: ["/api/music/share-card?catalog=1"],
  },
};

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
