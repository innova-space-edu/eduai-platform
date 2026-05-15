import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getBaseUrl(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return new URL(req.url).origin;
}

function redirectToMusic(req: NextRequest, status: string, extra?: string) {
  const url = new URL("/music", req.url);
  url.searchParams.set("jamendo", status);
  if (extra) url.searchParams.set("detail", extra.slice(0, 120));
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  if (error) return redirectToMusic(req, "error", errorDescription || error);

  const code = url.searchParams.get("code");
  if (!code) return redirectToMusic(req, "missing_code");

  const state = url.searchParams.get("state");
  const expectedState = req.cookies.get("eduai_jamendo_state")?.value;
  if (expectedState && state && expectedState !== state) {
    return redirectToMusic(req, "invalid_state");
  }

  const clientId = process.env.JAMENDO_CLIENT_ID;
  const clientSecret = process.env.JAMENDO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectToMusic(req, "missing_oauth_env");
  }

  const baseUrl = getBaseUrl(req);
  const redirectUri =
    process.env.JAMENDO_REDIRECT_URI ||
    `${baseUrl.replace(/\/$/, "")}/api/music/jamendo/callback`;

  try {
    const tokenRes = await fetch("https://api.jamendo.com/v3.0/oauth/grant", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "EduAI-Music/1.5",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    });
    const data = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || data.error) {
      return redirectToMusic(
        req,
        "token_error",
        data.error_description || data.error || `HTTP ${tokenRes.status}`,
      );
    }

    const response = redirectToMusic(req, "connected");
    const maxAge = Number(data.expires_in || 7200);
    response.cookies.delete("eduai_jamendo_state");
    if (data.access_token) {
      response.cookies.set("eduai_jamendo_access", data.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge,
        path: "/",
      });
    }
    if (data.refresh_token) {
      response.cookies.set("eduai_jamendo_refresh", data.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }
    return response;
  } catch (err) {
    return redirectToMusic(
      req,
      "callback_failed",
      err instanceof Error ? err.message : "unknown_error",
    );
  }
}
