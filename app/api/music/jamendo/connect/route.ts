import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getBaseUrl(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return new URL(req.url).origin;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/music?jamendo=missing_client_id", req.url),
    );
  }

  const baseUrl = getBaseUrl(req);
  const redirectUri =
    process.env.JAMENDO_REDIRECT_URI ||
    `${baseUrl.replace(/\/$/, "")}/api/music/jamendo/callback`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "music",
    state,
  });

  const response = NextResponse.redirect(
    `https://api.jamendo.com/v3.0/oauth/authorize?${params.toString()}`,
  );
  response.cookies.set("eduai_jamendo_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
