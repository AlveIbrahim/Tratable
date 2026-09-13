"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

/** Client-side guard for the (app) route group. The heavier authorization
 * work (does this user actually have access to this workspace/base/table)
 * is enforced server-side by WorkspaceRoleGuard regardless — this only
 * keeps a logged-out visitor from seeing an empty shell before redirecting. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return null;
  return <>{children}</>;
}
