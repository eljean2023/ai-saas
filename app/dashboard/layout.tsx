"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/app/contexts/AuthContext";

function DashboardGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (isAdmin) {
      router.replace("/admin/dashboard");
    }
  }, [isAuthenticated, isAdmin, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
      </div>
    );
  }

  if (!isAuthenticated || isAdmin) return null;

  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DashboardGuard>{children}</DashboardGuard>
    </AuthProvider>
  );
}
