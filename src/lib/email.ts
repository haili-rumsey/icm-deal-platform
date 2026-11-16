import { Resend } from "resend";

/**
 * The one place the app sends email from. Sign-in links and (from 2.4) the weekly recap
 * and (from 2.5) alerts all go through here, so changing the sender is a one-line change.
 *
 * Until a sending domain is verified in Resend, test mode only delivers to the Resend
 * account owner — so only Haili can receive mail yet.
 */
const DEFAULT_FROM = "ICM Deal Platform <onboarding@resend.dev>";

export type OutgoingEmail = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

/** Sends one email. Throws if Resend refuses it. The error names the problem but never the address or body. */
export async function sendEmail(mail: OutgoingEmail): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  if (error) throw new Error(`Email failed to send: ${error.name}`);
}
