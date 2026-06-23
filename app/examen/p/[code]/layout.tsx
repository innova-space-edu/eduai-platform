import type { ReactNode } from "react";
import StudentFeedbackVisibilityGuard from "@/components/exam/StudentFeedbackVisibilityGuard";
import ExamLatexAnswerFix from "@/components/exam/ExamLatexAnswerFix";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <StudentFeedbackVisibilityGuard>
      <ExamLatexAnswerFix />
      {children}
    </StudentFeedbackVisibilityGuard>
  );
}
