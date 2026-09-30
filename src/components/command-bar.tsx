import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { commandItemCls } from "./command-styles";

/** The strip of actions along the top of every page, as in Dynamics. */
export function CommandBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-12 z-10 border-b border-border bg-card">
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-1.5 sm:px-5">{children}</div>
    </div>
  );
}

export function CommandLink({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Link href={href} className={commandItemCls}>
      <Icon size={16} strokeWidth={1.75} className="text-navy" />
      {children}
    </Link>
  );
}

export function CommandDivider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

export { CommandButton, RefreshCommand } from "./command-buttons";
