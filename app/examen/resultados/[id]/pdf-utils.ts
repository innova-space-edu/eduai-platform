export const PDF_PALETTE = {
  navy: [15, 23, 42] as const,
  blue: [37, 99, 235] as const,
  indigo: [99, 102, 241] as const,
  cyan: [6, 182, 212] as const,
  violet: [139, 92, 246] as const,
  green: [16, 185, 129] as const,
  amber: [245, 158, 11] as const,
  red: [239, 68, 68] as const,
  slate: [100, 116, 139] as const,
  light: [248, 250, 252] as const,
  softBlue: [239, 246, 255] as const,
  softGreen: [236, 253, 245] as const,
  softAmber: [255, 251, 235] as const,
  softRed: [254, 242, 242] as const,
  white: [255, 255, 255] as const,
  border: [226, 232, 240] as const,
  text: [30, 41, 59] as const,
  muted: [100, 116, 139] as const,
  grayBg: [244, 247, 251] as const,
}

export function cleanPdfText(text: unknown) {
  if (text === null || text === undefined) return ""
  return String(text)
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export function stripPdfHtml(text: string) {
  return cleanPdfText(text.replace(/<[^>]*>/g, " "))
}

export function getLevelFromScore(score: number) {
  if (score >= 85) return "Logro destacado"
  if (score >= 70) return "Buen nivel"
  if (score >= 50) return "En desarrollo"
  return "Requiere apoyo"
}
