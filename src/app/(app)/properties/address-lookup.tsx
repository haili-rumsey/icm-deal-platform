"use client";

import { useState, useTransition } from "react";
import { US_STATES } from "@/domain/options";
import type { GeocodeMatch } from "@/server/geocode";
import { lookupAddressAction } from "./lookup-action";

type Address = {
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  googlePlaceId: string;
  lat: string;
  lng: string;
  verified: boolean;
};

const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

/**
 * Addresses are not typed free-form: type, click Look up, pick Google's match.
 * When Google has nothing (e.g. new construction), "Save without Google match"
 * lets the user type it; the property is flagged unverified for cleanup.
 */
export function AddressLookup({ initial }: { initial?: Address }) {
  const [chosen, setChosen] = useState<Address | null>(initial?.address || initial?.city ? initial : null);
  const [mode, setMode] = useState<"lookup" | "manual">(initial && !initial.verified && initial.city ? "manual" : "lookup");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<GeocodeMatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function lookUp() {
    setMessage(null);
    setMatches([]);
    startTransition(async () => {
      const r = await lookupAddressAction(query);
      if (r.ok) setMatches(r.matches);
      else setMessage(r.message);
    });
  }

  function pick(m: GeocodeMatch) {
    setChosen({
      address: m.address,
      city: m.city,
      state: m.state,
      zip: m.zip,
      county: m.county,
      googlePlaceId: m.placeId,
      lat: String(m.lat),
      lng: String(m.lng),
      verified: true,
    });
    setMatches([]);
    setQuery("");
  }

  const hidden = chosen && mode === "lookup" && (
    <>
      <input type="hidden" name="address" value={chosen.address} />
      <input type="hidden" name="city" value={chosen.city} />
      <input type="hidden" name="state" value={chosen.state} />
      <input type="hidden" name="zip" value={chosen.zip} />
      <input type="hidden" name="county" value={chosen.county} />
      <input type="hidden" name="googlePlaceId" value={chosen.googlePlaceId} />
      <input type="hidden" name="lat" value={chosen.lat} />
      <input type="hidden" name="lng" value={chosen.lng} />
      <input type="hidden" name="addressVerified" value={String(chosen.verified)} />
    </>
  );

  if (mode === "manual") {
    const v = chosen && !chosen.verified ? chosen : null;
    return (
      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <input type="hidden" name="addressVerified" value="false" />
        <p className="text-xs text-muted">
          Saving without a Google match. The property is flagged for cleanup and can be looked up again later.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm lg:col-span-2">
            <span className="font-medium">Address or description</span>
            <input name="address" defaultValue={v?.address} placeholder="e.g. NE corner of Hwy 287 & FM 1187" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">City</span>
            <input name="city" defaultValue={v?.city} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">State</span>
            <select name="state" defaultValue={v?.state || "TX"} className={inputCls}>
              {US_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Zip</span>
            <input name="zip" defaultValue={v?.zip} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">County</span>
            <input name="county" defaultValue={v?.county} className={inputCls} />
          </label>
        </div>
        <button type="button" onClick={() => setMode("lookup")} className="self-start text-sm text-accent hover:underline">
          Back to Google lookup
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {hidden}
      {chosen ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
          <span>
            {chosen.address}, {chosen.city}, {chosen.state} {chosen.zip}
            {chosen.county && <span className="text-muted"> · {chosen.county} County</span>}
            {chosen.verified ? (
              <span className="ml-2 text-xs text-muted">Google match</span>
            ) : (
              <span className="ml-2 text-xs text-danger">Unverified</span>
            )}
          </span>
          <button type="button" onClick={() => setChosen(null)} className="text-xs text-muted hover:text-foreground">
            Change address
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  lookUp();
                }
              }}
              placeholder="Type an address or intersection, then Look up"
              className={inputCls}
            />
            <button
              type="button"
              onClick={lookUp}
              disabled={pending}
              className="whitespace-nowrap rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-background disabled:opacity-60"
            >
              {pending ? "Looking up…" : "Look up"}
            </button>
          </div>
          {message && <p className="text-sm text-danger">{message}</p>}
          {matches.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {matches.map((m) => (
                <li key={m.placeId}>
                  <button type="button" onClick={() => pick(m)} className="w-full px-3 py-2 text-left text-sm hover:bg-background">
                    {m.formatted}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setMode("manual")} className="self-start text-sm text-muted hover:text-foreground">
            Save without Google match
          </button>
        </>
      )}
    </div>
  );
}
