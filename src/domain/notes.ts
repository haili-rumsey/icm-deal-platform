/** "Seth Koschak · entered by Haili Rumsey" — the entered-by part only when someone else typed it (PRD §5). */
export function attribution(n: { authorName: string | null; enteredByName: string | null }) {
  if (!n.authorName) return n.enteredByName ? `Entered by ${n.enteredByName}` : "—";
  if (!n.enteredByName || n.enteredByName === n.authorName) return n.authorName;
  return `${n.authorName} · entered by ${n.enteredByName}`;
}
