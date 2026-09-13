"use client";

import { use } from "react";
import Link from "next/link";
import { usePublicInterface } from "@/lib/hooks/use-public";
import { PublicPageView } from "@/components/interfaces/public-page-view";

/** The entire public surface of a published interface lives at
 * /s/:token[/:pageSlug[/:recordId]] — no auth, gated only by the token.
 * With no page segment, this shows the first page (interfaces almost
 * always have one primary page a share link should just open on).
 * :recordId is only meaningful for a record_detail page in "url_param"
 * selector mode. */
export default function PublicInterfacePage({
  params,
}: {
  params: Promise<{ token: string; page?: string[] }>;
}) {
  const { token, page } = use(params);
  const { data: iface, isLoading, isError } = usePublicInterface(token);

  if (isLoading) {
    return <div className="p-8 text-center text-[13px] text-[var(--color-fg-subtle)]">Loading…</div>;
  }
  if (isError || !iface) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-1 text-center">
        <p className="text-[15px] font-medium">This link isn&apos;t available</p>
        <p className="text-[13px] text-[var(--color-fg-subtle)]">It may have been unpublished or the link is wrong.</p>
      </div>
    );
  }

  const [pageSlug, recordId] = page ?? [];
  const activeSlug = pageSlug ?? iface.pages[0]?.slug;

  if (!activeSlug) {
    return <div className="p-8 text-center text-[13px] text-[var(--color-fg-subtle)]">This interface has no pages yet.</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {iface.pages.length > 1 && (
        <nav className="flex items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
          <span className="mr-2 text-[13.5px] font-semibold">{iface.name}</span>
          {iface.pages.map((p) => (
            <Link
              key={p.id}
              href={`/s/${token}/${p.slug}`}
              className={`rounded-[var(--radius-sm)] px-2.5 py-1 text-[12.5px] font-medium ${
                p.slug === activeSlug
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </nav>
      )}
      <PublicPageView token={token} pageSlug={activeSlug} recordId={recordId} />
    </div>
  );
}
