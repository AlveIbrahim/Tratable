"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";

function Sidebar() {
  const { data: workspaces } = useWorkspaces();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearSession();
    window.location.href = "/login";
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-border)] p-3">
      <div className="mb-4 px-1 text-sm font-semibold">Tratable</div>
      <nav className="flex-1 space-y-1">
        {workspaces?.map((ws) => (
          <Link
            key={ws.id}
            href={`/w/${ws.id}`}
            className="block rounded px-2 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            {ws.name}
          </Link>
        ))}
      </nav>
      <div className="border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-muted)]">
        <div className="truncate px-1">{user?.email}</div>
        <button onClick={logout} className="mt-1 px-1 text-left hover:underline">
          Log out
        </button>
      </div>
    </aside>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
