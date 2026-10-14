"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
import { CommandButton } from "@/components/command-bar";
import { loadMaps, MAPS_KEY } from "@/components/property-map";
import { pinStartAction, savePinAction } from "../actions";

type LatLng = { lat: number; lng: number };
// The few Maps API calls used here, beyond what the property map types.
type DragMarker = { getPosition(): { lat(): number; lng(): number } | null; setPosition(p: LatLng): void; addListener(e: string, f: () => void): void };
type ClickMap = { addListener(e: string, f: (ev: { latLng: { lat(): number; lng(): number } | null }) => void): void };

/** Dallas, for a property with no pin and no city Google recognizes. */
const FALLBACK: LatLng = { lat: 32.78, lng: -96.8 };

/**
 * Adjust pin (Haili, 1.6): drag the pin — or click the map — to where the building
 * really is, then save. A pin placed by hand is kept over later address lookups and
 * takes the property off the Needs cleanup report.
 */
export function PinAdjuster({ id, pin, pinManual }: { id: string; pin: LatLng | null; pinManual: boolean }) {
  const [open, setOpen] = useState(false);
  if (!MAPS_KEY) return null;
  return (
    <>
      <CommandButton icon={MapPinned} onClick={() => setOpen(true)} title={pinManual ? "Pin placed by hand" : undefined}>
        {pin ? "Adjust pin" : "Place pin"}
      </CommandButton>
      {open && <PinDialog id={id} pin={pin} onClose={() => setOpen(false)} />}
    </>
  );
}

function PinDialog({ id, pin, onClose }: { id: string; pin: LatLng | null; onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const marker = useRef<DragMarker | null>(null);
  const [spot, setSpot] = useState<LatLng | null>(pin);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [maps, start] = await Promise.all([loadMaps(), pin ? Promise.resolve(pin) : pinStartAction(id)]);
        if (cancelled || !el.current) return;
        const center = start ?? FALLBACK;
        const map = new maps.Map(el.current, {
          center,
          zoom: pin ? 17 : start ? 13 : 9,
          mapTypeControl: true,
          streetViewControl: false,
          // Satellite helps find a building or a yard.
          mapTypeId: pin ? "hybrid" : "roadmap",
        });
        const m = new maps.Marker({ map, position: center, draggable: true }) as unknown as DragMarker;
        marker.current = m;
        const read = () => {
          const p = m.getPosition();
          if (p) setSpot({ lat: p.lat(), lng: p.lng() });
        };
        m.addListener("dragend", read);
        (map as unknown as ClickMap).addListener("click", (ev) => {
          if (!ev.latLng) return;
          const p = { lat: ev.latLng.lat(), lng: ev.latLng.lng() };
          m.setPosition(p);
          setSpot(p);
        });
        if (!pin) setSpot(null); // nothing chosen yet — the pin sits at the city until moved
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, pin]);

  async function save() {
    if (!spot) return;
    setSaving(true);
    setError(null);
    const res = await savePinAction(id, spot.lat, spot.lng);
    setSaving(false);
    if (!res.ok) return setError("Couldn't save the pin. Try again.");
    onClose();
    router.refresh();
  }

  const moved = spot && (!pin || Math.abs(spot.lat - pin.lat) > 1e-7 || Math.abs(spot.lng - pin.lng) > 1e-7);
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-md border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-3 p-6">
        <div>
          <h2 className="font-serif text-xl">{pin ? "Adjust pin" : "Place pin"}</h2>
          <p className="mt-1 text-sm text-muted">
            Drag the pin, or click the map, where the building really is. Switch to Satellite to see the buildings. A pin placed here is kept even if the
            address is looked up again later.
          </p>
        </div>
        {failed ? (
          <p className="py-10 text-center text-sm text-muted">The map couldn&apos;t load. Try again in a moment.</p>
        ) : (
          <div ref={el} className="h-[min(26rem,60vh)] w-full rounded-sm border border-border bg-background" />
        )}
        <p className="text-xs text-muted">
          {spot ? `Pin at ${spot.lat.toFixed(6)}, ${spot.lng.toFixed(6)}` : "Move the pin to the building to choose its spot."}
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-sm border border-gray px-4 py-2 text-base font-semibold text-gray-dark hover:bg-hover">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!moved || saving}
            className="rounded-sm bg-navy px-5 py-2 text-base font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save pin"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
