"use client";

import { useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";

/**
 * Navy top bar, light-gray sidebar, content area — Dynamics layout in Stream colors.
 * On narrow screens the sidebar slides in from the menu button. On wide screens it
 * can be unpinned to a strip of icons (more room for list columns); hovering the
 * strip slides the full menu out over the page, and it tucks back once you pick.
 */
export function AppShell({
  isAdmin,
  userLabel,
  signOut,
  sidebarPinned,
  children,
}: {
  isAdmin: boolean;
  userLabel: string;
  signOut: React.ReactNode;
  /** From the sidebar cookie, so the page renders the right width with no flash. */
  sidebarPinned: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(sidebarPinned);
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function togglePin() {
    const next = !pinned;
    setPinned(next);
    setPeek(false);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "pinned" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
  }
  function startPeek() {
    if (pinned) return;
    // A short delay so the menu doesn't flash open when the mouse just passes over it.
    peekTimer.current = setTimeout(() => setPeek(true), 120);
  }
  function endPeek() {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    setPeek(false);
  }

  // Wide screens: icons only while unpinned and not hovered.
  const compact = !pinned && !peek;

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
        {/* The aside holds the space in the layout; the panel inside can grow over the page while peeking. */}
        <aside
          className={`fixed inset-y-12 left-0 z-20 w-60 shrink-0 transition-transform lg:sticky lg:top-12 lg:h-[calc(100vh-3rem)] lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          } ${pinned ? "lg:w-60" : "lg:w-14"}`}
          onMouseEnter={startPeek}
          onMouseLeave={endPeek}
          onFocus={() => !pinned && setPeek(true)}
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && endPeek()}
        >
          <div
            className={`h-full w-60 overflow-x-hidden overflow-y-auto border-r border-border bg-sidebar lg:absolute lg:inset-y-0 lg:left-0 ${
              compact ? "lg:w-14" : "lg:w-60"
            } ${peek ? "lg:shadow-xl" : ""}`}
          >
            <Sidebar
              isAdmin={isAdmin}
              compact={compact}
              pinned={pinned}
              onTogglePin={togglePin}
              onNavigate={() => {
                setOpen(false);
                endPeek();
              }}
            />
          </div>
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
