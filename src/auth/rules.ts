export const ALLOWED_DOMAIN = "streamrealty.com";

export function normalizeEmail(email: string): string {
  return email.normalize("NFKC").trim().toLowerCase();
}

export function isStreamEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return /^[^@\s]+@[^@\s]+$/.test(e) && e.endsWith(`@${ALLOWED_DOMAIN}`);
}
