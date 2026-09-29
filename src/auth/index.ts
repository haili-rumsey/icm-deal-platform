/**
 * The only door into authentication. Nothing outside src/auth/ imports Auth.js,
 * so replacing magic links with Entra ID later means changing this folder only.
 */
import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth, handlers, signIn as authSignIn, signOut as authSignOut } from "./config";
import { normalizeEmail } from "./rules";

export { handlers };
export { isStreamEmail, ALLOWED_DOMAIN } from "./rules";
export { listUsers, addUser, setUserActive } from "./users";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const u = session?.user;
  // Deactivation deletes sessions; checking isActive here is a second safeguard.
  if (!u?.id || !u.email || !u.isActive) return null;
  return { id: u.id, name: u.name ?? null, email: u.email, isAdmin: u.isAdmin };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return user;
}

/** Sends a sign-in link if the address is allowed; otherwise sends nothing. Same page either way. */
export async function signIn(email: string) {
  await authSignIn("resend", { email: normalizeEmail(email), redirectTo: "/" });
}

export async function signOut() {
  await authSignOut({ redirectTo: "/sign-in" });
}
