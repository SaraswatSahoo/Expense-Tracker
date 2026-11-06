import { formatMoney } from "../lib/money";

/**
 * Displays an amount in the group's currency. With `signed`, a positive amount is green and
 * negative is red, for balances where positive means the person is owed money.
 */
export function Money({
  amount,
  currency,
  signed = false,
  className = "",
}: {
  amount: string;
  currency: string;
  signed?: boolean;
  className?: string;
}) {
  const value = Number(amount);
  const color = !signed
    ? ""
    : value > 0
      ? "text-emerald-700"
      : value < 0
        ? "text-red-700"
        : "text-slate-500";
  return (
    <span className={`font-medium tabular-nums whitespace-nowrap ${color} ${className}`}>
      {signed && value > 0 && "+"}
      {formatMoney(amount, currency)}
    </span>
  );
}
