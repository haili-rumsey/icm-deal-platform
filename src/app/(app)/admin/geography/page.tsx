import { X } from "lucide-react";
import { requireAdmin } from "@/auth";
import { CommandBar, RefreshCommand } from "@/components/command-bar";
import { FlagMark } from "@/components/data-grid";
import { inputCls, Section } from "@/components/fields";
import { PendingButton } from "@/components/pending-button";
import { RecordHeader } from "@/components/record-page";
import { listGeography } from "@/server/geography";
import { addCityAction, addSubmarketAction, mapCityAction, removeCityAction, setRetiredAction } from "./actions";
import { InlineAdd } from "./inline-add";

/**
 * Operations-owned geography: each market's submarkets, and which address cities
 * use that market's list. Users can't add entries; admins maintain them here.
 */
export default async function GeographyPage() {
  await requireAdmin();
  const { markets, unmappedCities } = await listGeography();

  return (
    <>
      <CommandBar>
        <RefreshCommand />
      </CommandBar>
      <RecordHeader
        kindLabel="Admin"
        title="Geography"
        subtitle="State → City → Submarket. Each address city uses one market's submarket list."
        facts={markets.map((m) => ({ label: m.name, value: `${m.submarkets.filter((s) => !s.retiredAt).length} submarkets · ${m.cities.length} cities` }))}
      />
      <div className="flex flex-col gap-4 p-3 sm:p-5">
        {unmappedCities.length > 0 && (
          <Section title={`Cities not on a list yet (${unmappedCities.length})`}>
            <p className="mb-3 text-sm text-muted">
              Properties in these cities are city-level only, with no submarket choices. Put each city on a market&apos;s list.
            </p>
            <ul className="divide-y divide-border text-sm">
              {unmappedCities.map((c) => (
                <li key={`${c.city}|${c.state}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2">
                    <FlagMark label="" />
                    <span className="font-semibold">
                      {c.city}, {c.state}
                    </span>
                  </span>
                  <form action={mapCityAction.bind(null, c.city, c.state)} className="flex items-center gap-2">
                    <select name="marketId" required defaultValue="" className={`${inputCls} w-44 py-1`}>
                      <option value="" disabled>
                        Choose market…
                      </option>
                      {markets
                        .filter((m) => m.state === c.state)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                    <PendingButton className="text-sm font-semibold text-link hover:underline" pendingLabel="Adding…">
                      Add
                    </PendingButton>
                  </form>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {markets.map((m) => (
          <Section key={m.id} title={`${m.name}, ${m.state}`}>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Submarkets</h3>
                <ul className="mb-3 divide-y divide-border text-sm">
                  {m.submarkets.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className={s.retiredAt ? "text-muted line-through" : ""}>
                        {s.name}
                        <span className="ml-2 text-xs text-muted no-underline">
                          {s.propertyCount} {s.propertyCount === 1 ? "property" : "properties"}
                        </span>
                      </span>
                      <form action={setRetiredAction.bind(null, s.id, !s.retiredAt)}>
                        <PendingButton className="text-xs text-muted hover:text-foreground" pendingLabel="…">
                          {s.retiredAt ? "Restore" : "Retire"}
                        </PendingButton>
                      </form>
                    </li>
                  ))}
                </ul>
                <InlineAdd name="name" placeholder="New submarket" buttonLabel="Add submarket" action={addSubmarketAction.bind(null, m.id)} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Cities using this list ({m.cities.length})</h3>
                <ul className="mb-3 flex flex-wrap gap-1.5">
                  {m.cities.map((c) => (
                    <li key={c.id} className="flex items-center gap-1 rounded-full border border-border bg-background py-0.5 pl-2.5 pr-1 text-xs">
                      {c.city}
                      <form action={removeCityAction.bind(null, c.id)} className="contents">
                        <button type="submit" aria-label={`Remove ${c.city}`} className="rounded-full p-0.5 text-muted hover:text-danger">
                          <X size={12} />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
                <InlineAdd name="city" placeholder="Add a city" buttonLabel="Add city" action={addCityAction.bind(null, m.id, m.state)} />
              </div>
            </div>
          </Section>
        ))}
        <p className="px-1 text-xs text-muted">
          Retiring a submarket keeps it on the properties that already have it but stops offering it for new ones.
        </p>
      </div>
    </>
  );
}
