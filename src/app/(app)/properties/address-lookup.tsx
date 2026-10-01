"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { DuplicateWarning } from "@/components/duplicate-warning";
import { inputCls } from "@/components/fields";
import { US_STATES } from "@/domain/options";
import type { Match } from "@/server/duplicates";
import type { GeocodeMatch, Suggestion } from "@/server/geocode";
import { checkPlace } from "../duplicate-actions";
import { lookupAddressAction, resolvePlaceAction, suggestAddressesAction } from "./lookup-action";

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

/**
 * Addresses are not typed free-form: type, click Look up, pick Google's match.
 * When Google has nothing (e.g. new construction), "Save without Google match"
 * lets the user type it; the property is flagged unverified for cleanup.
 */
export function AddressLookup({
  initial,
  excludeId,
  onLocationChange,
}: {
  initial?: Address;
  /** The property being edited, so it doesn't warn about itself. */
  excludeId?: string;
  /** Tells the submarket picker which city/state is now entered. */
  onLocationChange?: (city: string, state: string) => void;
}) {
  const [chosen, setChosen] = useState<Address | null>(initial?.address || initial?.city ? initial : null);
  const [mode, setMode] = useState<"lookup" | "manual">(initial && !initial.verified && initial.city ? "manual" : "lookup");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<GeocodeMatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [samePlace, setSamePlace] = useState<Match[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  // One token per address being entered; Google bills a typing session as one unit.
  const session = useRef<string>(crypto.randomUUID());
  const latest = useRef(0);
  const listId = useId();

  // Suggestions as you type, after a short pause and from 4 characters.
  useEffect(() => {
    const q = query.trim();
    const id = ++latest.current;
    if (q.length < 4) return;
    const t = setTimeout(async () => {
      const r = await suggestAddressesAction(q, session.current);
      if (id !== latest.current) return; // a newer keystroke won
      if (r.ok) {
        setSuggestions(r.suggestions);
        setOpen(true);
      } else {
        setSuggestions([]);
        setMessage(r.message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function choose(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    setMessage(null);
    startTransition(async () => {
      const r = await resolvePlaceAction(s.placeId);
      if (r.ok && r.matches[0]) pick(r.matches[0]);
      else if (!r.ok) setMessage(r.message);
    });
  }

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
    session.current = crypto.randomUUID();
    onLocationChange?.(m.city, m.state);
    // Same Google place already in the system? Warn, don't block.
    startTransition(async () => setSamePlace(await checkPlace(excludeId ?? null, m.placeId, null)));
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
      <div className="flex flex-col gap-3 rounded-sm border border-border bg-background p-3">
        <input type="hidden" name="addressVerified" value="false" />
        <p className="text-xs text-muted">
          Saving without a Google match. The property is flagged for cleanup and can be looked up again later.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted">Address or description</span>
            <input name="address" defaultValue={v?.address} placeholder="e.g. NE corner of Hwy 287 & FM 1187" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">City</span>
            <input
              name="city"
              defaultValue={v?.city}
              onChange={(e) => onLocationChange?.(e.target.value, (e.target.form?.elements.namedItem("state") as HTMLSelectElement | null)?.value ?? "TX")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">State</span>
            <select
              name="state"
              defaultValue={v?.state || "TX"}
              onChange={(e) => onLocationChange?.((e.target.form?.elements.namedItem("city") as HTMLInputElement | null)?.value ?? "", e.target.value)}
              className={inputCls}
            >
              {US_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Zip</span>
            <input name="zip" defaultValue={v?.zip} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">County</span>
            <input name="county" defaultValue={v?.county} className={inputCls} />
          </label>
        </div>
        <button type="button" onClick={() => setMode("lookup")} className="self-start text-sm text-link hover:underline">
          Back to Google lookup
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {hidden}
      <DuplicateWarning
        title="This address is already in the system"
        matches={samePlace}
        footer="If it's the same building, open the existing property instead. If it's a different building at this address, give it a building designation and save."
      />
      {chosen ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[#c8c8c4] bg-white px-2.5 py-1.5 text-sm">
          <span>
            {chosen.address}, {chosen.city}, {chosen.state} {chosen.zip}
            {chosen.county && <span className="text-muted"> · {chosen.county} County</span>}
            {chosen.verified ? (
              <span className="ml-2 text-xs text-muted">Google match</span>
            ) : (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted"><span className="h-2 w-2 rounded-[1px] bg-flag" />Unverified</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              setChosen(null);
              setSamePlace([]);
            }}
            className="text-xs text-link hover:underline"
          >
            Change address
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setMessage(null);
                  if (e.target.value.trim().length < 4) setSuggestions([]);
                }}
                onFocus={() => suggestions.length && setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (open && suggestions[0]) choose(suggestions[0]);
                    else lookUp();
                  }
                  if (e.key === "Escape") setOpen(false);
                }}
                role="combobox"
                aria-controls={listId}
                aria-expanded={open && suggestions.length > 0}
                aria-autocomplete="list"
                placeholder="Start typing an address…"
                className={inputCls}
              />
              {open && suggestions.length > 0 && (
                <ul id={listId} role="listbox" className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
                  {suggestions.map((sg) => (
                    <li key={sg.placeId} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(sg)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-hover"
                      >
                        <span className="font-semibold">{sg.main}</span>
                        {sg.secondary && <span className="ml-1.5 text-muted">{sg.secondary}</span>}
                      </button>
                    </li>
                  ))}
                  <li className="border-t border-border px-3 py-1 text-right text-[10px] text-muted">powered by Google</li>
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={lookUp}
              disabled={pending}
              title="Search Google for exactly what's typed (useful for intersections)"
              className="whitespace-nowrap rounded-sm border border-navy px-4 py-1.5 text-sm font-semibold text-navy hover:bg-hover disabled:opacity-60"
            >
              {pending ? "Looking up…" : "Look up"}
            </button>
          </div>
          {message && <p className="text-sm">{message}</p>}
          {matches.length > 0 && (
            <ul className="divide-y divide-border rounded-sm border border-border bg-white">
              {matches.map((m) => (
                <li key={m.placeId}>
                  <button type="button" onClick={() => pick(m)} className="w-full px-3 py-2 text-left text-sm hover:bg-hover">
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
