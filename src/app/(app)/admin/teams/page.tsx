import { requireAdmin } from "@/auth";
import { CommandBar, RefreshCommand } from "@/components/command-bar";
import { Section } from "@/components/fields";
import { PendingButton } from "@/components/pending-button";
import { RecordHeader } from "@/components/record-page";
import { LOCATIONS } from "@/domain/options";
import { listIcmTeam } from "@/server/contacts";
import { removeTeamMemberAction } from "./actions";
import { AddMemberForm } from "./add-member-form";
import { LocationSelect } from "./location-select";

/**
 * The ICM team roster — where the deal team dropdown pulls from. Separate from
 * app access (Users): some team members never sign in. Built as "teams" so more
 * teams can be added later if needed.
 */
export default async function ManageTeamsPage() {
  await requireAdmin();
  const members = await listIcmTeam();

  return (
    <>
      <CommandBar>
        <RefreshCommand />
      </CommandBar>
      <RecordHeader
        kindLabel="Admin"
        title="Manage teams"
        subtitle="Deal team dropdowns pull from here. Being on a team doesn't give app access — that's set on Users."
        facts={[
          { label: "ICM team", value: String(members.length) },
          ...LOCATIONS.map((l) => ({ label: l, value: String(members.filter((m) => m.location === l).length) })),
        ]}
      />
      <div className="flex flex-col gap-4 p-3 sm:p-5">
        <Section title="Add to the ICM team">
          <AddMemberForm />
        </Section>
        <Section title={`ICM team (${members.length})`}>
          {members.length === 0 ? (
            <p className="text-sm text-muted">No one on the team yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-semibold">
                      {m.firstName} {m.lastName}
                    </span>
                    {m.title && <span className="ml-2 text-muted">{m.title}</span>}
                    {m.email && <span className="block text-xs text-muted sm:ml-2 sm:inline">{m.email}</span>}
                  </span>
                  <span className="flex items-center gap-4">
                  <LocationSelect contactId={m.id} value={m.location} />
                  <form action={removeTeamMemberAction.bind(null, m.id)}>
                    <PendingButton className="text-xs text-muted hover:text-danger" pendingLabel="Removing…">
                      Remove
                    </PendingButton>
                  </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            Removing someone takes them out of the dropdown for new deals. They stay on deals they already worked on.
          </p>
        </Section>
      </div>
    </>
  );
}
