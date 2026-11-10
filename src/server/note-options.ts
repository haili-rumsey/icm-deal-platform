import "server-only";
import type { NoteOptions } from "@/components/notes-panel";
import { companyOptions } from "./companies";
import { contactIdForEmail, contactOptions, icmTeamOptions } from "./contacts";
import { noteDealOptions } from "./notes";
import { myListLayout } from "./list-layouts";

/** Everything the note form's pickers need, for the signed-in user. */
export async function noteOptions(userEmail: string): Promise<NoteOptions> {
  const [companies, deals, contacts, authors, me, layout] = await Promise.all([
    companyOptions(),
    noteDealOptions(),
    contactOptions(),
    icmTeamOptions(),
    contactIdForEmail(userEmail),
    myListLayout("notes-panel"),
  ]);
  return {
    companies: companies.map((c) => ({ id: c.id, name: c.name, hint: c.domain })),
    deals,
    contacts: contacts.map((c) => ({ id: c.id, name: c.name, companyId: c.companyId })),
    authors: authors.map((a) => ({ id: a.id, name: a.name })),
    defaultAuthorId: me && authors.some((a) => a.id === me) ? me : null,
    layout,
  };
}
