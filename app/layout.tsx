import type { Metadata } from "next"
import "./globals.css"
import SupportButton from "@/components/ui/SupportButton"
import SupportLinkButton from "@/components/ui/SupportLinkButton"
import SuperAgentButton from "@/components/ui/SuperAgentButton"
import { ThemeProvider } from "@/components/theme-provider"
import { MusicProvider } from "@/components/music/MusicProvider"
import ExamUiPolish from "@/components/exam/ExamUiPolish"
import EditExamTimeButton from "@/components/exam/EditExamTimeButton"
import ResultCourseGroups from "@/components/exam/ResultCourseGroups"
import CreateExamMixedAI from "@/components/exam/CreateExamMixedAI"
import ExamLatexAnswerFix from "@/components/exam/ExamLatexAnswerFix"
import EduAIUsageTracker from "@/components/analytics/EduAIUsageTracker"

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
            <EduAIUsageTracker />
            {children}
            <ExamUiPolish />
            <EditExamTimeButton />
            <ResultCourseGroups />
            <CreateExamMixedAI />
            <ExamLatexAnswerFix />
            <SupportLinkButton />
            <SupportButton />
            <SuperAgentButton />
          </MusicProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
