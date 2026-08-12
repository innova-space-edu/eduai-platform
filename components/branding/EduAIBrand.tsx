type EduAIBrandProps = {
  className?: string
  logoClassName?: string
  nameClassName?: string
}

export default function EduAIBrand({
  className = "",
  logoClassName = "h-16 w-16",
  nameClassName = "text-xl font-extrabold tracking-tight text-main",
}: EduAIBrandProps) {
  return (
    <div
      className={`inline-flex flex-col items-center justify-center ${className}`.trim()}
      aria-label="EduAI"
    >
      {/* Se usa <img> intencionalmente para servir el SVG original sin rasterizarlo ni perder su animación SMIL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/eduai-logo.svg"
        alt=""
        aria-hidden="true"
        className={`block flex-shrink-0 object-contain ${logoClassName}`.trim()}
      />
      <span className={`mt-1 whitespace-nowrap ${nameClassName}`.trim()}>
        EduAI
      </span>
    </div>
  )
}
