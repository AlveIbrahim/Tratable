"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuthStore } from "@/lib/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import { FolderIcon, LogOutIcon } from "@/components/ui/icons";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Sidebar() {
  const { data: workspaces } = useWorkspaces();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearSession();
    window.location.href = "/login";
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[var(--color-accent)] text-[13px] font-bold text-[var(--color-accent-fg)]">
          T
        </div>
        <span className="text-[14px] font-semibold tracking-tight">Tratable</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-auto px-2.5">
        <div className="px-1.5 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
          Workspaces
        </div>
        {workspaces?.map((ws) => {
          const active = pathname.startsWith(`/w/${ws.id}`);
          return (
            <Link
              key={ws.id}
              href={`/w/${ws.id}`}
              className={clsx(
                "flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-[7px] text-[13px] transition-colors",
                active
                  ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]",
              )}
            >
              <FolderIcon width={14} height={14} className="shrink-0" />
              <span className="truncate">{ws.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[11px] font-semibold text-[var(--color-accent)]">
          {initials(user?.email ?? "")}
        </div>
        <div className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--color-fg-muted)]">{user?.email}</div>
        <button
          onClick={logout}
          title="Log out"
          className="shrink-0 rounded-[var(--radius-sm)] p-1.5 text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
        >
          <LogOutIcon width={15} height={15} />
        </button>
      </div>
    </aside>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-[var(--color-bg)]">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
