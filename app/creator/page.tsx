// src/app/creator/page.tsx
"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

// ============================================================
// SIDEBAR (mismo patrón que dashboard)
// ============================================================

const NAV_LINKS = [
  { href: "/dashboard", icon: "🏠", label: "Inicio" },
  { href: "/agentes",   icon: "🤖", label: "Agentes" },
  { href: "/sessions",  icon: "📚", label: "Sesiones" },
  { href: "/galeria",   icon: "🖼️", label: "Galería" },
  { href: "/ranking",   icon: "🏆", label: "Ranking" },
  { href: "/chat",      icon: "💬", label: "Chat" },
  { href: "/collab",    icon: "🤝", label: "Colaborar" },
  { href: "/creator",   icon: "✨", label: "Creator" },
  { href: "/profile",   icon: "👤", label: "Perfil" },
]

// ============================================================
// OUTPUT FORMAT CONFIG
// ============================================================

const OUTPUT_FORMATS = [
  { id: "infographic", icon: "📊", label: "Infografía",    desc: "Visual con datos clave" },
  { id: "ppt",         icon: "📑", label: "Presentación",  desc: "Slides descargables" },
  { id: "poster",      icon: "🎨", label: "Afiche",        desc: "Poster visual" },
  { id: "podcast",     icon: "🎙️", label: "Podcast",       desc: "Audio conversacional" },
  { id: "mindmap",     icon: "🧠", label: "Mapa Mental",   desc: "Conceptos conectados" },
  { id: "flashcards",  icon: "📇", label: "Flashcards",    desc: "Tarjetas de estudio" },
  { id: "quiz",        icon: "✅", label: "Quiz",           desc: "Evaluación adaptativa" },
  { id: "timeline",    icon: "⏳", label: "Timeline",       desc: "Línea temporal" },
]

const SOURCE_TYPES = [
  { id: "topic", icon: "💡", label: "Tema" },
  { id: "text",  icon: "📝", label: "Texto" },
  { id: "url",   icon: "🔗", label: "URL" },
  { id: "pdf",   icon: "📄", label: "PDF" },
  { id: "docx",  icon: "📎", label: "DOCX" },
]

// ============================================================
// RENDERERS
// ============================================================

// ...existing code...

export default function CreatorStudioPage() {
  // ...existing code...
}
