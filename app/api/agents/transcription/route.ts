/**
 * Compatibilidad v1 → redirige al pipeline robusto.
 */

import { NextRequest, NextResponse } from "next/server"
import { POST as pipelinePOST } from "@/app/api/agents/audio/pipeline/route"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  return pipelinePOST(req)
}
