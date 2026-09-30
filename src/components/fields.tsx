/**
 * Plain form fields. Nothing here is `required` except where the PRD makes it a
 * hard requirement — the system prompts for missing data, it never blocks.
 */

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
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
    <Field label={label} hint={hint}>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className={inputCls}
      />
    </Field>
  );
}

export function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string | null }) {
  return (
    <Field label={label}>
      <textarea name={name} defaultValue={defaultValue ?? ""} rows={3} className={inputCls} />
    </Field>
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
    <Field label={label} hint={hint}>
      <select name={name} defaultValue={defaultValue ?? ""} className={inputCls}>
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
    </Field>
  );
}

export function Checkbox({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-accent" />
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
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="mb-1 font-medium">{label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2">
            <input
              type="checkbox"
              name={name}
              value={o}
              defaultChecked={defaultValues.includes(o)}
              className="h-4 w-4 accent-accent"
            />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
    >
      {children}
    </button>
  );
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** "Missing: X, Y" — prompts for data without blocking. */
export function Incomplete({ missing }: { missing: string[] }) {
  if (!missing.length) return null;
  return (
    <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted">
      <span className="font-medium text-foreground">Still missing:</span> {missing.join(", ")}
    </p>
  );
}
