"use client";

interface WidgetGroup {
  bucket: unknown;
  value: number | string;
  label: string;
}

interface ComputedWidget {
  type: "number" | "bar" | "line" | "pie";
  aggregation: { fn: "count" | "sum" | "avg" | "min" | "max"; fieldId?: string };
  value?: number | string;
  groups?: WidgetGroup[];
}

/** No charting library is pinned for this project (see docs/PLAN.md's
 * dependency table) — a handful of CSS bars renders every widget shape
 * (count, sum/avg/min/max, optionally grouped) without pulling one in just
 * for this. Data arrives pre-aggregated from PublicService.getDashboard —
 * this component only ever formats and lays out numbers, never touches raw
 * records. */
export function DashboardPageRenderer({ widgets }: { widgets: ComputedWidget[] }) {
  if (widgets.length === 0) {
    return <p className="p-6 text-[13px] text-[var(--color-fg-subtle)]">This dashboard has no widgets yet.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
      {widgets.map((w, idx) => (
        <div key={idx} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">
            {w.aggregation.fn}
            {w.aggregation.fieldId ? "" : " of records"}
          </div>
          {w.groups ? <GroupedBars groups={w.groups} /> : <BigNumber value={w.value} />}
        </div>
      ))}
    </div>
  );
}

function BigNumber({ value }: { value: number | string | undefined }) {
  const n = Number(value ?? 0);
  const formatted = Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
  return <div className="text-[28px] font-semibold">{formatted}</div>;
}

function GroupedBars({ groups }: { groups: WidgetGroup[] }) {
  const max = Math.max(1, ...groups.map((g) => Number(g.value)));
  return (
    <div className="space-y-1.5">
      {groups.map((g, idx) => {
        const n = Number(g.value);
        const pct = Math.max(2, (n / max) * 100);
        return (
          <div key={idx} className="flex items-center gap-2 text-[12.5px]">
            <div className="w-24 shrink-0 truncate text-[var(--color-fg-muted)]">{g.label}</div>
            <div className="h-4 flex-1 overflow-hidden rounded bg-[var(--color-surface)]">
              <div className="h-full rounded bg-[var(--color-accent)]" style={{ width: `${pct}%` }} />
            </div>
            <div className="w-10 shrink-0 text-right font-medium">{Number.isInteger(n) ? n : n.toFixed(1)}</div>
          </div>
        );
      })}
    </div>
  );
}
