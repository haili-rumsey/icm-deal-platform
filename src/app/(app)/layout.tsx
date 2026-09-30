import { LogOut } from "lucide-react";
import { requireUser, signOut } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";

async function doSignOut() {
  "use server";
  await signOut();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <AppShell
      isAdmin={user.isAdmin}
      userLabel={user.name ?? user.email}
      signOut={
        <form action={doSignOut}>
          <button type="submit" className="flex items-center gap-1.5 rounded px-2 py-1 text-white/90 hover:bg-white/10">
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
