"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Contact, Handshake, MapPin, UserCog, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };
type Group = { heading: string; items: Item[] };

const GROUPS: Group[] = [
  { heading: "Pipeline", items: [{ href: "/deals", label: "Deals", icon: Handshake }] },
  {
    heading: "Records",
    items: [
      { href: "/properties", label: "Properties", icon: MapPin },
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/contacts", label: "Contacts", icon: Contact },
    ],
  },
];

const ADMIN: Group = { heading: "Admin", items: [{ href: "/admin/users", label: "Users", icon: UserCog }] };

export function Sidebar({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = isAdmin ? [...GROUPS, ADMIN] : GROUPS;

  return (
    <nav aria-label="Main" className="flex flex-col gap-5 py-4">
      {groups.map((g) => (
        <div key={g.heading}>
          <p className="px-4 pb-1 text-xs font-bold text-muted">{g.heading}</p>
          <ul>
            {g.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-3 px-4 py-2 text-sm ${
                      active ? "bg-card font-semibold text-navy" : "text-foreground hover:bg-hover"
                    }`}
                  >
                    {active && <span className="absolute inset-y-1 left-0 w-1 rounded-r bg-navy" />}
                    <Icon size={18} strokeWidth={1.75} className={active ? "text-navy" : "text-muted"} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
