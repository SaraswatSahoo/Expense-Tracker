import { Link } from "react-router";
import { Card } from "../../components/Card";
import { Badge, QueryError } from "../../components/Feedback";
import { Money } from "../../components/Money";
import { Spinner } from "../../components/Spinner";
import { netFromCents } from "../../lib/money";
import { userNetCents, type DashboardGroup } from "./useDashboardData";

function netLabel(cents: number): string {
  if (cents > 0) return "You are owed";
  if (cents < 0) return "You owe";
  return "Settled";
}

function GroupCard({ item, userId }: { item: DashboardGroup; userId: string }) {
  const { group, balances } = item;
  const net = balances.data ? userNetCents(balances.data, userId) : null;

  return (
    <Card className="relative h-full transition-colors hover:border-brand-300">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-medium break-words text-slate-900">
          {/* The link stretches over the whole card, which lets the retry button sit outside it. */}
          <Link
            to={`/groups/${group.id}`}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brand-600"
          >
            {group.name}
          </Link>
        </h3>
        <Badge>{group.currency}</Badge>
      </div>

      <div className="mt-3">
        {net !== null ? (
          <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
            <span className="text-slate-600">{netLabel(net)}</span>
            <Money amount={netFromCents(net)} currency={group.currency} signed />
          </p>
        ) : balances.isError ? (
          <div className="relative z-10">
            <QueryError error={balances.error} onRetry={() => void balances.refetch()} />
          </div>
        ) : (
          <span className="text-brand-600">
            <Spinner size="sm" />
          </span>
        )}
      </div>
    </Card>
  );
}

export function GroupCards({ groups, userId }: { groups: DashboardGroup[]; userId: string }) {
  return (
    <section aria-labelledby="your-groups-heading">
      <h2 id="your-groups-heading" className="mb-3 text-lg font-semibold text-slate-900">
        Your groups
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((item) => (
          <li key={item.group.id}>
            <GroupCard item={item} userId={userId} />
          </li>
        ))}
      </ul>
    </section>
  );
}
