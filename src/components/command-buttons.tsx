"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw, type LucideIcon } from "lucide-react";
import { commandItemCls } from "./command-styles";

export function CommandButton({
  icon: Icon,
  children,
  danger,
  ...props
}: { icon: LucideIcon; children: React.ReactNode; danger?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className={`${commandItemCls} ${danger ? "text-danger" : ""}`}>
      <Icon size={16} strokeWidth={1.75} className={danger ? "text-danger" : "text-navy"} />
      {children}
    </button>
  );
}

export function RefreshCommand() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <CommandButton icon={RefreshCw} disabled={pending} onClick={() => start(() => router.refresh())}>
      {pending ? "Refreshing…" : "Refresh"}
    </CommandButton>
  );
}
