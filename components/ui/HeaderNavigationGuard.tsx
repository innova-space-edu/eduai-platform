"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

function normalizedText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es")
}

function findLibraryAction() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("a, button"))
  return (
    nodes.find(node => {
      const text = normalizedText(node.textContent)
      const href = node instanceof HTMLAnchorElement ? node.getAttribute("href") || "" : ""
      return href === "/biblioteca" || text === "biblioteca"
    }) || null
  )
}

function findAccessCodesAction() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("a, button"))
  return (
    nodes.find(node => {
      const text = normalizedText(node.textContent)
      const href = node instanceof HTMLAnchorElement ? node.getAttribute("href") || "" : ""
      return (
        text.includes("códigos de acceso") ||
        text.includes("codigos de acceso") ||
        href.startsWith("/admin/exam-codes") ||
        href.startsWith("/admin/exam-access")
      )
    }) || null
  )
}

function normalizeMovedAction(action: HTMLElement) {
  // El botón podía venir como acción flotante. Al integrarlo al encabezado
  // anulamos únicamente el posicionamiento flotante; su estilo visual se conserva.
  action.style.position = "static"
  action.style.inset = "auto"
  action.style.top = "auto"
  action.style.right = "auto"
  action.style.bottom = "auto"
  action.style.left = "auto"
  action.style.transform = "none"
  action.style.margin = "0"
  action.style.flexShrink = "0"
  action.style.whiteSpace = "nowrap"
  action.style.alignSelf = "center"
  action.style.zIndex = "auto"
  action.dataset.eduaiHeaderAction = "access-codes"
}

function keepLibraryAndAccessCodesTogether() {
  const library = findLibraryAction()
  const accessCodes = findAccessCodesAction()
  if (!library || !accessCodes || library === accessCodes) return

  const row = library.parentElement
  if (!row) return

  normalizeMovedAction(accessCodes)

  // “Códigos de acceso” queda inmediatamente después de Biblioteca, aunque
  // originalmente haya sido renderizado como botón flotante en otro contenedor.
  if (library.nextElementSibling !== accessCodes) {
    library.insertAdjacentElement("afterend", accessCodes)
  }

  // Mantiene todos los accesos superiores ordenados y sin superposición.
  row.style.display = "flex"
  row.style.alignItems = "center"
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

  row.dataset.eduaiNavigationGuard = "library-access-codes"
}

export default function HeaderNavigationGuard() {
  const pathname = usePathname()

  useEffect(() => {
    let frame = 0
    const apply = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(keepLibraryAndAccessCodesTogether)
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
