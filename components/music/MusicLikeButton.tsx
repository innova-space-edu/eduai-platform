"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";

type MusicLikeButtonProps = {
  liked: boolean;
  onToggle: () => void;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "icon" | "pill";
  label?: string;
};

const SPARKS = [
  { x: "-32px", y: "-19px", color: "#25f4ff", delay: "0ms" },
  { x: "-42px", y: "0px", color: "#54c8ff", delay: "35ms" },
  { x: "-32px", y: "20px", color: "#a98bff", delay: "15ms" },
  { x: "-12px", y: "-32px", color: "#a57bff", delay: "50ms" },
  { x: "12px", y: "-32px", color: "#ff42cf", delay: "25ms" },
  { x: "32px", y: "-19px", color: "#25f4ff", delay: "0ms" },
  { x: "42px", y: "0px", color: "#a57bff", delay: "40ms" },
  { x: "32px", y: "20px", color: "#ff42cf", delay: "15ms" },
  { x: "-14px", y: "31px", color: "#25f4ff", delay: "45ms" },
  { x: "14px", y: "31px", color: "#ff42cf", delay: "30ms" },
] as const;

const SIZE_CLASS = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
} as const;

export function MusicLikeButton({
  liked,
  onToggle,
  className = "",
  size = "sm",
  variant = "icon",
  label,
}: MusicLikeButtonProps) {
  const gradientId = `eduai-heart-${useId().replace(/:/g, "")}`;
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!burst) return;
    const timeout = window.setTimeout(() => setBurst(0), 760);
    return () => window.clearTimeout(timeout);
  }, [burst]);

  const onClick = () => {
    // Las chispas solo salen al agregar. Quitar favorito no dispara explosión.
    setBurst((current) => liked ? 0 : current + 1);
    onToggle();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={liked}
      aria-label={liked ? "Quitar de favoritos" : "Agregar a favoritos"}
      title={liked ? "Quitar de favoritos" : "Agregar a favoritos"}
      data-liked={liked}
      className={[
        "eduai-like-button relative isolate inline-flex shrink-0 items-center justify-center overflow-visible rounded-full",
        "transition-[background-color,border-color,box-shadow] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300",
        variant === "pill"
          ? "min-h-9 gap-2 border border-white/15 bg-white/[0.06] px-4 text-xs font-black text-white"
          : SIZE_CLASS[size],
        className,
      ].join(" ")}
    >
      {burst > 0 && (
        <span key={burst} className="eduai-like-burst pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="eduai-like-ring" />
          {SPARKS.map(({ x, y, color, delay }, index) => (
            <span
              key={index}
              className="eduai-like-spark"
              style={{
                "--eduai-spark-x": x,
                "--eduai-spark-y": y,
                "--eduai-spark-color": color,
                "--eduai-spark-delay": delay,
              } as CSSProperties}
            />
          ))}
        </span>
      )}
      <span className={["eduai-like-icon relative z-10 inline-flex items-center justify-center", burst ? "eduai-like-pop" : ""].join(" ")} aria-hidden="true">
        <svg
          className={size === "lg" ? "h-5 w-5" : size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4"}
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <defs>
            <linearGradient id={gradientId} x1="2" y1="3" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop className="eduai-like-stop-cyan" offset="0%" stopColor="#25f4ff" />
              <stop className="eduai-like-stop-violet" offset="49%" stopColor="#9b6cff" />
              <stop className="eduai-like-stop-pink" offset="100%" stopColor="#ff42cf" />
            </linearGradient>
          </defs>
          <path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"
            fill={liked ? `url(#${gradientId})` : "none"}
            stroke={`url(#${gradientId})`}
          />
        </svg>
      </span>
      {variant === "pill" && <span className="relative z-10">{label || (liked ? "Te gusta" : "Me gusta")}</span>}
    </button>
  );
}
