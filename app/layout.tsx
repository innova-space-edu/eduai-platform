import type { Metadata } from "next"
import "./globals.css"
import HeaderNavigationGuard from "@/components/ui/HeaderNavigationGuard"
import { ThemeProvider } from "@/components/theme-provider"
import { MusicProvider } from "@/components/music/MusicProvider"
import ExamUiPolish from "@/components/exam/ExamUiPolish"
import EditExamTimeButton from "@/components/exam/EditExamTimeButton"
import ResultCourseGroups from "@/components/exam/ResultCourseGroups"
import CreateExamMixedAI from "@/components/exam/CreateExamMixedAI"
import ExamLatexAnswerFix from "@/components/exam/ExamLatexAnswerFix"
import EduAIUsageTracker from "@/components/analytics/EduAIUsageTracker"
import DashboardLegalFooter from "@/components/legal/DashboardLegalFooter"
import AdminIncidentBell from "@/components/admin/AdminIncidentBell"
import LegacyConsentCountdown from "@/components/legal/LegacyConsentCountdown"

export const metadata: Metadata = {
  title: "EduAI Platform",
  description: "Tu espacio educativo con inteligencia artificial",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/eduai-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
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
            <LegacyConsentCountdown policyHref="/privacidad" />
            <EduAIUsageTracker />
            {children}
            <HeaderNavigationGuard />
            <AdminIncidentBell />
            <DashboardLegalFooter />
            <ExamUiPolish />
            <EditExamTimeButton />
            <ResultCourseGroups />
            <CreateExamMixedAI />
            <ExamLatexAnswerFix />
          </MusicProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
