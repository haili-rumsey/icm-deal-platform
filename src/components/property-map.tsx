"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Row } from "./data-grid";

/*
 * The Property report's map view (PRD §6). Uses Google's Maps JavaScript API with
 * a browser key (NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY) that Google only accepts
 * from this site's address, for maps only, under a daily load cap — separate from
 * the server-only key used for address lookup.
 */

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
const NAVY = "#002F6C";

// Minimal typing for the parts of the Maps API used here.
type LatLng = { lat: number; lng: number };
type GMap = { fitBounds(b: unknown, pad?: number): void; setCenter(p: LatLng): void; setZoom(z: number): void };
type GMarker = { setMap(m: GMap | null): void; addListener(e: string, f: () => void): void };
type GInfo = { setContent(html: HTMLElement): void; open(o: { map: GMap; anchor: GMarker }): void; close(): void };
type Maps = {
  Map: new (el: HTMLElement, o: object) => GMap;
  Marker: new (o: object) => GMarker;
  InfoWindow: new () => GInfo;
  LatLngBounds: new () => { extend(p: LatLng): void };
  SymbolPath: { CIRCLE: number };
};
declare global {
  interface Window {
    google?: { maps: Maps };
    __icmMapsReady?: () => void;
  }
}

let loading: Promise<Maps> | null = null;
/** Loads Google's script once per page visit. */
function loadMaps(): Promise<Maps> {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  loading ??= new Promise((resolve, reject) => {
    window.__icmMapsReady = () => resolve(window.google!.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&v=weekly&callback=__icmMapsReady`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error("load failed"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

const coords = (r: Row): LatLng | null =>
  typeof r.lat === "number" && typeof r.lng === "number" ? { lat: r.lat, lng: r.lng } : null;

export function PropertyMap({ rows }: { rows: Row[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<GMap | null>(null);
  const markers = useRef<GMarker[]>([]);
  const info = useRef<GInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const placed = rows.filter((r) => coords(r));
  const unplaced = rows.filter((r) => !coords(r));

  useEffect(() => {
    if (!KEY || !el.current) return;
    let cancelled = false;
    loadMaps()
      .then((maps) => {
        if (cancelled || !el.current) return;
        // Dallas until the pins set the view.
        map.current ??= new maps.Map(el.current, { center: { lat: 32.78, lng: -96.8 }, zoom: 9, mapTypeControl: true, streetViewControl: false });
        info.current ??= new maps.InfoWindow();
        for (const m of markers.current) m.setMap(null);
        const bounds = new maps.LatLngBounds();
        markers.current = placed.map((r) => {
          const position = coords(r)!;
          bounds.extend(position);
          const marker = new maps.Marker({
            map: map.current,
            position,
            title: String(r.address ?? ""),
            icon: { path: maps.SymbolPath.CIRCLE, scale: 7, fillColor: NAVY, fillOpacity: 0.9, strokeColor: "#FFFFFF", strokeWeight: 2 },
          });
          marker.addListener("click", () => {
            // Built as elements, not an HTML string, so names and addresses can't inject markup.
            const box = document.createElement("div");
            box.style.cssText = "font: 14px 'Nunito Sans', sans-serif; max-width: 240px";
            const link = document.createElement("a");
            link.href = String(r.href);
            link.textContent = [r.name, r.address, r.building].filter(Boolean).join(" · ") || "Property";
            link.style.cssText = "color:#004EA8;font-weight:700;text-decoration:none";
            const detail = document.createElement("div");
            detail.style.cssText = "color:#53565A;margin-top:4px";
            detail.textContent = [
              [r.city, r.state].filter(Boolean).join(", "),
              typeof r.sf === "number" ? `${r.sf.toLocaleString("en-US")} SF` : null,
              r.buildingClass ? `Class ${r.buildingClass}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            box.append(link, detail);
            info.current!.setContent(box);
            info.current!.open({ map: map.current!, anchor: marker });
          });
          return marker;
        });
        if (placed.length === 1) {
          map.current.setCenter(coords(placed[0])!);
          map.current.setZoom(14);
        } else if (placed.length > 1) {
          map.current.fitBounds(bounds, 40);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // Redraw when the filtered set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  if (!KEY) {
    return <p className="px-5 py-16 text-center text-sm text-muted">The map isn&apos;t set up yet — it needs its Google key.</p>;
  }
  return (
    <div className="px-4 pb-4 sm:px-5">
      {failed ? (
        <p className="py-16 text-center text-sm text-muted">The map couldn&apos;t load. Check your connection and refresh.</p>
      ) : (
        <div ref={el} className="h-[65vh] min-h-80 w-full rounded border border-border" aria-label="Map of properties" />
      )}
      <p className="mt-2 text-xs text-muted">
        {placed.length} propert{placed.length === 1 ? "y" : "ies"} on the map. Click a pin for details.
      </p>
      {unplaced.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-muted">
            Not on map ({unplaced.length}) — saved without a Google match, so there&apos;s no location yet
          </summary>
          <ul className="mt-1 ml-4 list-disc">
            {unplaced.map((r) => (
              <li key={String(r.id)}>
                <Link href={String(r.href)} className="text-link hover:underline">
                  {String(r.address ?? r.name ?? "Property")}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
