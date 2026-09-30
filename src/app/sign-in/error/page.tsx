import Link from "next/link";

export default async function SignInErrorPage({ searchParams }: PageProps<"/sign-in/error">) {
  const { error } = await searchParams;
  const message =
    error === "Verification"
      ? "This sign-in link has expired or has already been used."
      : error === "AccessDenied"
        ? "This account doesn't have access. Contact Haili Rumsey if you think that's wrong."
        : "Something went wrong signing in.";

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>{message}</p>
      <Link href="/sign-in" className="text-link underline underline-offset-2">
        Request a new link
      </Link>
    </div>
  );
}
