import Link from "next/link";
import type { Match } from "@/server/duplicates";

/** "Already in the system" notice. A warning, never a block — saving still works. */
export function DuplicateWarning({ title, matches, footer }: { title: string; matches: Match[]; footer?: string }) {
  if (!matches.length) return null;
  return (
    <div role="status" className="rounded-sm border border-flag/60 bg-[#fdf3ea] px-3 py-2 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <span className="h-2 w-2 rounded-[1px] bg-flag" aria-hidden />
        {title}
      </p>
      <ul className="mt-1 space-y-0.5">
        {matches.map((m) => (
          <li key={m.id}>
            <Link href={m.href} target="_blank" className="font-semibold text-link hover:underline">
              {m.label}
            </Link>
            {m.detail && <span className="text-muted"> · {m.detail}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted">{footer ?? "Use the existing record if it's the same one. If it's genuinely different, you can still save."}</p>
    </div>
  );
}
