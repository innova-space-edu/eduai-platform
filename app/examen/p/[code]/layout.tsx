import type { ReactNode } from "react";
import StudentFeedbackVisibilityGuard from "@/components/exam/StudentFeedbackVisibilityGuard";

export default function Layout({ children }: { children: ReactNode }) {
  return <StudentFeedbackVisibilityGuard>{children}</StudentFeedbackVisibilityGuard>;
}
