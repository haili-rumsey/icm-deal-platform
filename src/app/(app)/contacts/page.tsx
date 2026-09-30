import { Plus } from "lucide-react";
import { CommandBar, CommandLink, RefreshCommand } from "@/components/command-bar";
import { DataGrid } from "@/components/data-grid";
import { searchParam } from "@/lib/params";
import { listContacts } from "@/server/contacts";

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const archived = searchParam((await searchParams).archived) === "1";
  const rows = await listContacts({ archived });

  return (
    <>
      <CommandBar>
        <CommandLink href="/contacts/new" icon={Plus}>
          New
        </CommandLink>
        <RefreshCommand />
      </CommandBar>
      <DataGrid
        views={[
          { label: "Active contacts", href: "/contacts", active: !archived },
          { label: "Archived contacts", href: "/contacts?archived=1", active: archived },
        ]}
        defaultSort={{ key: "name", dir: "asc" }}
        columns={[
          { key: "name", label: "Name", kind: "link", hrefKey: "href" },
          { key: "company", label: "Company", kind: "link", hrefKey: "companyHref" },
          { key: "title", label: "Title" },
          { key: "email", label: "Email", flagKey: "noEmail", flagLabel: "No email" },
          { key: "phone", label: "Phone" },
        ]}
        rows={rows.map((c) => ({
          id: c.id,
          href: `/contacts/${c.id}`,
          name: c.lastName ? `${c.lastName}, ${c.firstName}` : c.firstName,
          company: c.companyName,
          companyHref: `/companies/${c.companyId}`,
          title: c.title,
          email: c.email,
          noEmail: c.noEmail,
          phone: c.phone,
        }))}
      />
    </>
  );
}
