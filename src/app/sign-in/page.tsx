import { redirect } from "next/navigation";
import { getCurrentUser, signIn } from "@/auth";

async function requestLink(formData: FormData) {
  "use server";
  await signIn(String(formData.get("email") ?? ""));
}

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <form action={requestLink} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        Stream email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="name@streamrealty.com"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Email me a sign-in link
      </button>
    </form>
  );
}
