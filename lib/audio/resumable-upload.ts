"use client"

import * as tus from "tus-js-client"
import type { SupabaseClient } from "@supabase/supabase-js"

const SIX_MB = 6 * 1024 * 1024

export type AudioUploadProgress = {
  bytesUploaded: number
  bytesTotal: number
  percentage: number
}

export type AudioResumableUploadParams = {
  supabase: SupabaseClient
  bucket: string
  objectName: string
  file: File
  onProgress?: (progress: AudioUploadProgress) => void
}

function getProjectId(): string {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  try {
    return new URL(publicUrl).hostname.split(".")[0] || ""
  } catch {
    return ""
  }
}

export async function uploadAudioResumable({
  supabase,
  bucket,
  objectName,
  file,
  onProgress,
}: AudioResumableUploadParams): Promise<void> {
  const projectId = getProjectId()
  if (!projectId) throw new Error("No se pudo determinar el proyecto Supabase.")

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error("La sesión expiró. Vuelve a iniciar sesión.")

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: SIX_MB,
      metadata: {
        bucketName: bucket,
        objectName,
        contentType: file.type || "audio/mpeg",
        cacheControl: "3600",
      },
      onError(error) {
        reject(error)
      },
      onProgress(bytesUploaded, bytesTotal) {
        const percentage = bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0
        onProgress?.({ bytesUploaded, bytesTotal, percentage })
      },
      onSuccess() {
        resolve()
      },
    })

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0])
      upload.start()
    }).catch(reject)
  })
}
