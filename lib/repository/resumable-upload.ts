"use client"

import * as tus from "tus-js-client"
import type { SupabaseClient } from "@supabase/supabase-js"

const CHUNK_SIZE = 6 * 1024 * 1024

export type RepositoryUploadProgress = {
  bytesUploaded: number
  bytesTotal: number
  percentage: number
}

type RepositoryResumableUploadParams = {
  supabase: SupabaseClient
  bucket: string
  objectName: string
  file: File
  onProgress?: (progress: RepositoryUploadProgress) => void
}

function getProjectId() {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  try {
    return new URL(publicUrl).hostname.split(".")[0] || ""
  } catch {
    return ""
  }
}

export async function uploadRepositoryFile({
  supabase,
  bucket,
  objectName,
  file,
  onProgress,
}: RepositoryResumableUploadParams) {
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
      chunkSize: CHUNK_SIZE,
      metadata: {
        bucketName: bucket,
        objectName,
        contentType: file.type || "application/octet-stream",
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
