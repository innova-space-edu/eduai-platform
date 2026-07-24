"use client"

import { usePathname } from "next/navigation"
import LegalFooter from "@/components/legal/LegalFooter"

export default function DashboardLegalFooter() {
  const pathname = usePathname()
  if (pathname !== "/dashboard") return null

  return (
    <div className="border-t border-soft bg-app px-4">
      <LegalFooter compact />
    </div>
  )
}
