import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { Button, LinkButton } from "../../components/Button";
import { Card, PageHeader } from "../../components/Card";
import { Alert, Badge, EmptyState, QueryError } from "../../components/Feedback";
import { InputField, SelectField } from "../../components/FormField";
import { Money } from "../../components/Money";
import { LoadingBlock } from "../../components/Spinner";
import { useCurrentUser } from "../../hooks/useAuth";
import { activeMembers, useGroup, useInvalidateGroup, useMemberName } from "../../hooks/useGroup";
import { ApiError, errorMessage, expensesApi, fieldError } from "../../lib/api";
import { formatDate, todayIso } from "../../lib/format";
import { fromCents, toCents } from "../../lib/money";
import { queryKeys } from "../../lib/queryKeys";
import type { Expense, GroupWithMembers } from "../../lib/types";
import { SplitEditor } from "./SplitEditor";
import {
  canChangeExpense,
  equalState,
  exactStateFromSplits,
  involvesFormerMember,
  splitProblem,
  toSplits,
  type SplitState,
} from "./splitLogic";

const FIELDS_WITH_OWN_ERROR = ["description", "amount", "expenseDate", "paidById"];

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

function ReadOnlyDetails({ group, expense }: { group: GroupWithMembers; expense: Expense }) {
  const user = useCurrentUser();
  const memberName = useMemberName(group, user.id);
  const hasLeft = (userId: string) =>
    group.members.some((member) => member.userId === userId && member.leftAt !== null);
  const leftBadge = (userId: string) => hasLeft(userId) && <Badge>Left group</Badge>;

  return (
    <dl className="space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <dt className="text-slate-500">Amount</dt>
        <dd>
          <Money amount={expense.amount} currency={group.currency} className="text-slate-900" />
        </dd>
      </div>
      <div className="flex items-start justify-between gap-3">
        <dt className="shrink-0 text-slate-500">Paid by</dt>
        <dd className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 text-right text-slate-900">
          <span className="min-w-0 break-words">{memberName(expense.paidById)}</span>
          {leftBadge(expense.paidById)}
        </dd>
      </div>
      <div>
        <dt className="mb-1 text-slate-500">Shares</dt>
        <dd>
          <ul className="space-y-1">
            {expense.splits.map((split) => (
              <li key={split.userId} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-slate-800">
                  <span className="min-w-0 break-words">{memberName(split.userId)}</span>
                  {leftBadge(split.userId)}
                </span>
                <Money amount={split.shareAmount} currency={group.currency} className="text-slate-900" />
              </li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  );
}

function ExpenseForm({ group, expense }: { group: GroupWithMembers; expense?: Expense }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const invalidate = useInvalidateGroup(group.id);
  const backTo = `/groups/${group.id}?tab=expenses`;

  const members = activeMembers(group);
  const memberIds = members.map((member) => member.userId);

  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense?.amount ?? "");
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? todayIso());
  const [paidById, setPaidById] = useState(
    expense?.paidById ?? (memberIds.includes(user.id) ? user.id : (memberIds[0] ?? "")),
  );
  const [split, setSplit] = useState<SplitState>(() =>
    expense ? exactStateFromSplits(expense.splits) : equalState(memberIds),
  );

  // Worked out on every render, so a member leaving while this form is open locks it straight away.
  const locked = expense !== undefined && involvesFormerMember(group, expense);

  const parsedAmount = toCents(amount);
  const amountCents = parsedAmount !== null && parsedAmount > 0 ? parsedAmount : null;
  const payerIsActive = memberIds.includes(paidById);

  const save = useMutation({
    mutationFn: () => {
      const details = { description: description.trim(), expenseDate };
      if (expense && locked) return expensesApi.update(group.id, expense.id, details);
      const input = {
        ...details,
        amount: fromCents(amountCents ?? 0),
        paidById,
        splits: toSplits(split, memberIds, amountCents),
      };
      return expense
        ? expensesApi.update(group.id, expense.id, input)
        : expensesApi.create(group.id, input);
    },
    onSuccess: async () => {
      await invalidate();
      navigate(backTo);
    },
    onError: (error) => {
      // A conflict means the group changed elsewhere, so refresh what this form is based on.
      if (error instanceof ApiError && error.status === 409) void invalidate();
    },
  });

  const amountError =
    amount.trim() === ""
      ? undefined
      : parsedAmount === null
        ? "Enter an amount such as 120.50"
        : parsedAmount === 0
          ? "Amount must be more than 0"
          : undefined;

  let blocked: string | null = null;
  if (description.trim() === "") blocked = "Enter a description.";
  else if (!locked && amountCents === null) blocked = "Enter an amount greater than 0.";
  else if (expenseDate === "") blocked = "Choose a date.";
  else if (!locked && !payerIsActive) blocked = "Choose who paid.";
  else if (!locked) blocked = splitProblem(split, memberIds, amountCents);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (blocked === null && !save.isPending) save.mutate();
  };

  const otherDetails =
    save.error instanceof ApiError
      ? save.error.details.filter((detail) => !FIELDS_WITH_OWN_ERROR.includes(detail.path))
      : [];

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        {locked && (
          <Alert tone="info">
            This expense involves a former member, so only its description and date can change.
          </Alert>
        )}

        <InputField
          label="Description"
          required
          maxLength={200}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={fieldError(save.error, "description")}
        />

        {!locked && (
          <InputField
            label="Amount"
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            hint={`In ${group.currency}`}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={amountError ?? fieldError(save.error, "amount")}
          />
        )}

        <InputField
          label="Date"
          type="date"
          required
          className="min-w-0"
          value={expenseDate}
          onChange={(event) => setExpenseDate(event.target.value)}
          error={fieldError(save.error, "expenseDate")}
        />

        {expense && locked ? (
          <ReadOnlyDetails group={group} expense={expense} />
        ) : (
          <>
            <SelectField
              label="Paid by"
              required
              value={payerIsActive ? paidById : ""}
              onChange={(event) => setPaidById(event.target.value)}
              error={fieldError(save.error, "paidById")}
            >
              {!payerIsActive && (
                <option value="" disabled>
                  Choose who paid
                </option>
              )}
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.userId === user.id ? `${member.name} (you)` : member.name}
                </option>
              ))}
            </SelectField>

            <SplitEditor
              members={members}
              amountCents={amountCents}
              currency={group.currency}
              value={split}
              onChange={setSplit}
              currentUserId={user.id}
            />
          </>
        )}

        {save.isError && (
          <Alert>
            {errorMessage(save.error)}
            {otherDetails.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {otherDetails.map((detail) => (
                  <li key={`${detail.path}:${detail.message}`}>{detail.message}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {blocked && <p className="text-xs text-slate-500">{blocked}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <LinkButton variant="secondary" to={backTo}>
            Cancel
          </LinkButton>
          <Button type="submit" disabled={blocked !== null} loading={save.isPending}>
            Save expense
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function ExpenseFormPage() {
  const { groupId = "", expenseId } = useParams();
  const user = useCurrentUser();
  const group = useGroup(groupId);
  const expense = useQuery({
    queryKey: queryKeys.expense(groupId, expenseId ?? ""),
    queryFn: () => expensesApi.get(groupId, expenseId ?? ""),
    enabled: expenseId !== undefined,
    // The form copies this once when it opens, so it must never start from an old cached copy.
    gcTime: 0,
  });

  const title = expenseId ? "Edit expense" : "Add expense";
  const backTo = `/groups/${groupId}?tab=expenses`;
  const page = (content: ReactNode) => (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={title} />
      {content}
    </div>
  );

  // Checking for data first keeps the form, and what's typed in it, if a background refresh fails.
  if (!group.data) {
    if (!group.isError) return page(<LoadingBlock />);
    if (isNotFound(group.error)) {
      return page(
        <EmptyState
          title="Group not found"
          action={
            <LinkButton variant="secondary" to="/groups">
              Back to groups
            </LinkButton>
          }
        />,
      );
    }
    return page(<QueryError error={group.error} onRetry={() => void group.refetch()} />);
  }

  if (!expenseId) return page(<ExpenseForm group={group.data} />);

  if (!expense.data) {
    if (!expense.isError) return page(<LoadingBlock />);
    if (isNotFound(expense.error)) {
      return page(
        <EmptyState
          title="Expense not found"
          description="It may have been deleted."
          action={
            <LinkButton variant="secondary" to={backTo}>
              Back to expenses
            </LinkButton>
          }
        />,
      );
    }
    return page(<QueryError error={expense.error} onRetry={() => void expense.refetch()} />);
  }

  if (!canChangeExpense(expense.data, user.id)) {
    return page(
      <div className="space-y-4">
        <Alert tone="warning">Only the person who logged or paid this expense can edit it.</Alert>
        <LinkButton variant="secondary" to={backTo}>
          Back to expenses
        </LinkButton>
      </div>,
    );
  }

  return page(<ExpenseForm key={expense.data.id} group={group.data} expense={expense.data} />);
}
