import Link from "next/link"

const LINKS = [
  { href: "/privacidad", label: "Privacidad" },
  { href: "/seguridad", label: "Seguridad" },
  { href: "/gobernanza-ia", label: "Gobernanza de IA" },
  { href: "/terminos", label: "Términos" },
]

type LegalFooterProps = {
  compact?: boolean
  className?: string
}

export default function LegalFooter({ compact = false, className = "" }: LegalFooterProps) {
  return (
    <footer className={`w-full text-center text-muted2 ${compact ? "py-3" : "py-6"} ${className}`}>
      <nav aria-label="Información legal" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px]">
        {LINKS.map(link => (
          <Link key={link.href} href={link.href} className="transition-colors hover:text-main hover:underline underline-offset-4">
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="mt-2 text-[10px]">© {new Date().getFullYear()} Innova Space Edu SpA · EduAI Platform</p>
    </footer>
  )
}
