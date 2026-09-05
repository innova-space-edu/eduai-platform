"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

function normalizedText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es")
}

function findAction(label: "library" | "code") {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("a, button"))

  return nodes.find(node => {
    const text = normalizedText(node.textContent)
    if (label === "library") return text === "biblioteca" || text.includes("biblioteca")
    return text.includes("agente de código") || text.includes("agente de codigo")
  }) || null
}

function keepLibraryAndCodeTogether() {
  const library = findAction("library")
  const code = findAction("code")
  if (!library || !code || library === code) return

  const libraryParent = library.parentElement
  const codeParent = code.parentElement
  if (!libraryParent || libraryParent !== codeParent) return

  // Conserva el orden visual existente del agente de código, pero sin dejar
  // que otros accesos (por ejemplo Notas IA) queden entre ambos botones.
  if (library.previousElementSibling !== code) {
    libraryParent.insertBefore(code, library)
  }

  // En barras estrechas evitamos solapamientos. La fila conserva todos sus
  // accesos en una sola línea y, si no caben, permite desplazamiento horizontal
  // en vez de montar un botón sobre otro o separar Biblioteca/Agente de código.
  const row = libraryParent as HTMLElement
  row.style.flexWrap = "nowrap"
  row.style.overflowX = "auto"
  row.style.overflowY = "hidden"
  row.style.maxWidth = "100%"
  row.style.gap = row.style.gap || "0.5rem"
  row.style.scrollbarWidth = "none"

  Array.from(row.children).forEach(child => {
    if (child instanceof HTMLElement) {
      child.style.flexShrink = "0"
      child.style.whiteSpace = "nowrap"
    }
  })

  row.dataset.eduaiNavigationGuard = "library-code"
}

export default function HeaderNavigationGuard() {
  const pathname = usePathname()

  useEffect(() => {
    let frame = 0
    const apply = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(keepLibraryAndCodeTogether)
    }

    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })

    window.addEventListener("resize", apply)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", apply)
    }
  }, [pathname])

  return null
}
