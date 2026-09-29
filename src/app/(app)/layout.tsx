import Link from "next/link";
import { requireUser, signOut } from "@/auth";

async function doSignOut() {
  "use server";
  await signOut();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-semibold">
            ICM Deal Platform
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user.isAdmin && (
              <Link href="/admin/users" className="text-muted hover:text-foreground">
                Users
              </Link>
            )}
            <span className="hidden text-muted sm:inline">{user.name ?? user.email}</span>
            <form action={doSignOut}>
              <button type="submit" className="text-muted hover:text-foreground">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
