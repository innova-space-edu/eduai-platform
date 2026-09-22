"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ShareOpenClient() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => router.replace("/music"), 1200);
    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
