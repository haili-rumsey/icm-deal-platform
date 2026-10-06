/**
 * Remembers whether the sidebar is pinned open ("pinned") or icons-only ("collapsed").
 * Its own module so the server layout can read it — a constant exported from a
 * "use client" file arrives on the server as a client reference, not the string.
 */
export const SIDEBAR_COOKIE = "icm-sidebar";
