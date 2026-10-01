import Link from "next/link";
import { Section } from "@/components/fields";
import { FlagMark } from "@/components/data-grid";
import { PendingButton } from "@/components/pending-button";
import { SearchSelect, type Option } from "@/components/search-select";
import { partyLabel, SIDES, TEAM_ROLES, type DealType } from "@/domain/options";
import type { getDeal } from "@/server/deals";
import {
  addPartyAction,
  addPropertyAction,
  createPartyCompanyAction,
  removePartyAction,
  removePropertyAction,
  removeTeamAction,
  toggleRoleAction,
} from "../actions";
import { PartyAdder } from "./party-adder";

type DealData = NonNullable<Awaited<ReturnType<typeof getDeal>>>;

const smallBtn = "rounded-sm border border-navy px-3 py-1.5 text-sm font-semibold text-navy hover:bg-hover";
const removeBtn = "text-xs text-muted hover:text-danger";

export function PropertiesSection({
  deal,
  propertyOptions,
  preselectId,
}: {
  deal: DealData;
  propertyOptions: Option[];
  preselectId?: string;
}) {
  const id = deal.deal.id;
  const linked = new Set(deal.properties.map((p) => p.id));
  const totalSf = deal.properties.reduce((s, p) => s + (p.buildingSf ?? 0), 0);
  const totalAcres = deal.properties.reduce((s, p) => s + Number(p.acreage ?? 0), 0);

  return (
    <Section
      title={`Properties (${deal.properties.length})`}
      action={
        <span className="text-sm text-muted">
          {totalSf.toLocaleString()} SF{totalAcres ? ` · ${totalAcres.toLocaleString()} acres` : ""}
        </span>
      }
    >
      {deal.properties.length > 0 && (
        <ul className="mb-4 divide-y divide-border text-sm">
          {deal.properties.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span>
                <Link href={`/properties/${p.id}`} className="font-semibold text-link hover:underline">
                  {[p.address, p.buildingDesignation].filter(Boolean).join(", ") || "(no address)"}
                </Link>
                <span className="text-muted"> · {[p.city, p.state].filter(Boolean).join(", ")}</span>
                {!p.addressVerified && <FlagMark label="Unverified" />}
              </span>
              <span className="flex items-baseline gap-4 text-muted">
                {p.buildingSf ? `${p.buildingSf.toLocaleString()} SF` : null}
                <form action={removePropertyAction.bind(null, id, p.id)}>
                  <PendingButton className={removeBtn} pendingLabel="Removing…">
                    Remove
                  </PendingButton>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        action={addPropertyAction.bind(null, id)}
        className="grid grid-cols-1 items-end gap-3 rounded-sm border border-dashed border-gray p-3 sm:grid-cols-[1fr_auto]"
      >
        <SearchSelect
          key={`${preselectId ?? ""}-${deal.properties.length}`}
          name="propertyId"
          label="Add a property"
          layout="stacked"
          options={propertyOptions.filter((o) => !linked.has(o.id))}
          defaultId={preselectId}
          placeholder="Search by address…"
        />
        <PendingButton className={smallBtn} pendingLabel="Adding…">
          Add
        </PendingButton>
      </form>
      <p className="mt-2 text-sm">
        <Link href={`/properties/new?deal=${id}`} className="text-link hover:underline">
          Property not in the system? Create it
        </Link>
      </p>
    </Section>
  );
}

export function PartiesSection({
  deal,
  companies,
  contacts,
}: {
  deal: DealData;
  companies: Option[];
  contacts: { id: string; name: string; companyId: string }[];
}) {
  const id = deal.deal.id;
  const type = deal.deal.dealType as DealType | null;

  return (
    <Section title="Parties">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {SIDES.map((side) => {
          const label = partyLabel(type, side);
          const rows = deal.parties.filter((p) => p.side === side);
          return (
            <div key={side} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">
                {label}
                {rows.length > 1 && <span className="ml-2 text-xs font-normal text-muted">{rows.length} companies</span>}
              </h3>
              {rows.length === 0 ? (
                <p className="text-sm text-muted">None yet.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {rows.map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-2 py-2">
                      <span>
                        <Link href={`/companies/${p.companyId}`} className="font-semibold text-link hover:underline">
                          {p.companyName}
                        </Link>
                        {p.contactId && (
                          <Link href={`/contacts/${p.contactId}`} className="text-muted hover:underline">
                            {" "}
                            · {p.contactName}
                          </Link>
                        )}
                      </span>
                      <form action={removePartyAction.bind(null, id, p.id)}>
                        <PendingButton className={removeBtn} pendingLabel="Removing…">
                          Remove
                        </PendingButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <PartyAdder
                side={side}
                label={label}
                companies={companies}
                contacts={contacts}
                action={addPartyAction.bind(null, id)}
                createAction={createPartyCompanyAction.bind(null, id)}
              />
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function TeamSection({ deal }: { deal: DealData }) {
  const id = deal.deal.id;

  return (
    <Section title={`Deal team (${deal.team.length})`}>
      <p className="mb-3 text-sm text-muted">
        Add or remove people, and pick the leads, on the Summary tab. Click a role here to turn it on or off.
      </p>
      {deal.team.length === 0 ? (
        <p className="text-sm text-muted">No one on the team yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-semibold">Name</th>
                <th className="py-2 pr-4 font-semibold">Lead</th>
                <th className="py-2 pr-4 font-semibold">Roles</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {deal.team.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap py-2.5 pr-4 font-semibold">{t.name}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4">
                    <span className="flex gap-1.5">
                      {t.isLeadBroker && (
                        <span className="rounded-sm bg-navy px-1.5 py-0.5 text-xs font-semibold text-white">Lead broker</span>
                      )}
                      {t.isLeadAnalyst && (
                        <span className="rounded-sm bg-gray-dark px-1.5 py-0.5 text-xs font-semibold text-white">Lead analyst</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="flex flex-wrap gap-1.5">
                      {TEAM_ROLES.map((role) => {
                        const on = t.roles.includes(role);
                        return (
                          <form key={role} action={toggleRoleAction.bind(null, id, t.id, role)}>
                            <PendingButton
                              pendingLabel={role}
                              className={`rounded-full border px-2.5 py-0.5 text-xs ${
                                on
                                  ? "border-navy bg-navy font-semibold text-white"
                                  : "border-gray-light text-muted hover:border-navy hover:text-navy"
                              }`}
                            >
                              {role}
                            </PendingButton>
                          </form>
                        );
                      })}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <form action={removeTeamAction.bind(null, id, t.id)}>
                      <PendingButton className={removeBtn} pendingLabel="Removing…">
                        Remove
                      </PendingButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
