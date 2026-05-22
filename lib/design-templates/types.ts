export type EduAIDesignFormat =
  | "infographic"
  | "ppt"
  | "poster"
  | "podcast"
  | "mindmap"
  | "flashcards"
  | "quiz"
  | "timeline"
  | "cornell"
  | "glossary"
  | "story"
  | "song"
  | "lessonplan"
  | "exam"
  | "planning"
  | "report"
  | "worksheet"
  | "card"
  | "generic"

export type EduAIDesignCategory =
  | "educational"
  | "presentation"
  | "print"
  | "infographic"
  | "assessment"
  | "brand"

export type EduAIDesignDensity = "minimal" | "balanced" | "rich" | "max"
export type EduAIDesignMood = "clean" | "academic" | "playful" | "futuristic" | "canva" | "editorial"
export type EduAIDesignSurface = "light" | "dark" | "gradient" | "paper"

export interface EduAIDesignPalette {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  muted: string
  success?: string
  warning?: string
  danger?: string
}

export interface EduAIDesignTemplate {
  id: string
  name: string
  shortName: string
  description: string
  category: EduAIDesignCategory
  mood: EduAIDesignMood
  density: EduAIDesignDensity
  surface: EduAIDesignSurface
  formats: EduAIDesignFormat[]
  palette: EduAIDesignPalette
  accentColor: string
  tags: string[]
  layoutHints: string[]
  visualElements: string[]
  promptDirective: string
  export: {
    pdfHeader: "band" | "hero" | "minimal" | "split"
    pptTheme: "dark" | "light" | "gradient" | "paper"
    cardRadius: number
    useDecorations: boolean
    pageBackground: string
  }
}

export interface EduAIDesignSelection {
  templateId: string
  format?: EduAIDesignFormat | string
  intensity?: EduAIDesignDensity
}
