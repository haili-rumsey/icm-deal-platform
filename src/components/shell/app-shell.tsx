"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";

/**
 * Navy top bar, light-gray sidebar, content area — Dynamics layout in Stream colors.
 * On narrow screens the sidebar slides in from the menu button.
 */
export function AppShell({
  isAdmin,
  userLabel,
  signOut,
  children,
}: {
  isAdmin: boolean;
  userLabel: string;
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 bg-navy px-3 text-white">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded p-1.5 hover:bg-white/10 lg:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo */}
        <img src="/brand/stream-logo-white.svg" alt="Stream Realty Partners" className="h-5 w-auto" />
        <span className="hidden h-5 w-px bg-white/30 sm:block" />
        <span className="hidden text-sm font-semibold tracking-wide sm:block">ICM Deal Platform</span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden text-white/80 md:inline">{userLabel}</span>
          {signOut}
        </div>
      </header>

      <div className="flex flex-1">
        <aside
          className={`fixed inset-y-12 left-0 z-20 w-60 shrink-0 overflow-y-auto border-r border-border bg-sidebar transition-transform lg:sticky lg:top-12 lg:h-[calc(100vh-3rem)] lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
        </aside>
        {open && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-12 z-10 bg-black/20 lg:hidden"
          />
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
