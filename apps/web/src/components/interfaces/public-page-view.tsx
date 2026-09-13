"use client";

import { usePublicDashboard, usePublicPage, usePublicRecord, usePublicRecords, submitPublicForm } from "@/lib/hooks/use-public";
import { GridPageRenderer } from "./renderers/grid-page";
import { ListPageRenderer } from "./renderers/list-page";
import { RecordDetailPageRenderer } from "./renderers/record-detail-page";
import { DashboardPageRenderer } from "./renderers/dashboard-page";
import { FormPageRenderer } from "./renderers/form-page";

/** Dispatches a published page to its renderer by config.type — the public
 * side of the "one renderer, two mount points" split described in
 * docs/PLAN.md. The renderer components themselves have no idea whether
 * their data came from here (the public, unauthenticated route) or from
 * the authenticated builder's preview; they only ever see already-fetched
 * fields/records/config, typed against RendererField/RendererRecord. */
export function PublicPageView({
  token,
  pageSlug,
  recordId,
}: {
  token: string;
  pageSlug: string;
  recordId?: string;
}) {
  const { data: page, isLoading, isError } = usePublicPage(token, pageSlug);

  if (isLoading) return <div className="p-6 text-[13px] text-[var(--color-fg-subtle)]">Loading…</div>;
  if (isError || !page) return <div className="p-6 text-[13px] text-[var(--color-fg-subtle)]">Page not found.</div>;

  switch (page.config.type) {
    case "grid":
      return <GridRecords token={token} pageSlug={pageSlug} config={page.config} fields={page.fields} />;
    case "list":
      return <ListRecords token={token} pageSlug={pageSlug} config={page.config} fields={page.fields} />;
    case "record_detail":
      return <RecordDetail token={token} pageSlug={pageSlug} recordId={recordId} config={page.config} fields={page.fields} />;
    case "dashboard":
      return <Dashboard token={token} pageSlug={pageSlug} />;
    case "form":
      return (
        <FormPageRenderer
          config={page.config}
          fields={page.fields}
          onSubmit={(data) => submitPublicForm(token, pageSlug, data)}
        />
      );
  }
}

function GridRecords({
  token,
  pageSlug,
  config,
  fields,
}: Omit<Parameters<typeof GridPageRenderer>[0], "records"> & { token: string; pageSlug: string }) {
  const { data } = usePublicRecords(token, pageSlug);
  return <GridPageRenderer config={config} fields={fields} records={data?.records ?? []} />;
}

function ListRecords({
  token,
  pageSlug,
  config,
  fields,
}: Omit<Parameters<typeof ListPageRenderer>[0], "records"> & { token: string; pageSlug: string }) {
  const { data } = usePublicRecords(token, pageSlug);
  return <ListPageRenderer config={config} fields={fields} records={data?.records ?? []} />;
}

function RecordDetail({
  token,
  pageSlug,
  recordId,
  config,
  fields,
}: Omit<Parameters<typeof RecordDetailPageRenderer>[0], "record"> & { token: string; pageSlug: string; recordId?: string }) {
  const { data: record } = usePublicRecord(token, pageSlug, recordId);
  if (!recordId) {
    return <p className="p-6 text-[13px] text-[var(--color-fg-subtle)]">No record selected.</p>;
  }
  return <RecordDetailPageRenderer config={config} fields={fields} record={record} />;
}

function Dashboard({ token, pageSlug }: { token: string; pageSlug: string }) {
  const { data } = usePublicDashboard(token, pageSlug);
  return <DashboardPageRenderer widgets={data?.widgets ?? []} />;
}
