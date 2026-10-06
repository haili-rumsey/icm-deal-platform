"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Building2, CircleCheck, Contact, Handshake, Map as MapIcon, MapPin, Pin, PinOff, Presentation, UserCog, UsersRound, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; match?: (path: string) => boolean };

/** Active owns the deal pages themselves (/deals, /deals/new, /deals/<id>). */
const isActiveDeals = (p: string) => p.startsWith("/deals") && !p.startsWith("/deals/closed") && !p.startsWith("/deals/archive");
type Group = { heading: string; items: Item[] };

const GROUPS: Group[] = [
  {
    heading: "Pipeline",
    items: [
      { href: "/deals", label: "Active", icon: Handshake, match: isActiveDeals },
      { href: "/deals/closed", label: "Closed", icon: CircleCheck },
      { href: "/deals/archive", label: "Archive", icon: Archive },
    ],
  },
  {
    heading: "Reports",
    items: [{ href: "/reports/pipeline", label: "Pipeline", icon: Presentation }],
  },
  {
    heading: "Records",
    items: [
      { href: "/properties", label: "Properties", icon: MapPin },
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/contacts", label: "Contacts", icon: Contact },
    ],
  },
];

const ADMIN: Group = {
  heading: "Admin",
  items: [
    { href: "/admin/users", label: "Users", icon: UserCog },
    { href: "/admin/teams", label: "Manage teams", icon: UsersRound },
    { href: "/admin/geography", label: "Geography", icon: MapIcon },
  ],
};

export function Sidebar({
  isAdmin,
  compact = false,
  pinned = true,
  onTogglePin,
  onNavigate,
}: {
  isAdmin: boolean;
  /** Wide screens only: icons without labels (the unpinned strip). */
  compact?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = isAdmin ? [...GROUPS, ADMIN] : GROUPS;
  // Labels hide only at desktop width; the phone slide-in menu always shows them.
  const hideWhenCompact = compact ? "lg:hidden" : "";

  return (
    <nav aria-label="Main" className="flex flex-col gap-5 pt-2 pb-4">
      {onTogglePin && (
        <div className={`-mb-3 hidden lg:flex ${compact ? "justify-center" : "justify-end px-2"}`}>
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={pinned ? "Unpin sidebar (show icons only)" : "Pin sidebar open"}
            title={pinned ? "Unpin sidebar (show icons only)" : "Pin sidebar open"}
            className="rounded p-1.5 text-muted hover:bg-hover hover:text-navy"
          >
            {pinned ? <PinOff size={16} strokeWidth={1.75} /> : <Pin size={16} strokeWidth={1.75} />}
          </button>
        </div>
      )}
      {groups.map((g) => (
        <div key={g.heading}>
          <p className={`px-4 pb-1 text-xs font-bold whitespace-nowrap text-muted ${hideWhenCompact}`}>{g.heading}</p>
          {compact && <hr className="mx-3 mb-1 hidden border-border lg:block" />}
          <ul>
            {g.items.map(({ href, label, icon: Icon, match }) => {
              const active = match ? match(pathname) : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    aria-label={compact ? label : undefined}
                    title={compact ? label : undefined}
                    className={`relative flex items-center gap-3 px-4 py-2 text-sm whitespace-nowrap ${
                      active ? "bg-card font-semibold text-navy" : "text-foreground hover:bg-hover"
                    }`}
                  >
                    {active && <span className="absolute inset-y-1 left-0 w-1 rounded-r bg-navy" />}
                    <Icon size={18} strokeWidth={1.75} className={`shrink-0 ${active ? "text-navy" : "text-muted"}`} />
                    <span className={hideWhenCompact}>{label}</span>
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
