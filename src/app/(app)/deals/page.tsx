import Link from "next/link";
import { cellCls, ListHeader, rowCls, searchParam, Table } from "@/components/list-page";
import { listDeals } from "@/server/deals";

export default async function DealsPage({ searchParams }: PageProps<"/deals">) {
  const sp = await searchParams;
  const q = searchParam(sp.q);
  const archived = searchParam(sp.archived) === "1";
  const rows = await listDeals({ q, archived });

  return (
    <div>
      <ListHeader title="Deals" basePath="/deals" newLabel="New deal" q={q} archived={archived} count={rows.length} />
      <Table head={["Deal", "Type", "Category", "Properties", "SF", "Lead analyst"]} empty={rows.length === 0}>
        {rows.map((d) => (
          <tr key={d.id} className={rowCls}>
            <td className={cellCls}>
              <Link href={`/deals/${d.id}`} className="font-medium hover:underline">
                {d.dealName}
              </Link>
              {d.isIos && <span className="ml-2 text-xs text-muted">IOS</span>}
            </td>
            <td className={`${cellCls} text-muted`}>{d.dealType}</td>
            <td className={`${cellCls} text-muted`}>{d.category}</td>
            <td className={`${cellCls} text-muted`}>{d.propertyCount}</td>
            <td className={`${cellCls} text-muted`}>{d.totalSf ? d.totalSf.toLocaleString() : ""}</td>
            <td className={`${cellCls} text-muted`}>{d.leadAnalyst}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
