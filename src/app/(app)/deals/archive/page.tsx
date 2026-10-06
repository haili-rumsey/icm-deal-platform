import { DealList } from "../deal-list";

/**
 * Everything parked — Track (dormant), Dead and Lost — in one list; filter the
 * Stage column to see one kind. Deals have no Archive button (Haili, 1.6): a
 * duplicate is deleted by an admin, anything else goes to Track, Dead or Lost.
 */
export default function ArchiveDealsPage() {
  return <DealList current="inactive" views={[{ key: "inactive", label: "Track, Dead and Lost", href: "/deals/archive" }]} />;
}
