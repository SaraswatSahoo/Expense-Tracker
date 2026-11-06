import { fromCents, splitEqually, toCents } from "../../lib/money";
import type { Expense, ExpenseSplit, GroupWithMembers } from "../../lib/types";

export type SplitMode = "equal" | "exact";

export type SplitState = {
  mode: SplitMode;
  ticked: string[];
  exact: Record<string, string>;
};

export type Assignment =
  | { kind: "noAmount" }
  | { kind: "fullyAssigned" }
  | { kind: "remaining"; cents: number }
  | { kind: "over"; cents: number };

export const equalState = (memberIds: string[]): SplitState => ({
  mode: "equal",
  ticked: memberIds,
  exact: {},
});

export const exactStateFromSplits = (splits: ExpenseSplit[]): SplitState => ({
  mode: "exact",
  ticked: splits.map((split) => split.userId),
  exact: Object.fromEntries(splits.map((split) => [split.userId, split.shareAmount])),
});

/** Each ticked person's share in whole cents, in member order. Zero if the amount runs out. */
export function equalShares(
  memberIds: string[],
  ticked: string[],
  amountCents: number | null,
): Map<string, number> {
  const people = memberIds.filter((id) => ticked.includes(id));
  const parts = splitEqually(amountCents ?? 0, people.length);
  return new Map(people.map((id, index) => [id, parts[index] ?? 0]));
}

export function exactShareError(text: string): string | undefined {
  if (text.trim() === "") return undefined;
  const cents = toCents(text);
  if (cents === null) return "Enter an amount such as 120.50";
  return cents === 0 ? "Must be more than 0" : undefined;
}

/** Everyone with a readable share, in whole cents. Blank and unreadable exact shares are left out. */
export function shareCents(
  state: SplitState,
  memberIds: string[],
  amountCents: number | null,
): Map<string, number> {
  if (state.mode === "equal") return equalShares(memberIds, state.ticked, amountCents);
  const shares = new Map<string, number>();
  for (const id of memberIds) {
    const cents = toCents(state.exact[id] ?? "");
    if (cents !== null) shares.set(id, cents);
  }
  return shares;
}

const sum = (values: Iterable<number>) => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

export function assignment(
  state: SplitState,
  memberIds: string[],
  amountCents: number | null,
): Assignment {
  if (amountCents === null || amountCents <= 0) return { kind: "noAmount" };
  const difference = amountCents - sum(shareCents(state, memberIds, amountCents).values());
  if (difference === 0) return { kind: "fullyAssigned" };
  return difference > 0
    ? { kind: "remaining", cents: difference }
    : { kind: "over", cents: -difference };
}

/** Ticked people the equal split can't give a cent to, because the amount is too small. */
export function peopleLeftOut(
  state: SplitState,
  memberIds: string[],
  amountCents: number | null,
): string[] {
  if (state.mode !== "equal" || amountCents === null || amountCents <= 0) return [];
  return [...equalShares(memberIds, state.ticked, amountCents)]
    .filter(([, cents]) => cents === 0)
    .map(([id]) => id);
}

/** The shares to send. The API rejects zero shares, so those are left out. */
export function toSplits(
  state: SplitState,
  memberIds: string[],
  amountCents: number | null,
): ExpenseSplit[] {
  return [...shareCents(state, memberIds, amountCents)]
    .filter(([, cents]) => cents > 0)
    .map(([userId, cents]) => ({ userId, shareAmount: fromCents(cents) }));
}

/** Why these shares can't be saved yet, or null if they can. Assumes a valid amount. */
export function splitProblem(
  state: SplitState,
  memberIds: string[],
  amountCents: number | null,
): string | null {
  if (
    state.mode === "exact" &&
    memberIds.some((id) => exactShareError(state.exact[id] ?? "") !== undefined)
  ) {
    return "Fix the share amounts marked in red.";
  }
  if (toSplits(state, memberIds, amountCents).length === 0) {
    return "Choose at least one person to share this expense.";
  }
  return assignment(state, memberIds, amountCents).kind === "fullyAssigned"
    ? null
    : "The shares must add up exactly to the amount.";
}

export function switchMode(
  state: SplitState,
  mode: SplitMode,
  memberIds: string[],
  amountCents: number | null,
): SplitState {
  if (state.mode === mode) return state;

  if (mode === "exact") {
    // Without a usable amount there's nothing to prefill, so anything typed earlier is kept.
    if (amountCents === null || amountCents <= 0) return { ...state, mode };
    const exact: Record<string, string> = {};
    for (const [id, cents] of equalShares(memberIds, state.ticked, amountCents)) {
      if (cents > 0) exact[id] = fromCents(cents);
    }
    return { ...state, mode, exact };
  }

  // Keep the same people involved. With no one entered yet, keep the earlier ticks.
  const holders = memberIds.filter((id) => {
    const text = (state.exact[id] ?? "").trim();
    return text !== "" && toCents(text) !== 0;
  });
  return { ...state, mode, ticked: holders.length > 0 ? holders : state.ticked };
}

/**
 * Anyone who isn't an active member counts as former, so an expense can never be opened in an
 * editor that only lists active members and would silently drop their share.
 */
export function involvesFormerMember(group: GroupWithMembers, expense: Expense): boolean {
  const active = new Set(
    group.members.filter((member) => member.leftAt === null).map((member) => member.userId),
  );
  return [expense.paidById, ...expense.splits.map((split) => split.userId)].some(
    (id) => !active.has(id),
  );
}

export const canChangeExpense = (expense: Expense, userId: string): boolean =>
  expense.createdById === userId || expense.paidById === userId;
