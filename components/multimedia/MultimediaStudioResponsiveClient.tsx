"use client";

import { useEffect, useRef } from "react";
import MultimediaStudioV3Client from "@/components/multimedia/MultimediaStudioV3Client";

function findTimelineElements(root: HTMLElement) {
  const sections = Array.from(root.querySelectorAll("section"));
  const timelineSection = sections.find((section) => section.textContent?.includes("Línea de tiempo"));
  if (!timelineSection) return null;

  const scroll = Array.from(timelineSection.querySelectorAll<HTMLDivElement>("div")).find((element) =>
    element.classList.contains("overflow-x-auto"),
  );
  if (!scroll) return null;

  const playhead = Array.from(timelineSection.querySelectorAll<HTMLDivElement>("div")).find((element) =>
    element.classList.contains("bg-rose-400") && element.classList.contains("w-px"),
  );
  if (!playhead) return null;

  return { scroll, playhead };
}

export default function MultimediaStudioResponsiveClient() {
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;

    let mutationObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let playheadObserver: MutationObserver | null = null;
    let currentScroll: HTMLDivElement | null = null;
    let currentPlayhead: HTMLDivElement | null = null;
    let manualNavigationUntil = 0;
    let raf = 0;

    const followPlayhead = () => {
      if (!currentScroll || !currentPlayhead) return;
      if (performance.now() < manualNavigationUntil) return;

      const left = Number.parseFloat(currentPlayhead.style.left || "0");
      if (!Number.isFinite(left)) return;

      const viewport = currentScroll.clientWidth;
      if (viewport <= 0) return;

      const relative = left - currentScroll.scrollLeft;
      const safeLeft = viewport * 0.22;
      const safeRight = viewport * 0.72;
      if (relative >= safeLeft && relative <= safeRight) return;

      const target = Math.max(0, left - viewport * 0.34);
      currentScroll.scrollTo({ left: target, behavior: "auto" });
    };

    const scheduleFollow = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(followPlayhead);
    };

    const markManualNavigation = () => {
      manualNavigationUntil = performance.now() + 1100;
    };

    const connect = () => {
      const found = findTimelineElements(root);
      if (!found) return;
      if (currentScroll === found.scroll && currentPlayhead === found.playhead) return;

      if (currentScroll) {
        currentScroll.removeEventListener("wheel", markManualNavigation);
        currentScroll.removeEventListener("pointerdown", markManualNavigation);
        currentScroll.removeEventListener("touchstart", markManualNavigation);
      }
      playheadObserver?.disconnect();
      resizeObserver?.disconnect();

      currentScroll = found.scroll;
      currentPlayhead = found.playhead;
      currentScroll.addEventListener("wheel", markManualNavigation, { passive: true });
      currentScroll.addEventListener("pointerdown", markManualNavigation, { passive: true });
      currentScroll.addEventListener("touchstart", markManualNavigation, { passive: true });

      playheadObserver = new MutationObserver(scheduleFollow);
      playheadObserver.observe(currentPlayhead, { attributes: true, attributeFilter: ["style"] });

      resizeObserver = new ResizeObserver(scheduleFollow);
      resizeObserver.observe(currentScroll);
      scheduleFollow();
    };

    mutationObserver = new MutationObserver(connect);
    mutationObserver.observe(root, { childList: true, subtree: true });
    connect();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      mutationObserver?.disconnect();
      playheadObserver?.disconnect();
      resizeObserver?.disconnect();
      if (currentScroll) {
        currentScroll.removeEventListener("wheel", markManualNavigation);
        currentScroll.removeEventListener("pointerdown", markManualNavigation);
        currentScroll.removeEventListener("touchstart", markManualNavigation);
      }
    };
  }, []);

  return (
    <div ref={shellRef} className="multimedia-responsive-shell">
      <MultimediaStudioV3Client />
      <style>{`
        .multimedia-responsive-shell > div > .mx-auto.grid {
          width: 100%;
          max-width: 2560px !important;
          grid-template-columns: 260px minmax(0, 1fr) 280px !important;
          align-items: start;
        }

        .multimedia-responsive-shell > div > header > .mx-auto,
        .multimedia-responsive-shell > div > .mx-auto.grid {
          width: 100%;
        }

        .multimedia-responsive-shell > div > .mx-auto.grid > main {
          min-width: 0;
        }

        .multimedia-responsive-shell > div > .mx-auto.grid > aside {
          min-width: 0;
        }

        .multimedia-responsive-shell > div > .mx-auto.grid > aside:first-of-type,
        .multimedia-responsive-shell > div > .mx-auto.grid > aside:last-of-type {
          position: sticky;
          top: 72px;
          max-height: calc(100dvh - 84px);
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
        }

        .multimedia-responsive-shell main > section:first-of-type > div:nth-of-type(2) > div {
          max-width: 1100px !important;
        }

        .multimedia-responsive-shell main section {
          min-width: 0;
        }

        @media (min-width: 1920px) {
          .multimedia-responsive-shell > div > .mx-auto.grid {
            grid-template-columns: 340px minmax(900px, 1fr) 340px !important;
            gap: 16px !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .multimedia-responsive-shell main > section:first-of-type > div:nth-of-type(2) > div {
            max-width: 1320px !important;
          }
        }

        @media (min-width: 2560px) {
          .multimedia-responsive-shell > div > .mx-auto.grid {
            grid-template-columns: 400px minmax(1200px, 1fr) 420px !important;
            gap: 20px !important;
            padding: 20px !important;
          }

          .multimedia-responsive-shell main > section:first-of-type > div:nth-of-type(2) > div {
            max-width: 1540px !important;
          }
        }

        @media (min-width: 1280px) and (max-width: 1535px) {
          .multimedia-responsive-shell > div > .mx-auto.grid {
            grid-template-columns: 230px minmax(0, 1fr) 255px !important;
            gap: 8px !important;
            padding: 8px !important;
          }

          .multimedia-responsive-shell > div > .mx-auto.grid > aside {
            padding: 10px !important;
          }

          .multimedia-responsive-shell main > section:first-of-type > div:nth-of-type(2) > div {
            max-width: 920px !important;
          }
        }

        @media (min-width: 768px) and (max-width: 1279px) {
          .multimedia-responsive-shell > div > .mx-auto.grid {
            grid-template-columns: 230px minmax(0, 1fr) !important;
            gap: 10px !important;
            padding: 10px !important;
          }

          .multimedia-responsive-shell > div > .mx-auto.grid > aside:first-of-type {
            grid-column: 1;
            grid-row: 1;
            position: static;
            max-height: none;
            overflow: visible;
          }

          .multimedia-responsive-shell > div > .mx-auto.grid > main {
            grid-column: 2;
            grid-row: 1 / span 2;
          }

          .multimedia-responsive-shell > div > .mx-auto.grid > aside:last-of-type {
            grid-column: 1;
            grid-row: 2;
            position: static;
            max-height: none;
            overflow: visible;
          }
        }

        @media (max-width: 767px) {
          .multimedia-responsive-shell > div > header {
            position: relative !important;
          }

          .multimedia-responsive-shell > div > header > .mx-auto {
            padding: 8px !important;
          }

          .multimedia-responsive-shell > div > header > .mx-auto > div:nth-child(3) {
            min-width: 150px !important;
          }

          .multimedia-responsive-shell > div > .mx-auto.grid {
            display: flex !important;
            flex-direction: column;
            gap: 8px !important;
            padding: 8px !important;
          }

          .multimedia-responsive-shell > div > .mx-auto.grid > main {
            order: 1;
            width: 100%;
          }

          .multimedia-responsive-shell > div > .mx-auto.grid > aside:first-of-type {
            order: 2;
            width: 100%;
          }

          .multimedia-responsive-shell > div > .mx-auto.grid > aside:last-of-type {
            order: 3;
            width: 100%;
          }

          .multimedia-responsive-shell > div > .mx-auto.grid > aside {
            position: static !important;
            max-height: none !important;
            overflow: visible !important;
          }

          .multimedia-responsive-shell main > section {
            padding: 8px !important;
            border-radius: 12px !important;
          }

          .multimedia-responsive-shell main > section:first-of-type > div:first-child {
            align-items: flex-start !important;
            flex-direction: column;
          }

          .multimedia-responsive-shell main > section:first-of-type > div:first-child > div:last-child {
            width: 100%;
            flex-wrap: wrap;
          }

          .multimedia-responsive-shell main > section:first-of-type > div:nth-of-type(2) > div {
            max-width: 100% !important;
          }

          .multimedia-responsive-shell main > section:nth-of-type(2) > div:first-child {
            gap: 4px !important;
          }

          .multimedia-responsive-shell main > section:nth-of-type(2) > div:first-child button {
            min-height: 34px;
          }

          .multimedia-responsive-shell main > section:nth-of-type(2) > p {
            line-height: 1.45;
          }
        }
      `}</style>
    </div>
  );
}
