import { Card } from "../../components/Card";
import { Money } from "../../components/Money";
import { Spinner } from "../../components/Spinner";
import { netFromCents } from "../../lib/money";
import { userNetCents, type DashboardGroup } from "./useDashboardData";

type CurrencyTotal = {
  currency: string;
  cents: number;
  loaded: number;
  loading: number;
  failed: number;
};

// A currency's total is only final once all its groups have answered, so the counts are kept
// alongside it rather than showing a partial figure as if it were complete.
function totalsByCurrency(groups: DashboardGroup[], userId: string): CurrencyTotal[] {
  const totals = new Map<string, CurrencyTotal>();
  for (const { group, balances } of groups) {
    const total = totals.get(group.currency) ?? {
      currency: group.currency,
      cents: 0,
      loaded: 0,
      loading: 0,
      failed: 0,
    };
    if (balances.data) {
      total.cents += userNetCents(balances.data, userId);
      total.loaded += 1;
    } else if (balances.isError) {
      total.failed += 1;
    } else {
      total.loading += 1;
    }
    totals.set(group.currency, total);
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

function TotalFigure({ total }: { total: CurrencyTotal }) {
  if (total.loading > 0) {
    return (
      <span className="text-brand-600">
        <Spinner size="sm" />
      </span>
    );
  }
  if (total.loaded === 0) {
    return <p className="text-sm text-slate-500">Couldn't load this balance</p>;
  }
  if (total.cents === 0) {
    return (
      <p className="font-medium text-slate-700">
        {total.failed > 0 ? "Nothing owed in the groups that loaded" : "All settled up"}
      </p>
    );
  }
  const owed = total.cents > 0;
  return (
    <>
      <p className="text-sm text-slate-600">{owed ? "You are owed" : "You owe"}</p>
      <Money
        amount={netFromCents(Math.abs(total.cents))}
        currency={total.currency}
        className={`text-xl sm:text-2xl ${owed ? "text-emerald-700" : "text-red-700"}`}
      />
    </>
  );
}

export function BalanceSummary({ groups, userId }: { groups: DashboardGroup[]; userId: string }) {
  const totals = totalsByCurrency(groups, userId);
  return (
    <section aria-labelledby="balance-summary-heading">
      <h2 id="balance-summary-heading" className="mb-3 text-lg font-semibold text-slate-900">
        Your balance
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {totals.map((total) => (
          <li key={total.currency}>
            <Card className="h-full">
              <p className="mb-1 text-xs font-medium text-slate-500">{total.currency}</p>
              <TotalFigure total={total} />
              {total.loading === 0 && total.loaded > 0 && total.failed > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Not counting {total.failed} {total.failed === 1 ? "group" : "groups"} that
                  couldn't load.
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
