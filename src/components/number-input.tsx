"use client";

/** "42500000" / "$42,500,000.5" → "42,500,000.5". Leaves anything that isn't a number alone. */
export function withCommas(raw: string) {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "" || Number.isNaN(Number(cleaned))) return raw;
  const [whole, frac] = cleaned.split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = whole.replace("-", "").replace(/^0+(?=\d)/, "");
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac !== undefined ? `.${frac}` : "");
}

/**
 * A number box that adds thousands separators when you leave it. The server strips
 * commas and $ on save, so typed and formatted values save the same.
 */
export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { onBlur, defaultValue, ...rest } = props;
  return (
    <input
      {...rest}
      inputMode="decimal"
      defaultValue={typeof defaultValue === "string" ? withCommas(defaultValue) : defaultValue}
      onBlur={(e) => {
        e.currentTarget.value = withCommas(e.currentTarget.value);
        onBlur?.(e);
      }}
    />
  );
}
