/**
 * Landing page for the emailed link. Email scanners (Microsoft Safe Links) open
 * links automatically; they reach this page but don't press the button, so the
 * single-use token survives until the person clicks.
 */
export default async function ConfirmPage({ searchParams }: PageProps<"/sign-in/confirm">) {
  const params = await searchParams;
  const pick = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const token = pick("token");
  const email = pick("email");
  const callbackUrl = pick("callbackUrl");

  if (!token || !email) {
    return <p className="text-sm text-muted">This sign-in link is incomplete. Request a new one.</p>;
  }

  return (
    <form method="get" action="/api/auth/callback/resend" className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <p className="text-sm text-muted">
        Signing in as <span className="font-medium text-foreground">{email}</span>
      </p>
      <button
        type="submit"
        className="rounded-sm bg-navy px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Sign in
      </button>
    </form>
  );
}
