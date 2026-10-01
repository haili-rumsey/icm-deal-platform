import { DealList } from "./deal-list";

/** Active pipeline: BOV 1 through Under Contract. */
export default function ActiveDealsPage() {
  return <DealList current="active" views={[{ key: "active", label: "Active pipeline", href: "/deals" }]} />;
}
