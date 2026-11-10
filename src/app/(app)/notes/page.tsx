import { requireUser } from "@/auth";
import { RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { shortDay } from "@/components/data-grid-filters";
import { attribution } from "@/domain/notes";
import { searchParam } from "@/lib/params";
import { contactIdForEmail } from "@/server/contacts";
import { myListLayout } from "@/server/list-layouts";
import { listNotes } from "@/server/notes";

/**
 * Every note in one list (PRD §5). "My notes" filters on the author, so each person sees
 * every note that is theirs — including ones someone else entered for them. Add notes from a
 * company, deal or contact page; click a company or deal here to open it.
 */
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const mine = searchParam(sp.view) === "mine";
  const [all, saved, me] = await Promise.all([listNotes(), myListLayout("notes"), contactIdForEmail(user.email)]);
  const rows = mine ? all.filter((n) => n.authorId && n.authorId === me) : all;
  const day = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Chicago" });

  return (
    <DataGrid
      commands={<RefreshCommand />}
      views={[
        { label: "All notes", href: "/notes", active: !mine },
        { label: "My notes", href: "/notes?view=mine", active: mine },
      ]}
      listKey="notes"
      savedColumns={saved}
      defaultSort={{ key: "logged", dir: "desc" }}
      emptyText={mine ? "No notes with you as the author yet." : "No notes yet."}
      columns={[
        { key: "loggedLabel", label: "Logged", sortKey: "logged", type: "date" },
        { key: "subject", label: "Subject" },
        { key: "author", label: "Author" },
        { key: "company", label: "Company", kind: "link", hrefKey: "companyHref" },
        { key: "deal", label: "Deal", kind: "link", hrefKey: "dealHref" },
        { key: "contact", label: "Contact" },
        { key: "source", label: "Source" },
        { key: "body", label: "Note" },
        { key: "enteredBy", label: "Entered by", defaultHidden: true },
      ]}
      rows={rows.map((n) => ({
        id: n.id,
        logged: day(n.loggedAt),
        loggedLabel: shortDay(day(n.loggedAt)),
        subject: n.subject,
        author: attribution(n),
        company: n.companyName,
        companyHref: `/companies/${n.companyId}?tab=notes`,
        deal: n.dealName,
        dealHref: n.dealId ? `/deals/${n.dealId}?tab=notes` : null,
        contact: n.contactName,
        source: n.source,
        body: n.body,
        enteredBy: n.enteredByName,
      }))}
    />
  );
}
