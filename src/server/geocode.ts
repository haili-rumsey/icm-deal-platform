import "server-only";

export type GeocodeMatch = {
  formatted: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  placeId: string;
  lat: number;
  lng: number;
};

export type GeocodeResult =
  | { ok: true; matches: GeocodeMatch[] }
  | { ok: false; reason: "not_configured" | "no_results" | "error"; message: string };

type Component = { long_name: string; short_name: string; types: string[] };

function pick(components: Component[], type: string, short = false) {
  const c = components.find((x) => x.types.includes(type));
  return c ? (short ? c.short_name : c.long_name) : "";
}

/**
 * Resolves a typed address with the Google Geocoding API. The key stays on the
 * server. Without GOOGLE_MAPS_API_KEY it reports "not configured" so the user can
 * save without a Google match instead of being blocked.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Google lookup isn't set up yet. Use “Save without Google match” for now.",
    };
  }
  if (!query.trim()) return { ok: false, reason: "no_results", message: "Type an address first." };

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query.trim());
  url.searchParams.set("components", "country:US");
  url.searchParams.set("key", key);

  let body: { status: string; results?: unknown[] };
  try {
    const res = await fetch(url, { cache: "no-store" });
    body = await res.json();
  } catch {
    return { ok: false, reason: "error", message: "Couldn't reach Google. Try again." };
  }

  if (body.status === "ZERO_RESULTS") {
    return {
      ok: false,
      reason: "no_results",
      message: "Google didn't find that. Try the nearest intersection, or save without a Google match.",
    };
  }
  if (body.status !== "OK") {
    // Status only — never log the query or key.
    console.error(`Geocoding failed: ${body.status}`);
    return { ok: false, reason: "error", message: "Google lookup failed. Try again, or save without a Google match." };
  }

  const matches = (body.results as Array<{
    formatted_address: string;
    place_id: string;
    address_components: Component[];
    geometry: { location: { lat: number; lng: number } };
  }>)
    .slice(0, 5)
    .map((r) => {
      const c = r.address_components;
      const street = [pick(c, "street_number"), pick(c, "route")].filter(Boolean).join(" ");
      return {
        formatted: r.formatted_address,
        address: street || r.formatted_address.split(",")[0],
        city: pick(c, "locality") || pick(c, "sublocality") || pick(c, "postal_town"),
        state: pick(c, "administrative_area_level_1", true),
        zip: pick(c, "postal_code"),
        county: pick(c, "administrative_area_level_2").replace(/ County$/, ""),
        placeId: r.place_id,
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
      };
    });
  return { ok: true, matches };
}
