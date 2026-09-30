import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="font-medium">Check your email.</p>
      <p className="text-muted">
        If you have access, a sign-in link is on its way. It works once and expires in 15 minutes.
      </p>
      <p className="text-muted">Nothing after a few minutes? Check your junk folder.</p>
      <Link href="/sign-in" className="mt-2 text-link underline underline-offset-2">
        Use a different email
      </Link>
    </div>
  );
}
