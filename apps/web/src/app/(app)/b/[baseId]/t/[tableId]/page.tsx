"use client";

import { use } from "react";
import { useFields } from "@/lib/hooks/use-fields";
import { DataGrid } from "@/components/grid/data-grid";

export default function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = use(params);
  const { data: fields, isLoading } = useFields(tableId);

  if (isLoading || !fields) {
    return <div className="p-8 text-sm text-[var(--color-muted)]">Loading…</div>;
  }

  return <DataGrid tableId={tableId} fields={fields} />;
}
