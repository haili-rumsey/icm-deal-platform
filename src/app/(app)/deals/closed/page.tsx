import { DealList } from "../deal-list";

export default function ClosedDealsPage() {
  return <DealList current="closed" views={[{ key: "closed", label: "Closed deals", href: "/deals/closed" }]} />;
}
