import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Alert, Badge } from "../../components/Feedback";
import { ConfirmDialog } from "../../components/Modal";
import { Money } from "../../components/Money";
import { useCurrentUser } from "../../hooks/useAuth";
import { useInvalidateGroup, useMemberName } from "../../hooks/useGroup";
import { ApiError, errorMessage, settlementsApi } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { formatMoney } from "../../lib/money";
import type { GroupWithMembers, Settlement, SettlementStatus } from "../../lib/types";

const statusBadges: Record<
  SettlementStatus,
  { label: string; tone: "warning" | "success" | "error" }
> = {
  PENDING: { label: "Pending", tone: "warning" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  REJECTED: { label: "Rejected", tone: "error" },
};

// Someone else already responded to or deleted it, so the list on screen is out of date.
const isStaleError = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 409);

export function SettlementCard({
  group,
  settlement,
}: {
  group: GroupWithMembers;
  settlement: Settlement;
}) {
  const currentUser = useCurrentUser();
  const memberName = useMemberName(group, currentUser.id);
  const invalidate = useInvalidateGroup(group.id);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const respond = useMutation({
    mutationFn: (action: "confirm" | "reject") =>
      action === "confirm"
        ? settlementsApi.confirm(group.id, settlement.id)
        : settlementsApi.reject(group.id, settlement.id),
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: () => settlementsApi.delete(group.id, settlement.id),
    onSuccess: () => invalidate(),
  });

  const closeDelete = () => {
    setDeleteOpen(false);
    if (remove.isPending) return;
    // Refreshing only now, because the refresh could remove this card and the error with it.
    if (isStaleError(remove.error)) void invalidate();
    remove.reset();
  };

  // A delete that fails after its dialog was closed has nowhere else to show its error.
  const cardError = respond.error ?? (deleteOpen ? null : remove.error);

  const refreshAfterError = () => {
    respond.reset();
    remove.reset();
    void invalidate();
  };

  const isPending = settlement.status === "PENDING";
  const isReceiver = settlement.toUserId === currentUser.id;
  const canRespond = isPending && isReceiver;
  const canDelete =
    isPending &&
    (settlement.createdById === currentUser.id || settlement.fromUserId === currentUser.id);
  const busy = respond.isPending || remove.isPending;

  const payer = memberName(settlement.fromUserId);
  const receiver = isReceiver ? "you" : memberName(settlement.toUserId);
  const badge = statusBadges[settlement.status];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-slate-900">
            {payer} paid {receiver} <Money amount={settlement.amount} currency={group.currency} />
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            <time dateTime={settlement.settledOn}>{formatDate(settlement.settledOn)}</time>
          </p>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      {settlement.note && (
        <p className="mt-2 text-sm break-words text-slate-700">{settlement.note}</p>
      )}

      {isPending && (
        <p className="mt-2 text-xs text-slate-500">
          {isReceiver
            ? "Balances won't change until you confirm."
            : `Balances won't change until ${receiver} confirms.`}
        </p>
      )}

      {Boolean(cardError) && (
        <div className="mt-3">
          <Alert>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words">{errorMessage(cardError)}</span>
              {isStaleError(cardError) && (
                <Button variant="secondary" size="sm" onClick={refreshAfterError}>
                  Refresh
                </Button>
              )}
            </div>
          </Alert>
        </div>
      )}

      {(canRespond || canDelete) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canRespond && (
            <>
              <Button
                size="sm"
                disabled={busy}
                loading={respond.isPending && respond.variables === "confirm"}
                onClick={() => respond.mutate("confirm")}
              >
                Confirm
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                loading={respond.isPending && respond.variables === "reject"}
                onClick={() => respond.mutate("reject")}
              >
                Reject
              </Button>
            </>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                remove.reset();
                setDeleteOpen(true);
              }}
            >
              Delete
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete repayment"
        message={`Delete this repayment of ${formatMoney(settlement.amount, group.currency)}? This can't be undone.`}
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate(undefined, { onSuccess: closeDelete })}
        onClose={closeDelete}
      />
    </Card>
  );
}
