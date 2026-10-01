"use client";

import { useState } from "react";
import { FieldRow, inputCls } from "@/components/fields";
import type { GeoLookup } from "@/server/geography";
import { AddressLookup } from "./address-lookup";

type Initial = Parameters<typeof AddressLookup>[0]["initial"];

function key(city: string, state: string) {
  return `${city.trim().toLowerCase()}|${state.trim().toUpperCase()}`;
}

/**
 * Address plus submarket. The submarket list follows the address city: each city
 * is mapped to a market (Grand Prairie → Dallas), and that market's list is offered.
 */
export function PropertyLocation({
  initial,
  excludeId,
  geo,
  initialSubmarketId,
}: {
  initial?: Initial;
  excludeId?: string;
  geo: GeoLookup;
  initialSubmarketId?: string | null;
}) {
  const [loc, setLoc] = useState({ city: initial?.city ?? "", state: initial?.state ?? "" });
  const [submarketId, setSubmarketId] = useState(initialSubmarketId ?? "");
  const marketId = loc.city ? geo.cityToMarket[key(loc.city, loc.state || "TX")] : undefined;
  const market = geo.markets.find((m) => m.id === marketId);
  const options = market?.submarkets ?? [];
  // A submarket from another market's list doesn't carry over when the city changes.
  const value = options.some((o) => o.id === submarketId) ? submarketId : "";

  return (
    <>
      <FieldRow label="Address">
        <AddressLookup initial={initial} excludeId={excludeId} onLocationChange={(city, state) => setLoc({ city, state })} />
      </FieldRow>
      <FieldRow
        label="Submarket"
        htmlFor="submarketId"
        hint={
          !loc.city
            ? "Set the address first."
            : market
              ? `${loc.city} uses the ${market.name} list.`
              : `${loc.city} isn't on a market list yet, so this property is city-level only. An admin can add it on Geography.`
        }
      >
        <select
          id="submarketId"
          name="submarketId"
          value={value}
          onChange={(e) => setSubmarketId(e.target.value)}
          disabled={!market}
          className={`${inputCls} sm:max-w-md`}
        >
          <option value="">—</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </FieldRow>
    </>
  );
}
