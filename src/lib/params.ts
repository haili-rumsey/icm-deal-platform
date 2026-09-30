export function searchParam(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}
