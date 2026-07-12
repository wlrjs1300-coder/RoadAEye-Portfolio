"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/app/hooks/usePageTitle";

export default function RootPage() {
  usePageTitle("");
  const router = useRouter();

  useEffect(() => {
    router.replace("/main");
  }, [router]);

  return null;
}
