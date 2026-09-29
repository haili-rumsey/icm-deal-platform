import { Resend } from "resend";

/**
 * The email links to our own confirm page rather than straight to the Auth.js
 * callback. Microsoft Safe Links opens every link in an email to scan it; if the
 * link were the single-use callback itself, the scan would use it up. The confirm
 * page only consumes the token when the person clicks "Sign in".
 */
export async function sendSignInEmail(to: string, callbackUrl: string) {
  const callback = new URL(callbackUrl);
  const confirm = new URL("/sign-in/confirm", callback.origin);
  confirm.search = callback.search;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "ICM Deal Platform <onboarding@resend.dev>",
    to,
    subject: "Your ICM Deal Platform sign-in link",
    text: `Sign in to the ICM Deal Platform:\n\n${confirm}\n\nThis link works once and expires in 15 minutes. If you didn't request it, ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p>Sign in to the ICM Deal Platform.</p>
<p><a href="${confirm}" style="display:inline-block;padding:10px 18px;background:#1f3a5f;color:#fff;text-decoration:none;border-radius:6px">Continue to sign in</a></p>
<p style="color:#555;font-size:13px">This link works once and expires in 15 minutes. If you didn't request it, ignore this email.</p>
</div>`,
  });
  // Don't include the address or link in the error — they'd end up in logs.
  if (error) throw new Error(`Sign-in email failed to send: ${error.name}`);
}
