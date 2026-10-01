import "server-only";

/**
 * Google address handling, all server-side so the key is never sent to browsers.
 * - Suggestions as you type: Places API (New) Autocomplete.
 * - Turning a chosen suggestion (or typed text) into a normalized address with
 *   county, lat/long and place_id: Geocoding API.
 * Without GOOGLE_MAPS_API_KEY everything reports "not configured" so the user can
 * save without a Google match instead of being blocked.
 */

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

export type Suggestion = { placeId: string; main: string; secondary: string };
export type SuggestResult =
  | { ok: true; suggestions: Suggestion[] }
  | { ok: false; reason: "not_configured" | "error"; message: string };

const NOT_CONFIGURED = {
  ok: false as const,
  reason: "not_configured" as const,
  message: "Google lookup isn't set up yet. Use “Save without Google match” for now.",
};

type Component = { long_name: string; short_name: string; types: string[] };
type GeocodeApiResult = {
  formatted_address: string;
  place_id: string;
  address_components: Component[];
  geometry: { location: { lat: number; lng: number } };
};

function pick(components: Component[], type: string, short = false) {
  const c = components.find((x) => x.types.includes(type));
  return c ? (short ? c.short_name : c.long_name) : "";
}

function toMatch(r: GeocodeApiResult): GeocodeMatch {
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
}

async function callGeocoding(params: Record<string, string>): Promise<GeocodeResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NOT_CONFIGURED;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);

  let body: { status: string; results?: GeocodeApiResult[] };
  try {
    body = await (await fetch(url, { cache: "no-store" })).json();
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
  return { ok: true, matches: (body.results ?? []).slice(0, 5).map(toMatch) };
}

/** Typed text → up to five addresses (the "Look up" fallback). */
export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  if (!query.trim()) return { ok: false, reason: "no_results", message: "Type an address first." };
  return callGeocoding({ address: query.trim(), components: "country:US" });
}

/** A chosen suggestion → the full normalized address. */
export async function geocodePlace(placeId: string): Promise<GeocodeResult> {
  if (!placeId) return { ok: false, reason: "no_results", message: "Pick an address." };
  return callGeocoding({ place_id: placeId });
}

/**
 * Suggestions while typing. `sessionToken` groups one person's keystrokes for one
 * address, which is how Google bills autocomplete.
 */
export async function suggestAddresses(input: string, sessionToken: string): Promise<SuggestResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NOT_CONFIGURED;
  if (input.trim().length < 4) return { ok: true, suggestions: [] };

  let body: {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    }[];
    error?: { status?: string };
  };
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input: input.trim(),
        includedRegionCodes: ["us"],
        // Lean toward Texas (where nearly all deals are) without excluding other states.
        locationBias: { rectangle: { low: { latitude: 25.8, longitude: -106.7 }, high: { latitude: 36.5, longitude: -93.5 } } },
        sessionToken,
      }),
    });
    body = await res.json();
  } catch {
    return { ok: false, reason: "error", message: "Couldn't reach Google. Keep typing, or use Look up." };
  }
  if (body.error) {
    console.error(`Places autocomplete failed: ${body.error.status ?? "unknown"}`);
    return { ok: false, reason: "error", message: "Suggestions aren't available right now. Use Look up instead." };
  }
  return {
    ok: true,
    suggestions: (body.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .slice(0, 5)
      .map((p) => ({
        placeId: p.placeId,
        main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      })),
  };
}
