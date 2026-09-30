import { listUsers, requireAdmin } from "@/auth";
import { ActiveToggle } from "./active-toggle";
import { AddUserForm } from "./add-user-form";

export default async function UsersPage() {
  const admin = await requireAdmin();
  const people = await listUsers();
  const activeCount = people.filter((p) => p.isActive).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-muted">
          {activeCount} with access. Deactivating someone signs them out everywhere immediately.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Add a user</h2>
        <AddUserForm />
      </section>

      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  {p.name}
                  {p.isAdmin && <span className="ml-2 text-xs text-muted">Admin</span>}
                </td>
                <td className="px-4 py-2 text-muted">{p.email}</td>
                <td className="px-4 py-2">
                  {p.isActive ? "Active" : <span className="text-danger">Deactivated</span>}
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
  );
}
