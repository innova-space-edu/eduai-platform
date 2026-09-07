"use client";

import { useLayoutEffect, useRef } from "react";

function audioProPanel(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLElement>("div.fixed")).find((element) =>
    (element.textContent || "").includes("Audio Pro · Biblioteca y mezcla"),
  );
}

function audioProLauncher(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button.fixed")).find((button) =>
    (button.textContent || "").trim().includes("Audio Pro"),
  );
}

export default function MultimediaAudioProDockController() {
  const defaultClosedApplied = useRef(false);

  useLayoutEffect(() => {
    const syncAudioPro = () => {
      const root = document.querySelector<HTMLElement>(".multimedia-responsive-shell");
      if (!root) return;

      if (!defaultClosedApplied.current) {
        const panel = audioProPanel(root);
        const closeButton = panel
          ? Array.from(panel.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
              button.title === "Contraer" || button.title === "Cerrar",
            )
          : null;

        if (closeButton) {
          defaultClosedApplied.current = true;
          closeButton.click();
          return;
        }
      }

      const launcher = audioProLauncher(root);
      if (launcher) launcher.classList.add("eduai-audio-pro-side-launcher");
    };

    syncAudioPro();
    const observer = new MutationObserver(syncAudioPro);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <style jsx global>{`
      .eduai-audio-pro-side-launcher {
        top: 50% !important;
        right: 0 !important;
        bottom: auto !important;
        width: 44px !important;
        min-width: 44px !important;
        min-height: 118px !important;
        padding: 12px 8px !important;
        transform: translateY(-50%) !important;
        flex-direction: column !important;
        justify-content: center !important;
        gap: 8px !important;
        border-radius: 16px 0 0 16px !important;
        font-size: 0 !important;
        box-shadow: -8px 10px 28px rgba(0, 0, 0, 0.35) !important;
      }

      .eduai-audio-pro-side-launcher::after {
        content: "Audio Pro";
        display: block;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.03em;
        line-height: 1;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
      }

      .eduai-audio-pro-side-launcher svg {
        flex: 0 0 auto;
      }

      @media (max-width: 767px) {
        .eduai-audio-pro-side-launcher {
          top: 58% !important;
          width: 40px !important;
          min-width: 40px !important;
          min-height: 104px !important;
          padding: 10px 7px !important;
        }
      }
    `}</style>
  );
}
