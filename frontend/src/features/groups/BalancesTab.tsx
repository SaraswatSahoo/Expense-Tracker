import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Badge, QueryError } from "../../components/Feedback";
import { Money } from "../../components/Money";
import { LoadingBlock } from "../../components/Spinner";
import { useCurrentUser } from "../../hooks/useAuth";
import { useMemberName } from "../../hooks/useGroup";
import { groupsApi } from "../../lib/api";
import { netToCents } from "../../lib/money";
import { queryKeys } from "../../lib/queryKeys";
import type { GroupWithMembers, SuggestedSettlement } from "../../lib/types";

function balanceLabel(net: string, isYou: boolean): string {
  const cents = netToCents(net);
  if (cents === 0) return "settled up";
  if (cents > 0) return isYou ? "are owed" : "is owed";
  return isYou ? "owe" : "owes";
}

export function BalancesTab({ group }: { group: GroupWithMembers }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const memberName = useMemberName(group);

  const query = useQuery({
    queryKey: queryKeys.balances(group.id),
    queryFn: () => groupsApi.balances(group.id),
  });

  if (!query.data) {
    return query.isError ? (
      <QueryError error={query.error} onRetry={() => void query.refetch()} />
    ) : (
      <LoadingBlock />
    );
  }

  const { currency, balances, suggestedSettlements } = query.data;
  const formerMembers = new Set(
    group.members.filter((member) => member.leftAt !== null).map((member) => member.userId),
  );
  const rows = balances.filter(
    (row) => !formerMembers.has(row.userId) || netToCents(row.net) !== 0,
  );

  const repaymentText = ({ fromUserId, toUserId }: SuggestedSettlement) => {
    const payer = fromUserId === user.id ? "You pay" : `${memberName(fromUserId)} pays`;
    const receiver = toUserId === user.id ? "you" : memberName(toUserId);
    return `${payer} ${receiver}`;
  };

  const record = ({ fromUserId, toUserId, amount }: SuggestedSettlement) => {
    const params = new URLSearchParams({
      tab: "settlements",
      record: "1",
      from: fromUserId,
      to: toUserId,
      amount,
    });
    void navigate(`/groups/${group.id}?${params}`);
  };

  return (
    <div className="space-y-6">
      {query.isError && <QueryError error={query.error} onRetry={() => void query.refetch()} />}

      <section aria-labelledby="balances-heading">
        <h2 id="balances-heading" className="mb-3 text-lg font-semibold text-slate-900">
          Balances
        </h2>
        <Card>
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => {
              const isYou = row.userId === user.id;
              return (
                <li
                  key={row.userId}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={row.name} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium break-words text-slate-900">
                        <span className="min-w-0 break-words">{isYou ? "You" : row.name}</span>
                        {formerMembers.has(row.userId) && <Badge>Left</Badge>}
                      </p>
                      <p className="text-xs text-slate-500">{balanceLabel(row.net, isYou)}</p>
                    </div>
                  </div>
                  <Money amount={row.net} currency={currency} signed className="shrink-0" />
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="repayments-heading">
        <h2 id="repayments-heading" className="mb-3 text-lg font-semibold text-slate-900">
          Suggested repayments
        </h2>
        <Card>
          {suggestedSettlements.length === 0 ? (
            <p className="text-sm text-slate-600">Everyone is settled up</p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {suggestedSettlements.map((suggestion) => {
                  const textId = `repayment-${suggestion.fromUserId}-${suggestion.toUserId}`;
                  return (
                    <li
                      key={textId}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0"
                    >
                      <p id={textId} className="min-w-0 text-sm break-words text-slate-700">
                        {repaymentText(suggestion)}{" "}
                        <Money amount={suggestion.amount} currency={currency} />
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="shrink-0"
                        aria-describedby={textId}
                        onClick={() => record(suggestion)}
                      >
                        Record
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                Suggestions don't count settlements still waiting for confirmation.
              </p>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
