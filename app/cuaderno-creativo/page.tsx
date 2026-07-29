"use client"

import { useEffect, useState } from "react"
import { PanelLeftOpen, X } from "lucide-react"
import CreativeNotebook from "./CreativeNotebook"
import styles from "./display.module.css"

export default function CuadernoCreativoPage() {
  const [toolsOpen, setToolsOpen] = useState(false)

  useEffect(() => {
    if (!toolsOpen) return

    const previousOverflow = document.body.style.overflow
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setToolsOpen(false)
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", closeWithEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", closeWithEscape)
    }
  }, [toolsOpen])

  return (
    <div className={`${styles.page} ${toolsOpen ? styles.toolsOpen : ""}`}>
      <button
        type="button"
        className={styles.mobileToolsButton}
        aria-expanded={toolsOpen}
        onClick={() => setToolsOpen((current) => !current)}
      >
        {toolsOpen ? <X size={18} /> : <PanelLeftOpen size={18} />}
        {toolsOpen ? "Cerrar herramientas" : "Herramientas"}
      </button>

      {toolsOpen && (
        <button
          type="button"
          className={styles.mobileToolsBackdrop}
          aria-label="Cerrar panel de herramientas"
          onClick={() => setToolsOpen(false)}
        />
      )}

      <CreativeNotebook />
    </div>
  )
}
