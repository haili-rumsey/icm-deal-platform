"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Contact, Handshake, MapPin, Search, type LucideIcon } from "lucide-react";
import { suggestAction } from "@/app/(app)/search/actions";
import type { SearchResults } from "@/server/search";

type Item = { key: string; href: string; icon: LucideIcon; kind: string; title: string; detail?: string };

function items(r: SearchResults): Item[] {
  return [
    ...r.deals.map((d) => ({ key: `d${d.id}`, href: `/deals/${d.id}`, icon: Handshake, kind: "Deal", title: d.name, detail: d.stage })),
    ...r.properties.map((p) => ({ key: `p${p.id}`, href: `/properties/${p.id}`, icon: MapPin, kind: "Property", title: p.title, detail: p.place })),
    ...r.companies.map((c) => ({ key: `c${c.id}`, href: `/companies/${c.id}`, icon: Building2, kind: "Company", title: c.name, detail: c.domain ?? undefined })),
    ...r.contacts.map((c) => ({ key: `k${c.id}`, href: `/contacts/${c.id}`, icon: Contact, kind: "Contact", title: c.name, detail: c.company })),
  ];
}

/**
 * The top bar's search: suggestions drop down as you type (click one to go
 * straight there); Enter opens the full results page. "/" jumps to the box.
 */
export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [list, setList] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close when the page changes or on a click elsewhere.
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }
  useEffect(() => {
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (e.key === "/" && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function change(value: string) {
    setQ(value);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setList([]);
      setLoading(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    // Wait for a pause in typing; ignore answers to searches that have since changed.
    timer.current = setTimeout(async () => {
      const mine = ++request.current;
      const r = await suggestAction(value);
      if (mine !== request.current) return;
      setList(items(r));
      setLoading(false);
    }, 200);
  }

  function go(href: string) {
    setOpen(false);
    input.current?.blur();
    router.push(href);
  }
  const allResults = () => go(`/search?q=${encodeURIComponent(q.trim())}`);

  const showMenu = open && q.trim().length >= 2;
  return (
    <div ref={box} className="relative w-full max-w-md">
      <label className="flex items-center gap-2 rounded bg-white/10 px-2.5 py-1 text-white focus-within:bg-white focus-within:text-foreground">
        <Search size={16} className="shrink-0 opacity-80" />
        <input
          ref={input}
          value={q}
          onChange={(e) => change(e.target.value)}
          onFocus={() => q.trim().length >= 2 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, list.length));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, -1));
            } else if (e.key === "Enter" && q.trim().length >= 2) {
              e.preventDefault();
              if (active >= 0 && active < list.length) go(list[active].href);
              else allResults();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search deals, properties, companies, people"
          aria-label="Search"
          role="combobox"
          aria-expanded={showMenu}
          aria-controls="search-suggestions"
          aria-activedescendant={active >= 0 ? `search-option-${active}` : undefined}
          className="w-full bg-transparent text-sm outline-none placeholder:text-white/70 focus:placeholder:text-muted"
        />
      </label>
      {showMenu && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-[70vh] overflow-y-auto rounded-md border border-border bg-card py-1 text-sm text-foreground shadow-lg"
        >
          {list.map((it, i) => (
            <li
              key={it.key}
              id={`search-option-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(it.href);
              }}
              className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 ${i === active ? "bg-hover" : ""}`}
            >
              <it.icon size={16} strokeWidth={1.75} className="shrink-0 text-navy" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{it.title}</span>
                <span className="block truncate text-xs text-muted">
                  {it.kind}
                  {it.detail ? ` · ${it.detail}` : ""}
                </span>
              </span>
            </li>
          ))}
          {!loading && list.length === 0 && <li className="px-3 py-2 text-muted">No matches.</li>}
          {loading && list.length === 0 && <li className="px-3 py-2 text-muted">Searching…</li>}
          <li
            id={`search-option-${list.length}`}
            role="option"
            aria-selected={active === list.length}
            onMouseEnter={() => setActive(list.length)}
            onMouseDown={(e) => {
              e.preventDefault();
              allResults();
            }}
            className={`cursor-pointer border-t border-border px-3 py-2 text-link ${active === list.length ? "bg-hover" : ""}`}
          >
            See all results for “{q.trim()}”
          </li>
        </ul>
      )}
    </div>
  );
}
