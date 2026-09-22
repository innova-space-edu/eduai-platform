import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

function clean(value: string | null, max = 120) {
  return (value || "").replace(/[<>\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeVideoId(value: string | null) {
  const id = (value || "").trim();
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : "";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const catalog = searchParams.get("catalog") === "1";
  const title = clean(searchParams.get("title"), 110);
  const artist = clean(searchParams.get("artist"), 90);
  const videoId = safeVideoId(searchParams.get("videoId"));
  const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";
  const publicOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://eduaiplatformclon.vercel.app";
  const logoUrl = new URL("/eduai-logo.svg", publicOrigin).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg,#02050c 0%,#071827 52%,#1a0830 100%)",
          color: "white",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            width="630"
            height="630"
            style={{
              width: "630px",
              height: "630px",
              objectFit: "cover",
              opacity: 0.72,
            }}
          />
        ) : (
          <div
            style={{
              width: "500px",
              height: "630px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "radial-gradient(circle at 50% 45%,rgba(37,244,255,.28),transparent 38%),linear-gradient(160deg,#071827,#1b0730)",
            }}
          >
            <div
              style={{
                width: "220px",
                height: "220px",
                borderRadius: "50%",
                border: "18px solid #25f4ff",
                boxShadow: "0 0 55px rgba(37,244,255,.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "92px",
                fontWeight: 900,
                color: "#ff42cf",
              }}
            >
              ♪
            </div>
          </div>
        )}

        <div
          style={{
            flex: 1,
            padding: "64px 68px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: thumbnail
              ? "linear-gradient(90deg,rgba(2,5,12,.08),rgba(2,5,12,.95) 20%,rgba(2,5,12,.98))"
              : "transparent",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt=""
              width="64"
              height="64"
              style={{ width: "64px", height: "64px", objectFit: "contain" }}
            />
            <div style={{ display: "flex", fontSize: "30px", fontWeight: 900, letterSpacing: "1px" }}>
              EDUAI&nbsp;<span style={{ color: "#ff42cf", fontStyle: "italic" }}>Music</span>
            </div>
          </div>

          <div
            style={{
              marginTop: "42px",
              display: "flex",
              fontSize: catalog ? "54px" : "48px",
              lineHeight: 1.08,
              fontWeight: 900,
              maxWidth: "560px",
            }}
          >
            {catalog ? "Explora el catálogo" : title || "Escucha en EDUAI Music"}
          </div>

          <div
            style={{
              marginTop: "18px",
              display: "flex",
              fontSize: "25px",
              color: "#67e8f9",
              maxWidth: "560px",
            }}
          >
            {catalog ? "Descubre música, playlists y favoritos." : artist || "EDUAI Music"}
          </div>

          <div
            style={{
              marginTop: "36px",
              display: "flex",
              fontSize: "18px",
              color: "#94a3b8",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            Sonidos que impulsan tu mundo
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            inset: "0",
            border: "3px solid rgba(37,244,255,.28)",
            boxShadow: "inset 0 0 80px rgba(37,244,255,.08)",
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
