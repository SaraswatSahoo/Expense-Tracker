// All calculations use whole cents, because floating-point numbers can't represent money exactly.

/** Up to ten whole digits and two decimals, matching the database column. */
export function isValidAmount(value: string): boolean {
  return /^\d{1,10}(\.\d{1,2})?$/.test(value.trim());
}

/** Converts "12.5" to 1250. Returns null if the text isn't a valid amount. */
export function toCents(value: string): number | null {
  const text = value.trim();
  if (!isValidAmount(text)) return null;
  const [whole = "0", fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Converts 1250 to "12.50", the format the API expects. */
export function fromCents(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

/** Converts a balance such as "-39.80" to -3980. Balances from the API can be negative. */
export function netToCents(value: string): number {
  // A balance can be larger than any single amount, so this can't use toCents's input limit.
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

/** Converts -3980 to "-39.80". */
export function netFromCents(cents: number): string {
  return cents < 0 ? `-${fromCents(-cents)}` : fromCents(cents);
}

/**
 * Divides an amount so the parts always add up exactly: leftover cents go to the first people.
 * 10000 among 3 people returns [3334, 3333, 3333].
 */
export function splitEqually(totalCents: number, people: number): number[] {
  if (people <= 0) return [];
  const base = Math.floor(totalCents / people);
  const leftover = totalCents - base * people;
  return Array.from({ length: people }, (_, index) => base + (index < leftover ? 1 : 0));
}

/** Formats "1234.50" as "₹1,234.50". Always shows two decimals, matching the stored value. */
export function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
