export type QrImageFormat = "png" | "svg"

export function buildQrImageUrl(
  text: string,
  options: { format?: QrImageFormat; size?: number; caption?: string } = {}
): string {
  const params = new URLSearchParams({
    text,
    format: options.format ?? "png",
    size: String(options.size ?? 480),
    margin: "3",
    ecLevel: "M",
  })

  if (options.caption?.trim()) params.set("caption", options.caption.trim())

  return `https://quickchart.io/qr?${params.toString()}`
}
