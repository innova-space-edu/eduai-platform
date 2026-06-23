"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type ExamFeedbackSettings = {
  showResultToStudent?: boolean;
  showFeedbackToStudent?: boolean;
  allowReview?: boolean;
};

function shouldShowDetailedFeedback(settings: ExamFeedbackSettings | null) {
  if (!settings) return true;
  return (
    settings.showResultToStudent !== false &&
    settings.showFeedbackToStudent !== false &&
    settings.allowReview !== false
  );
}

function findElementContaining(selector: string, text: string): HTMLElement | null {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return elements.find((element) => element.textContent?.includes(text)) || null;
}

function hideDetailedFeedback() {
  const loadingText = findElementContaining("p", "Preparando la retroalimentación");
  const loadingCard = loadingText?.closest<HTMLElement>(".rounded-2xl");
  if (loadingCard) loadingCard.style.display = "none";

  const detailHeading = findElementContaining("h3", "Retroalimentación por pregunta");
  const detailSection = detailHeading?.closest<HTMLElement>(".space-y-4");
  if (detailSection) detailSection.style.display = "none";

  const completedTitle = findElementContaining("p", "Retroalimentación completa");
  if (completedTitle) {
    completedTitle.textContent = "Resultado guardado";
    const completedCard = completedTitle.closest<HTMLElement>(".rounded-2xl");
    const description = completedCard
      ? Array.from(completedCard.querySelectorAll<HTMLElement>("p")).find((p) =>
          p.textContent?.includes("Has revisado todas tus preguntas"),
        )
      : null;
    if (description) {
      description.textContent =
        "Tu evaluación fue enviada correctamente. El docente decidió mostrar solo la nota final.";
    }
  }
}

export default function StudentFeedbackVisibilityGuard({
  children,
}: {
  children: ReactNode;
}) {
  const params = useParams<{ code?: string }>();
  const code = useMemo(() => {
    const value = params?.code;
    return Array.isArray(value) ? value[0] : value || "";
  }, [params]);

  const [settings, setSettings] = useState<ExamFeedbackSettings | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function loadSettings() {
      try {
        const res = await fetch("/api/agents/examen-docente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "public_exam_by_code", code }),
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.exam?.settings) {
          setSettings(data.exam.settings);
        }
      } catch {
        // Si no se puede leer la configuración, se mantiene la página normal.
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (shouldShowDetailedFeedback(settings)) return;

    const apply = () => hideDetailedFeedback();
    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [settings]);

  return <>{children}</>;
}
