import Link from "next/link";
import { cellCls, ListHeader, rowCls, searchParam, Table } from "@/components/list-page";
import { listCompanies } from "@/server/companies";

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const sp = await searchParams;
  const q = searchParam(sp.q);
  const archived = searchParam(sp.archived) === "1";
  const rows = await listCompanies({ q, archived });

  return (
    <div>
      <ListHeader title="Companies" basePath="/companies" newLabel="New company" q={q} archived={archived} count={rows.length} />
      <Table head={["Name", "Website", "Type", "Contacts"]} empty={rows.length === 0}>
        {rows.map((c) => (
          <tr key={c.id} className={rowCls}>
            <td className={cellCls}>
              <Link href={`/companies/${c.id}`} className="font-medium hover:underline">
                {c.name}
              </Link>
            </td>
            <td className={`${cellCls} text-muted`}>
              {c.noWebsite ? <span className="text-danger">No website</span> : c.websiteDomain}
            </td>
            <td className={`${cellCls} text-muted`}>{c.types.join(", ")}</td>
            <td className={`${cellCls} text-muted`}>{c.contactCount}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
