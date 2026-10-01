import { searchParam } from "@/lib/params";
import { DealList, type ListView } from "../deal-list";

/** Everything not in play: dormant (Track), dead or lost, and archived records. */
const VIEWS: ListView[] = [
  { key: "track", label: "Track (dormant)", href: "/deals/archive" },
  { key: "dead", label: "Dead / Lost", href: "/deals/archive?view=dead" },
  { key: "archived", label: "Archived records", href: "/deals/archive?view=archived" },
];

export default async function ArchiveDealsPage({ searchParams }: PageProps<"/deals/archive">) {
  const v = searchParam((await searchParams).view);
  const current = VIEWS.find((x) => x.key === v)?.key ?? "track";
  return <DealList current={current} views={VIEWS} />;
}
