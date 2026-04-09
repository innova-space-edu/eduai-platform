import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import SupportButton from "@/components/ui/SupportButton"
import SuperAgentButton from "@/components/ui/SuperAgentButton"

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
        {children}
        <SupportButton />
        <SuperAgentButton />
      </body>
    </html>
  )
}
