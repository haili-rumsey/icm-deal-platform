import Link from "next/link";

/** Header, search box and archived toggle shared by the four record lists. */
export function ListHeader({
  title,
  basePath,
  newLabel,
  q,
  archived,
  count,
}: {
  title: string;
  basePath: string;
  newLabel: string;
  q?: string;
  archived: boolean;
  count: number;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          {archived ? `Archived ${title.toLowerCase()}` : title}
          <span className="ml-2 text-sm font-normal text-muted">{count}</span>
        </h1>
        <Link
          href={`${basePath}/new`}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          {newLabel}
        </Link>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search…"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent sm:max-w-sm"
        />
        {archived && <input type="hidden" name="archived" value="1" />}
        <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-card">
          Search
        </button>
        <Link href={archived ? basePath : `${basePath}?archived=1`} className="text-sm text-muted hover:text-foreground sm:ml-auto">
          {archived ? "Back to active" : "Show archived"}
        </Link>
      </form>
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={head.length} className="px-4 py-6 text-center text-muted">
                Nothing here yet.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export const rowCls = "border-b border-border last:border-0 hover:bg-background";
export const cellCls = "px-4 py-2";

export function searchParam(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}
