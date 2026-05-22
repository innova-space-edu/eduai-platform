import { NextRequest, NextResponse } from "next/server"
import { getCompatibleDesignTemplates, getDefaultDesignTemplateId } from "@/lib/design-templates/registry"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") || undefined
  const templates = getCompatibleDesignTemplates(format)

  return NextResponse.json({
    success: true,
    format: format || "all",
    defaultTemplateId: getDefaultDesignTemplateId(format),
    templates,
  })
}
