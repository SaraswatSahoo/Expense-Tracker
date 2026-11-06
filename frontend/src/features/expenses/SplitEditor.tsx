import { Button } from "../../components/Button";
import { Alert } from "../../components/Feedback";
import { Input } from "../../components/FormField";
import { Money } from "../../components/Money";
import { fromCents, formatMoney } from "../../lib/money";
import type { Member } from "../../lib/types";
import {
  assignment,
  equalShares,
  exactShareError,
  peopleLeftOut,
  switchMode,
  type SplitMode,
  type SplitState,
} from "./splitLogic";

const modes: { value: SplitMode; label: string }[] = [
  { value: "equal", label: "Split equally" },
  { value: "exact", label: "Exact amounts" },
];

function AssignmentLine({
  state,
  memberIds,
  amountCents,
  currency,
}: {
  state: SplitState;
  memberIds: string[];
  amountCents: number | null;
  currency: string;
}) {
  const result = assignment(state, memberIds, amountCents);
  const money = (cents: number) => formatMoney(fromCents(cents), currency);
  const [text, color] =
    result.kind === "noAmount"
      ? ["Enter an amount to see what's left to assign", "text-slate-500"]
      : result.kind === "fullyAssigned"
        ? ["Fully assigned", "text-emerald-700"]
        : result.kind === "remaining"
          ? [`Remaining to assign: ${money(result.cents)}`, "text-amber-700"]
          : [`Over by ${money(result.cents)}`, "text-red-700"];
  return (
    <p aria-live="polite" className={`text-sm font-medium ${color}`}>
      {text}
    </p>
  );
}

export function SplitEditor({
  members,
  amountCents,
  currency,
  value,
  onChange,
  currentUserId,
}: {
  members: Member[];
  /** The expense amount in whole cents, or null while it isn't a usable amount. */
  amountCents: number | null;
  currency: string;
  value: SplitState;
  onChange: (next: SplitState) => void;
  currentUserId?: string;
}) {
  const memberIds = members.map((member) => member.userId);
  const nameOf = (member: Member) =>
    member.userId === currentUserId ? `${member.name} (you)` : member.name;
  const equal = equalShares(memberIds, value.ticked, amountCents);
  const leftOut = new Set(peopleLeftOut(value, memberIds, amountCents));

  const toggle = (userId: string, ticked: boolean) =>
    onChange({
      ...value,
      ticked: ticked ? [...value.ticked, userId] : value.ticked.filter((id) => id !== userId),
    });

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-1 text-sm font-medium text-slate-700">Shares</legend>

      <div role="group" aria-label="How to split" className="grid grid-cols-2 gap-2">
        {modes.map((mode) => (
          <Button
            key={mode.value}
            size="sm"
            variant={value.mode === mode.value ? "primary" : "secondary"}
            aria-pressed={value.mode === mode.value}
            onClick={() => onChange(switchMode(value, mode.value, memberIds, amountCents))}
          >
            {mode.label}
          </Button>
        ))}
      </div>

      <ul className="divide-y divide-slate-100">
        {members.map((member) => {
          if (value.mode === "equal") {
            const cents = equal.get(member.userId);
            return (
              <li key={member.userId} className="flex items-center justify-between gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-3 py-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={value.ticked.includes(member.userId)}
                    onChange={(event) => toggle(member.userId, event.target.checked)}
                    className="h-4 w-4 shrink-0 accent-brand-600"
                  />
                  <span className="min-w-0 break-words">{nameOf(member)}</span>
                </label>
                {cents !== undefined && amountCents !== null && amountCents > 0 && (
                  <span className="shrink-0 text-sm text-slate-700">
                    {cents > 0 ? (
                      <Money amount={fromCents(cents)} currency={currency} />
                    ) : (
                      <span className="text-slate-500">No share</span>
                    )}
                  </span>
                )}
              </li>
            );
          }

          const text = value.exact[member.userId] ?? "";
          const error = exactShareError(text);
          const errorId = `share-error-${member.userId}`;
          return (
            <li key={member.userId} className="py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 text-sm break-words text-slate-800">
                  {nameOf(member)}
                </span>
                <div className="w-28 shrink-0">
                  <Input
                    aria-label={`Share for ${member.name}`}
                    aria-invalid={error !== undefined}
                    aria-describedby={error ? errorId : undefined}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    value={text}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        exact: { ...value.exact, [member.userId]: event.target.value },
                      })
                    }
                    className={`text-right ${error ? "border-red-500!" : ""}`}
                  />
                </div>
              </div>
              {error && (
                <p id={errorId} className="mt-1 text-right text-xs text-red-600">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {leftOut.size > 0 && (
        <Alert tone="warning">
          The amount is too small to split between everyone, so{" "}
          {members
            .filter((member) => leftOut.has(member.userId))
            .map(nameOf)
            .join(", ")}{" "}
          won't get a share.
        </Alert>
      )}

      <AssignmentLine
        state={value}
        memberIds={memberIds}
        amountCents={amountCents}
        currency={currency}
      />
    </fieldset>
  );
}
