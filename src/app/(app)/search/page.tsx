import Link from "next/link";
import { Building2, Contact, Handshake, MapPin, type LucideIcon } from "lucide-react";
import { RefreshCommand, CommandBar } from "@/components/command-bar";
import { FlagMark } from "@/components/data-grid";
import { BackCommand } from "@/components/record-page";
import { requireUser } from "@/auth";
import { searchParam } from "@/lib/params";
import { search } from "@/server/search";

const LIMIT = 50;

function Group({ title, icon: Icon, count, children }: { title: string; icon: LucideIcon; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-border px-5 py-3 font-serif text-base text-navy">
        <Icon size={18} strokeWidth={1.75} />
        {title}
        <span className="font-sans text-sm text-muted">
          ({count}
          {count >= LIMIT ? "+" : ""})
        </span>
      </h2>
      {count === 0 ? <p className="px-5 py-4 text-sm text-muted">No matches.</p> : <ul className="divide-y divide-border">{children}</ul>}
    </section>
  );
}

function Hit({ href, title, detail, archived, why }: { href: string; title: string; detail?: string | null; archived?: boolean; why?: string[] }) {
  return (
    <li className="px-5 py-2.5 text-sm">
      <Link href={href} className="font-semibold text-link hover:underline">
        {title}
      </Link>
      {archived && <FlagMark label="Archived" />}
      {detail && <span className="ml-2 text-muted">{detail}</span>}
      {why && why.length > 0 && <p className="mt-0.5 text-xs text-muted">Found by {why.join(" · ")}</p>}
    </li>
  );
}

/**
 * Full results for the top-bar search, grouped by kind. An address brings in every
 * deal its property was part of; a company brings in every deal it was a party to.
 */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  await requireUser();
  const q = (searchParam((await searchParams).q) ?? "").trim();
  const r = await search(q, LIMIT);

  return (
    <>
      <CommandBar>
        <BackCommand fallbackHref="/deals" />
        <RefreshCommand />
      </CommandBar>
      <div className="flex flex-col gap-4 p-3 sm:p-5">
        <h1 className="font-serif text-lg">{q.length >= 2 ? <>Search results for “{q}”</> : "Type at least two characters in the search box above."}</h1>
        {q.length >= 2 && (
          <>
            <Group title="Deals" icon={Handshake} count={r.deals.length}>
              {r.deals.map((d) => (
                <Hit key={d.id} href={`/deals/${d.id}`} title={d.name} detail={[d.stage, d.type].filter(Boolean).join(" · ")} why={d.why} />
              ))}
            </Group>
            <Group title="Properties" icon={MapPin} count={r.properties.length}>
              {r.properties.map((p) => (
                <Hit key={p.id} href={`/properties/${p.id}`} title={p.title} detail={p.place} archived={p.archived} />
              ))}
            </Group>
            <Group title="Companies" icon={Building2} count={r.companies.length}>
              {r.companies.map((c) => (
                <Hit key={c.id} href={`/companies/${c.id}`} title={c.name} detail={c.domain} archived={c.archived} />
              ))}
            </Group>
            <Group title="Contacts" icon={Contact} count={r.contacts.length}>
              {r.contacts.map((c) => (
                <Hit key={c.id} href={`/contacts/${c.id}`} title={c.name} detail={[c.company, c.email].filter(Boolean).join(" · ")} archived={c.archived} />
              ))}
            </Group>
          </>
        )}
      </div>
    </>
  );
}
