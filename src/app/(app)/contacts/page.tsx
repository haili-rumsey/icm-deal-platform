import Link from "next/link";
import { cellCls, ListHeader, rowCls, searchParam, Table } from "@/components/list-page";
import { listContacts } from "@/server/contacts";

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const sp = await searchParams;
  const q = searchParam(sp.q);
  const archived = searchParam(sp.archived) === "1";
  const rows = await listContacts({ q, archived });

  return (
    <div>
      <ListHeader title="Contacts" basePath="/contacts" newLabel="New contact" q={q} archived={archived} count={rows.length} />
      <Table head={["Name", "Company", "Title", "Email", "Phone"]} empty={rows.length === 0}>
        {rows.map((c) => (
          <tr key={c.id} className={rowCls}>
            <td className={cellCls}>
              <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                {c.lastName ? `${c.lastName}, ${c.firstName}` : c.firstName}
              </Link>
            </td>
            <td className={cellCls}>
              <Link href={`/companies/${c.companyId}`} className="text-muted hover:underline">
                {c.companyName}
              </Link>
            </td>
            <td className={`${cellCls} text-muted`}>{c.title}</td>
            <td className={`${cellCls} text-muted`}>
              {c.noEmail ? <span className="text-danger">No email</span> : c.email}
            </td>
            <td className={`${cellCls} whitespace-nowrap text-muted`}>{c.phone}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
