import { requireUser } from "@/auth";

export default async function HomePage() {
  const user = await requireUser();
  return (
    <div>
      <h1 className="text-xl font-semibold">Welcome, {user.name ?? user.email}</h1>
      <p className="mt-2 text-sm text-muted">No deals yet.</p>
    </div>
  );
}
