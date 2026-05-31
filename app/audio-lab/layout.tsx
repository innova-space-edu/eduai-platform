import type { ReactNode } from "react"
import AudioLabNav from "@/components/audio/AudioLabNav"

export default function AudioLabLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AudioLabNav />
      {children}
    </>
  )
}
