"use client";

import { AuthGuard } from "@/components/auth-guard";
import { AppNav, SidebarNav } from "@/components/layout/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <SidebarNav />
        <main className="flex-1 pb-20 md:pb-0">
          <div className="mx-auto max-w-4xl p-4 md:p-6 md:max-w-5xl">
            {children}
          </div>
        </main>
        <AppNav />
      </div>
    </AuthGuard>
  );
}
