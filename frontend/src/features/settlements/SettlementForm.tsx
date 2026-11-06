import { useMutation } from "@tanstack/react-query";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "../../components/Button";
import { Alert } from "../../components/Feedback";
import { InputField, SelectField } from "../../components/FormField";
import { useCurrentUser } from "../../hooks/useAuth";
import { activeMembers, useInvalidateGroup } from "../../hooks/useGroup";
import { errorMessage, fieldError, settlementsApi } from "../../lib/api";
import { todayIso } from "../../lib/format";
import { fromCents, toCents } from "../../lib/money";
import type { GroupWithMembers, SettlementInput } from "../../lib/types";

/** Untrusted values from the URL, as linked from the Balances tab. */
export type SettlementPrefill = {
  from: string | null;
  to: string | null;
  amount: string | null;
};

function initialParties(memberIds: string[], currentUserId: string, prefill: SettlementPrefill | null) {
  const activeOnly = (id: string | null | undefined) => (id && memberIds.includes(id) ? id : null);
  const firstExcept = (excluded: string | null) => memberIds.find((id) => id !== excluded) ?? "";

  const wantedFrom = activeOnly(prefill?.from);
  const wantedTo = activeOnly(prefill?.to);
  const defaultFrom =
    memberIds.includes(currentUserId) && currentUserId !== wantedTo
      ? currentUserId
      : firstExcept(wantedTo);
  const from = wantedFrom ?? defaultFrom;
  const to = wantedTo && wantedTo !== from ? wantedTo : firstExcept(from);
  return { from, to };
}

function initialAmount(prefill: SettlementPrefill | null): string {
  const cents = toCents(prefill?.amount ?? "");
  return cents !== null && cents > 0 ? fromCents(cents) : "";
}

export function SettlementForm({
  group,
  prefill,
  onClose,
}: {
  group: GroupWithMembers;
  prefill: SettlementPrefill | null;
  onClose: () => void;
}) {
  const currentUser = useCurrentUser();
  const invalidate = useInvalidateGroup(group.id);
  const members = activeMembers(group);

  const [parties] = useState(() =>
    initialParties(
      members.map((member) => member.userId),
      currentUser.id,
      prefill,
    ),
  );
  const [fromUserId, setFromUserId] = useState(parties.from);
  const [toUserId, setToUserId] = useState(parties.to);
  const [amount, setAmount] = useState(() => initialAmount(prefill));
  const [amountTouched, setAmountTouched] = useState(false);
  const [settledOn, setSettledOn] = useState(todayIso);
  const [note, setNote] = useState("");

  const create = useMutation({
    mutationFn: (input: SettlementInput) => settlementsApi.create(group.id, input),
    onSuccess: () => invalidate(),
  });

  if (members.length < 2) {
    return (
      <div className="space-y-4">
        <Alert tone="info">Add a member to this group first, so there's someone to repay.</Alert>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const amountCents = toCents(amount);
  const amountIsValid = amountCents !== null && amountCents > 0;
  const sameParty = fromUserId === toUserId;
  const canSubmit = !sameParty && amountIsValid && settledOn !== "";

  let amountProblem: string | undefined;
  if (amountTouched && !amountIsValid) {
    amountProblem =
      amountCents === 0 ? "Amount must be greater than 0." : "Enter an amount such as 100.50.";
  }

  // Clears the API's errors as soon as the user starts correcting them.
  const onEdit =
    (update: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      update(event.target.value);
      if (create.isError) create.reset();
    };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || amountCents === null || create.isPending) return;
    const trimmedNote = note.trim();
    create.mutate(
      {
        fromUserId,
        toUserId,
        amount: fromCents(amountCents),
        settledOn,
        ...(trimmedNote ? { note: trimmedNote } : {}),
      },
      // Passed here rather than to useMutation, so it's skipped if the modal was closed meanwhile.
      { onSuccess: onClose },
    );
  };

  const memberOptions = members.map((member) => (
    <option key={member.userId} value={member.userId}>
      {member.userId === currentUser.id ? `${member.name} (you)` : member.name}
    </option>
  ));

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <SelectField
        label="From"
        value={fromUserId}
        onChange={onEdit(setFromUserId)}
        error={fieldError(create.error, "fromUserId")}
      >
        {memberOptions}
      </SelectField>
      <SelectField
        label="To"
        value={toUserId}
        onChange={onEdit(setToUserId)}
        error={
          sameParty ? "From and To must be different people." : fieldError(create.error, "toUserId")
        }
      >
        {memberOptions}
      </SelectField>
      <InputField
        label="Amount"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={amount}
        onChange={onEdit(setAmount)}
        onBlur={() => setAmountTouched(true)}
        error={amountProblem ?? fieldError(create.error, "amount")}
      />
      <InputField
        label="Date"
        type="date"
        value={settledOn}
        onChange={onEdit(setSettledOn)}
        error={fieldError(create.error, "settledOn")}
      />
      <InputField
        label="Note"
        type="text"
        maxLength={500}
        hint="Optional"
        value={note}
        onChange={onEdit(setNote)}
        error={fieldError(create.error, "note")}
      />
      {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit} loading={create.isPending}>
          Save repayment
        </Button>
      </div>
    </form>
  );
}
