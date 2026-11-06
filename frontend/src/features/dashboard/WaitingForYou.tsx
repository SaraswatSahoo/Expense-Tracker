import { LinkButton } from "../../components/Button";
import { Card } from "../../components/Card";
import { Alert, QueryError } from "../../components/Feedback";
import { Money } from "../../components/Money";
import { LoadingBlock } from "../../components/Spinner";
import { formatDate } from "../../lib/format";
import type { Group, Settlement } from "../../lib/types";
import type { DashboardGroup } from "./useDashboardData";

type WaitingPayment = { settlement: Settlement; group: Group; payerName: string };

function waitingPayments(groups: DashboardGroup[], userId: string): WaitingPayment[] {
  return groups
    .flatMap(({ group, balances, pending }) =>
      (pending.data?.items ?? [])
        .filter((settlement) => settlement.toUserId === userId)
        .map((settlement) => ({
          settlement,
          group,
          // The payer's name comes from a separate request that may not have finished.
          payerName:
            balances.data?.balances.find((balance) => balance.userId === settlement.fromUserId)
              ?.name ?? "A member",
        })),
    )
    .sort((a, b) => b.settlement.settledOn.localeCompare(a.settlement.settledOn));
}

function PaymentRow({ payment }: { payment: WaitingPayment }) {
  const { settlement, group, payerName } = payment;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm break-words text-slate-900">
          <span className="font-medium">{payerName}</span> paid you{" "}
          <Money amount={settlement.amount} currency={group.currency} />
        </p>
        <p className="mt-0.5 text-xs break-words text-slate-500">
          {group.name} · {formatDate(settlement.settledOn)}
        </p>
      </div>
      <LinkButton
        to={`/groups/${group.id}?tab=settlements`}
        variant="secondary"
        size="sm"
        aria-label={`Review payment from ${payerName} in ${group.name}`}
      >
        Review
      </LinkButton>
    </li>
  );
}

export function WaitingForYou({ groups, userId }: { groups: DashboardGroup[]; userId: string }) {
  const payments = waitingPayments(groups, userId);
  const loading = groups.some(({ pending }) => pending.isPending);
  const failed = groups.filter(({ pending }) => !pending.data && pending.isError);
  const truncated = groups.some(
    ({ pending }) => pending.data && pending.data.total > pending.data.items.length,
  );

  return (
    <section aria-labelledby="waiting-heading">
      <h2 id="waiting-heading" className="mb-3 text-lg font-semibold text-slate-900">
        Waiting for you
      </h2>
      <div className="space-y-3">
        {failed.map(({ group, pending }) => (
          <div key={group.id}>
            <p className="mb-1 text-sm break-words text-slate-600">
              Couldn't load payments for {group.name}.
            </p>
            <QueryError error={pending.error} onRetry={() => void pending.refetch()} />
          </div>
        ))}
        {truncated && (
          <Alert tone="warning">
            A group has more than 100 pending payments, so older ones may be missing here. Open the
            group to see them all.
          </Alert>
        )}
        {payments.length > 0 ? (
          <Card>
            <ul className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <PaymentRow key={payment.settlement.id} payment={payment} />
              ))}
            </ul>
          </Card>
        ) : loading ? (
          <LoadingBlock />
        ) : (
          failed.length === 0 && (
            <p className="text-sm text-slate-500">No payments are waiting for you to confirm.</p>
          )
        )}
      </div>
    </section>
  );
}
