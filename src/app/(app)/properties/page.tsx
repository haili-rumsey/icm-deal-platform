import Link from "next/link";
import { cellCls, ListHeader, rowCls, searchParam, Table } from "@/components/list-page";
import { listProperties } from "@/server/properties";

export default async function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  const sp = await searchParams;
  const q = searchParam(sp.q);
  const archived = searchParam(sp.archived) === "1";
  const rows = await listProperties({ q, archived });

  return (
    <div>
      <ListHeader title="Properties" basePath="/properties" newLabel="New property" q={q} archived={archived} count={rows.length} />
      <Table head={["Address", "City", "SF", "Deals"]} empty={rows.length === 0}>
        {rows.map((p) => (
          <tr key={p.id} className={rowCls}>
            <td className={cellCls}>
              <Link href={`/properties/${p.id}`} className="font-medium hover:underline">
                {[p.address, p.buildingDesignation].filter(Boolean).join(", ") || "(no address)"}
              </Link>
              {!p.addressVerified && <span className="ml-2 text-xs text-danger">Unverified</span>}
            </td>
            <td className={`${cellCls} text-muted`}>{[p.city, p.state].filter(Boolean).join(", ")}</td>
            <td className={`${cellCls} text-muted`}>{p.buildingSf?.toLocaleString()}</td>
            <td className={`${cellCls} text-muted`}>{p.dealCount}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
