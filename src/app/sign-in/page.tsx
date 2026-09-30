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
      <label htmlFor="email" className="text-sm text-muted">
        Stream email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="name@streamrealty.com"
        className="rounded-sm border border-[#c8c8c4] bg-white px-2.5 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy"
      />
      <button
        type="submit"
        className="rounded-sm bg-navy px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Email me a sign-in link
      </button>
    </form>
  );
}
