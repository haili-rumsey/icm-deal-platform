/** Reading typed values out of submitted forms. Blank always means "not entered" (null). */

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** Numbers as strings, for Postgres numeric columns. Strips $ , % and spaces. */
export function dec(fd: FormData, key: string): string | null {
  const v = str(fd, key)?.replace(/[$,%\s]/g, "");
  return v && !Number.isNaN(Number(v)) ? v : null;
}

export function int(fd: FormData, key: string): number | null {
  const v = dec(fd, key);
  return v === null ? null : Math.round(Number(v));
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true";
}

export function oneOf<T extends string>(fd: FormData, key: string, list: readonly T[]): T | null {
  const v = str(fd, key);
  return v && (list as readonly string[]).includes(v) ? (v as T) : null;
}

export function manyOf<T extends string>(fd: FormData, key: string, list: readonly T[]): T[] {
  return fd.getAll(key).filter((v): v is T => typeof v === "string" && (list as readonly string[]).includes(v));
}

export function ids(fd: FormData, key: string): string[] {
  return [...new Set(fd.getAll(key).filter((v): v is string => typeof v === "string" && v.length > 0))];
}
