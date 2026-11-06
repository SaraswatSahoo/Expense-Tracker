import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge, EmptyState, QueryError, Alert } from "../../components/Feedback";
import { Button, LinkButton } from "../../components/Button";
import { Card } from "../../components/Card";
import { InputField } from "../../components/FormField";
import { ConfirmDialog } from "../../components/Modal";
import { Money } from "../../components/Money";
import { Pagination } from "../../components/Pagination";
import { LoadingBlock } from "../../components/Spinner";
import { useCurrentUser } from "../../hooks/useAuth";
import { useInvalidateGroup, useMemberName } from "../../hooks/useGroup";
import { expensesApi } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import type { Expense, ExpenseFilters, GroupWithMembers } from "../../lib/types";
import { canChangeExpense, involvesFormerMember } from "./splitLogic";

const LIMIT = 10;

function ExpenseCard({
  expense,
  group,
  onDelete,
}: {
  expense: Expense;
  group: GroupWithMembers;
  onDelete: (expense: Expense) => void;
}) {
  const user = useCurrentUser();
  const memberName = useMemberName(group, user.id);
  const canChange = canChangeExpense(expense, user.id);
  const former = involvesFormerMember(group, expense);
  const hasLeft = (userId: string) =>
    group.members.some((member) => member.userId === userId && member.leftAt !== null);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="font-medium break-words text-slate-900">{expense.description}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            <time dateTime={expense.expenseDate}>{formatDate(expense.expenseDate)}</time>
            {" · Paid by "}
            {expense.paidById === user.id ? "you" : memberName(expense.paidById)}
          </p>
        </div>
        <Money amount={expense.amount} currency={group.currency} className="text-lg text-slate-900" />
      </div>

      <ul aria-label="Shares" className="mt-3 grid gap-x-6 gap-y-1 border-t border-slate-100 pt-3 sm:grid-cols-2">
        {expense.splits.map((split) => (
          <li key={split.userId} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-slate-600">
              <span className="min-w-0 break-words">{memberName(split.userId)}</span>
              {hasLeft(split.userId) && <Badge>Left group</Badge>}
            </span>
            <Money amount={split.shareAmount} currency={group.currency} className="text-slate-800" />
          </li>
        ))}
      </ul>

      {canChange && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LinkButton
            variant="secondary"
            size="sm"
            to={`/groups/${group.id}/expenses/${expense.id}/edit`}
            aria-label={`Edit ${expense.description}`}
          >
            Edit
          </LinkButton>
          {former ? (
            <p className="text-xs text-slate-500">
              This can't be deleted because it involves a former member.
            </p>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              aria-label={`Delete ${expense.description}`}
              onClick={() => onDelete(expense)}
            >
              Delete
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export function ExpensesTab({ group }: { group: GroupWithMembers }) {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const invalidate = useInvalidateGroup(group.id);

  const filters: ExpenseFilters = {
    page,
    limit: LIMIT,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const expenses = useQuery({
    queryKey: queryKeys.expenses(group.id, filters),
    queryFn: () => expensesApi.list(group.id, filters),
    placeholderData: keepPreviousData,
  });
  const data = expenses.data;
  const showingCurrent = data !== undefined && !expenses.isPlaceholderData;

  // Deleting the only expense on the last page would otherwise leave an empty page behind.
  useEffect(() => {
    if (showingCurrent && data.items.length === 0 && page > 1) {
      setPage(Math.max(1, Math.ceil(data.total / LIMIT)));
    }
  }, [showingCurrent, data, page]);

  const remove = useMutation({
    mutationFn: (expenseId: string) => expensesApi.delete(group.id, expenseId),
    onSuccess: async () => {
      await invalidate();
      setDeleting(null);
    },
    // The list may be out of date, which is often why the delete was refused.
    onError: () => void invalidate(),
  });

  const openDelete = (expense: Expense) => {
    remove.reset();
    setDeleting(expense);
  };
  const closeDelete = () => {
    remove.reset();
    setDeleting(null);
  };

  const filtering = from !== "" || to !== "";
  const rangeBackwards = from !== "" && to !== "" && from > to;
  const isEmpty = data !== undefined && data.total === 0;
  const addLink = (
    <LinkButton to={`/groups/${group.id}/expenses/new`} size="sm">
      Add expense
    </LinkButton>
  );

  let list;
  if (data) {
    if (isEmpty) {
      list = (
        <EmptyState
          title={filtering ? "No expenses in these dates" : "No expenses yet"}
          description={
            filtering ? "Try different dates or clear them." : "Add the first expense to this group."
          }
          action={addLink}
        />
      );
    } else if (data.items.length === 0) {
      list = <LoadingBlock />;
    } else {
      list = (
        <div aria-busy={expenses.isPlaceholderData}>
          <ul className={`space-y-3 ${expenses.isPlaceholderData ? "opacity-60" : ""}`}>
            {data.items.map((expense) => (
              <li key={expense.id}>
                <ExpenseCard expense={expense} group={group} onDelete={openDelete} />
              </li>
            ))}
          </ul>
          <Pagination page={page} limit={LIMIT} total={data.total} onChange={setPage} />
        </div>
      );
    }
  } else if (expenses.isError) {
    // The API only says "Invalid input" for a backwards range, so name the problem here.
    list = rangeBackwards ? (
      <Alert>The "From" date can't be after the "To" date.</Alert>
    ) : (
      <QueryError error={expenses.error} onRetry={() => void expenses.refetch()} />
    );
  } else {
    list = <LoadingBlock />;
  }

  return (
    <section aria-label="Expenses" className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-0 flex-1 basis-full gap-3 sm:basis-96 sm:grid-cols-2">
          <InputField
            label="From"
            type="date"
            value={from}
            className="min-w-0"
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
          <InputField
            label="To"
            type="date"
            value={to}
            className="min-w-0"
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-0.5">
          {filtering && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom("");
                setTo("");
                setPage(1);
              }}
            >
              Clear dates
            </Button>
          )}
        </div>
      </div>

      {list}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete expense"
        message={
          <>
            Delete <span className="font-medium break-words">{deleting?.description}</span>? This
            removes it from everyone's balances.
          </>
        }
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
        onClose={closeDelete}
      />
    </section>
  );
}
