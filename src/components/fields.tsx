/**
 * Form fields in the Dynamics layout: label on the left, field on the right
 * (stacked on phones). Nothing here is `required` except where the PRD makes it a
 * hard requirement — the system prompts for missing data, it never blocks.
 */

export const inputCls =
  "w-full rounded-sm border border-[#c8c8c4] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy disabled:bg-background disabled:text-muted";

export function FieldRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1 text-sm sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <label htmlFor={htmlFor} className="pt-1.5 text-muted">
        {label}
      </label>
      <div className="flex min-w-0 flex-col gap-1">
        {children}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
    </div>
  );
}

export function TextInput({
  label,
  name,
  defaultValue,
  hint,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  hint?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <FieldRow label={label} hint={hint} htmlFor={name}>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className={inputCls}
      />
    </FieldRow>
  );
}

export function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string | null }) {
  return (
    <FieldRow label={label} htmlFor={name}>
      <textarea id={name} name={name} defaultValue={defaultValue ?? ""} rows={3} className={inputCls} />
    </FieldRow>
  );
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  defaultValue?: string | null;
  hint?: string;
}) {
  return (
    <FieldRow label={label} hint={hint} htmlFor={name}>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} className={inputCls}>
        <option value="">—</option>
        {options.map((o) => {
          const { value, label } = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={value} value={value}>
              {label}
            </option>
          );
        })}
      </select>
    </FieldRow>
  );
}

export function Checkbox({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-navy" />
      {label}
    </label>
  );
}

export function CheckboxGroup({
  label,
  name,
  options,
  defaultValues = [],
}: {
  label: string;
  name: string;
  options: readonly string[];
  defaultValues?: readonly string[];
}) {
  const boxes = (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={o}
            defaultChecked={defaultValues.includes(o)}
            className="h-4 w-4 accent-navy"
          />
          {o}
        </label>
      ))}
    </div>
  );
  return label ? <FieldRow label={label}>{boxes}</FieldRow> : boxes;
}

/** A titled panel on a record page. */
export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 sm:px-5">
        <h2 className="text-sm font-bold">{title}</h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Two columns of label/field rows on wide screens. */
export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-10 gap-y-3 xl:grid-cols-2">{children}</div>;
}

/** "Still missing: X, Y" — prompts for data without blocking. */
export function Incomplete({ missing }: { missing: string[] }) {
  if (!missing.length) return null;
  return (
    <p className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-[1px] bg-flag" aria-hidden />
      <span>
        <span className="font-semibold">Still missing:</span> <span className="text-muted">{missing.join(", ")}</span>
      </span>
    </p>
  );
}
