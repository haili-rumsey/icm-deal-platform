import { listUsers, requireAdmin } from "@/auth";
import { CommandBar, RefreshCommand } from "@/components/command-bar";
import { FlagMark } from "@/components/data-grid";
import { Section } from "@/components/fields";
import { BackCommand, RecordHeader } from "@/components/record-page";
import { ActiveToggle } from "./active-toggle";
import { AddUserForm } from "./add-user-form";

export default async function UsersPage() {
  const admin = await requireAdmin();
  const people = await listUsers();
  const activeCount = people.filter((p) => p.isActive).length;

  return (
    <>
      <CommandBar>
        <BackCommand fallbackHref="/deals" />
        <RefreshCommand />
      </CommandBar>
      <RecordHeader
        kindLabel="Admin"
        title="Users"
        subtitle="Deactivating someone signs them out everywhere immediately."
        facts={[{ label: "With access", value: String(activeCount) }]}
      />
      <div className="flex flex-col gap-4 p-3 sm:p-5">
      <Section title="Add a user">
        <AddUserForm />
      </Section>

      <section className="overflow-x-auto rounded-md border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Email</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  {p.name}
                  {p.isAdmin && <span className="ml-2 rounded-sm bg-navy px-1.5 py-0.5 text-xs font-semibold text-white">Admin</span>}
                </td>
                <td className="px-4 py-2 text-muted">{p.email}</td>
                <td className="px-4 py-2">
                  {p.isActive ? "Active" : <FlagMark label="Deactivated" />}
                </td>
                <td className="px-4 py-2 text-right">
                  {p.id !== admin.id && (
                    <ActiveToggle userId={p.id} isActive={p.isActive} name={p.name ?? p.email} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      </div>
    </>
  );
}
