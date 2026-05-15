import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getBaseUrl(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return new URL(req.url).origin;
}

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl(req).replace(/\/$/, "");
  const redirectUri =
    process.env.JAMENDO_REDIRECT_URI || `${baseUrl}/api/music/jamendo/callback`;

  return NextResponse.json({
    ok: true,
    providers: {
      jamendo: {
        configured: Boolean(process.env.JAMENDO_CLIENT_ID),
        oauthConfigured: Boolean(
          process.env.JAMENDO_CLIENT_ID && process.env.JAMENDO_CLIENT_SECRET,
        ),
        redirectUri,
        connectUrl: "/api/music/jamendo/connect",
        supportsFullStreaming: true,
        notes:
          "Jamendo se usa como proveedor principal para canciones completas reproducibles cuando JAMENDO_CLIENT_ID está configurado.",
      },
      audius: {
        configured: true,
        supportsFullStreaming: true,
        apiHost: process.env.AUDIUS_API_HOST || "https://discoveryprovider.audius.co",
      },
      itunes: {
        configured: true,
        supportsFullStreaming: false,
        notes: "iTunes se usa como fallback de previews promocionales.",
      },
      youtube: {
        configured: false,
        supportsFullStreaming: false,
        notes:
          "YouTube debe integrarse con IFrame oficial; no se convierte a MP3.",
      },
    },
  });
}
