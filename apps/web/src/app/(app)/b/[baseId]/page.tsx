"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTables } from "@/lib/hooks/use-tables";

export default function BaseIndexPage({ params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = use(params);
  const { data: tables } = useTables(baseId);
  const router = useRouter();

  useEffect(() => {
    if (tables && tables.length > 0) {
      router.replace(`/b/${baseId}/t/${tables[0].id}`);
    }
  }, [tables, baseId, router]);

  return <div className="p-8 text-sm text-[var(--color-muted)]">Loading tables…</div>;
}
