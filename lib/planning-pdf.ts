import { getDesignTemplate } from "./registry"
import type { EduAIDesignTemplate } from "./types"

export type PdfRGB = [number, number, number]

export interface PdfDesignStyle {
  template: EduAIDesignTemplate
  primary: PdfRGB
  secondary: PdfRGB
  accent: PdfRGB
  background: PdfRGB
  surface: PdfRGB
  text: PdfRGB
  muted: PdfRGB
  success: PdfRGB
  warning: PdfRGB
  danger: PdfRGB
  line: PdfRGB
  softPrimary: PdfRGB
  softSecondary: PdfRGB
  softAccent: PdfRGB
  headerText: PdfRGB
  isDark: boolean
}

export function hexToPdfRgb(hex?: string | null, fallback: PdfRGB = [59, 130, 246]): PdfRGB {
  const raw = String(hex || "").replace("#", "").trim()
  const normalized = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ]
}

export function mixPdfRgb(a: PdfRGB, b: PdfRGB, amount = 0.86): PdfRGB {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return [
    clamp(a[0] * (1 - amount) + b[0] * amount),
    clamp(a[1] * (1 - amount) + b[1] * amount),
    clamp(a[2] * (1 - amount) + b[2] * amount),
  ]
}

export function getPdfDesignStyle(templateId?: string | null, format?: string | null): PdfDesignStyle {
  const template = getDesignTemplate(templateId, format || undefined)
  const primary = hexToPdfRgb(template.palette.primary, [37, 99, 235])
  const secondary = hexToPdfRgb(template.palette.secondary, [124, 58, 237])
  const accent = hexToPdfRgb(template.palette.accent || template.accentColor, primary)
  const background = hexToPdfRgb(template.export.pageBackground || template.palette.background, [248, 250, 252])
  const surface = hexToPdfRgb(template.palette.surface, [255, 255, 255])
  const text = hexToPdfRgb(template.palette.text, [15, 23, 42])
  const muted = hexToPdfRgb(template.palette.muted, [100, 116, 139])
  const success = hexToPdfRgb(template.palette.success, [16, 185, 129])
  const warning = hexToPdfRgb(template.palette.warning, [245, 158, 11])
  const danger = hexToPdfRgb(template.palette.danger, [239, 68, 68])
  const isDark = template.surface === "dark" || template.export.pptTheme === "dark"

  return {
    template,
    primary,
    secondary,
    accent,
    background,
    surface,
    text,
    muted,
    success,
    warning,
    danger,
    line: isDark ? [51, 65, 85] : [226, 232, 240],
    softPrimary: mixPdfRgb(primary, [255, 255, 255], isDark ? 0.12 : 0.88),
    softSecondary: mixPdfRgb(secondary, [255, 255, 255], isDark ? 0.12 : 0.88),
    softAccent: mixPdfRgb(accent, [255, 255, 255], isDark ? 0.12 : 0.86),
    headerText: isDark ? [248, 250, 252] : [255, 255, 255],
    isDark,
  }
}

export function resolveDesignTemplateId(input?: unknown, fallback?: string) {
  if (typeof input === "string" && input.trim()) return input.trim()
  if (input && typeof input === "object") {
    const maybe = input as { designTemplateId?: unknown; _design?: { templateId?: unknown } }
    if (typeof maybe.designTemplateId === "string" && maybe.designTemplateId.trim()) return maybe.designTemplateId.trim()
    if (typeof maybe._design?.templateId === "string" && maybe._design.templateId.trim()) return maybe._design.templateId.trim()
  }
  return fallback
}

export function pdfDesignFooterLabel(style: PdfDesignStyle) {
  return `EduAI Design Engine · ${style.template.shortName}`
}
