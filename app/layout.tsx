import type { Metadata } from "next"
import "./globals.css"
import SupportButton from "@/components/ui/SupportButton"
import SuperAgentButton from "@/components/ui/SuperAgentButton"
import { ThemeProvider } from "@/components/theme-provider"
import { MusicProvider } from "@/components/music/MusicProvider"
import ExamUiPolish from "@/components/exam/ExamUiPolish"

export const metadata: Metadata = {
  title: "EduAI Platform",
  description: "Tu tutor personal con inteligencia artificial",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          <MusicProvider>
            {children}
            <ExamUiPolish />
            <SupportButton />
            <SuperAgentButton />
          </MusicProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
