import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { sendSignInEmail } from "./email";
import { ALLOWED_DOMAIN, normalizeEmail } from "./rules";

const FIFTEEN_MINUTES = 15 * 60;
const SEVEN_DAYS = 7 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  trustHost: true,
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
      maxAge: FIFTEEN_MINUTES,
      normalizeIdentifier: normalizeEmail,
      sendVerificationRequest: ({ identifier, url }) => sendSignInEmail(identifier, url),
    }),
  ],
  session: {
    // Database sessions so deactivating a user can end them immediately.
    strategy: "database",
    maxAge: SEVEN_DAYS,
    // Equal to maxAge: the session is never extended, so it ends 7 days after sign-in.
    updateAge: SEVEN_DAYS,
  },
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/check-email",
    error: "/sign-in/error",
  },
  callbacks: {
    // Runs twice: before a link is sent (verificationRequest) and when the link is used.
    async signIn({ user, email }) {
      const address = user.email ? normalizeEmail(user.email) : "";
      const [row] = await db
        .select({ isActive: users.isActive })
        .from(users)
        .where(eq(users.email, address));
      const allowed = address.endsWith(`@${ALLOWED_DOMAIN}`) && row?.isActive === true;
      if (allowed) return true;
      // Before sending: show the same "check your email" page as a real request, so the
      // page never reveals who has access. No email is sent.
      if (email?.verificationRequest) return "/sign-in/check-email";
      return false;
    },
    session({ session, user }) {
      // `user` is read from the database on every request, so this is always current.
      const u = user as typeof users.$inferSelect;
      session.user.id = u.id;
      session.user.isAdmin = u.isAdmin;
      session.user.isActive = u.isActive;
      return session;
    },
  },
});
