import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/auth";
import { Incomplete, Section } from "@/components/fields";
import { searchParam } from "@/components/list-page";
import { RecordFooter } from "@/components/record-footer";
import { RecordForm } from "@/components/record-form";
import { partyLabel, type DealType } from "@/domain/options";
import { companyOptions } from "@/server/companies";
import { contactOptions, streamPeopleOptions } from "@/server/contacts";
import { getDeal } from "@/server/deals";
import { propertyOptions } from "@/server/properties";
import { saveDeal } from "../actions";
import { DealFields } from "../deal-fields";
import { PartiesSection, PropertiesSection, TeamSection } from "./sections";

export default async function DealPage({ params, searchParams }: PageProps<"/deals/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Everything the page needs, fetched at once rather than one after another.
  const [user, data, streamPeople, companies, contacts, properties] = await Promise.all([
    requireUser(),
    getDeal(id),
    streamPeopleOptions(),
    companyOptions(),
    contactOptions(),
    propertyOptions(),
  ]);
  if (!data) notFound();
  const { deal } = data;

  // Prompted, never enforced.
  const type = deal.dealType as DealType | null;
  const missing = [
    !deal.dealType && "deal type",
    !deal.category && "category",
    data.properties.length === 0 && "properties",
    !data.parties.some((p) => p.side === "A") && partyLabel(type, "A").toLowerCase(),
    !data.team.some((t) => t.isLeadBroker) && "lead broker",
    !data.team.some((t) => t.isLeadAnalyst) && "lead analyst",
  ].filter((m): m is string => !!m);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted">
          <Link href="/deals" className="hover:underline">
            Deals
          </Link>
        </p>
        <h1 className="text-xl font-semibold">{deal.dealName}</h1>
        <p className="text-sm text-muted">
          {[deal.dealType, deal.dealSubtype, deal.category, deal.isIos && "IOS desk"].filter(Boolean).join(" · ")}
        </p>
      </div>

      <Incomplete missing={missing} />

      <Section title="Deal">
        <RecordForm action={saveDeal.bind(null, id)}>
          <DealFields deal={deal} streamPeople={streamPeople} />
        </RecordForm>
      </Section>

      <PropertiesSection deal={data} propertyOptions={properties} preselectId={searchParam(sp.addProperty)} />

      <PartiesSection
        deal={data}
        companies={companies.map((c) => ({ id: c.id, name: c.name, hint: c.domain }))}
        contacts={contacts}
      />

      <TeamSection deal={data} streamPeople={streamPeople} />

      <RecordFooter
        kind="deal"
        id={id}
        lastModifiedAt={deal.lastModifiedAt}
        lastModifiedBy={data.modifiedByName}
        archivedAt={deal.archivedAt}
        canDelete={user.isAdmin}
      />
    </div>
  );
}
