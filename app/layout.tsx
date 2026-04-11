import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import SupportButton from "@/components/ui/SupportButton"
import SuperAgentButton from "@/components/ui/SuperAgentButton"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

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
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <SupportButton />
          <SuperAgentButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
