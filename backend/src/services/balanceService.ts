import { Prisma } from "../generated/prisma/client.js";
import { notFound } from "../lib/errors.js";
import { money } from "../lib/serializers.js";
import type { Db } from "./groupAccess.js";

const { Decimal } = Prisma;
type Amount = Prisma.Decimal;

// net = expenses paid - shares owed + confirmed settlements paid - confirmed settlements received
export async function getNetBalances(db: Db, groupId: string): Promise<Map<string, Amount>> {
  const liveSettlement = { groupId, status: "CONFIRMED", deletedAt: null } as const;
  const [paid, owed, settled, received] = await Promise.all([
    db.expense.groupBy({
      by: ["paidById"],
      where: { groupId, deletedAt: null },
      _sum: { amount: true },
    }),
    db.expenseSplit.groupBy({
      by: ["userId"],
      where: { expense: { groupId, deletedAt: null } },
      _sum: { shareAmount: true },
    }),
    db.settlement.groupBy({ by: ["fromUserId"], where: liveSettlement, _sum: { amount: true } }),
    db.settlement.groupBy({ by: ["toUserId"], where: liveSettlement, _sum: { amount: true } }),
  ]);

  const nets = new Map<string, Amount>();
  const add = (userId: string, amount: Amount | null) => {
    if (amount) nets.set(userId, (nets.get(userId) ?? new Decimal(0)).plus(amount));
  };
  for (const row of paid) add(row.paidById, row._sum.amount);
  for (const row of owed) add(row.userId, row._sum.shareAmount?.negated() ?? null);
  for (const row of settled) add(row.fromUserId, row._sum.amount);
  for (const row of received) add(row.toUserId, row._sum.amount?.negated() ?? null);
  return nets;
}

// Matches the largest debtor with the largest creditor until everyone is settled.
function suggestSettlements(nets: Map<string, Amount>) {
  const byLargest = (a: { amount: Amount }, b: { amount: Amount }) => b.amount.comparedTo(a.amount);
  const creditors = [...nets]
    .filter(([, net]) => net.greaterThan(0))
    .map(([userId, net]) => ({ userId, amount: net }))
    .sort(byLargest);
  const debtors = [...nets]
    .filter(([, net]) => net.lessThan(0))
    .map(([userId, net]) => ({ userId, amount: net.negated() }))
    .sort(byLargest);

  const suggestions: { fromUserId: string; toUserId: string; amount: string }[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const creditor = creditors[c]!;
    const debtor = debtors[d]!;
    const amount = Decimal.min(creditor.amount, debtor.amount);
    suggestions.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amount: money(amount),
    });
    creditor.amount = creditor.amount.minus(amount);
    debtor.amount = debtor.amount.minus(amount);
    if (creditor.amount.isZero()) c++;
    if (debtor.amount.isZero()) d++;
  }
  return suggestions;
}

export async function getGroupBalances(db: Db, groupId: string) {
  const group = await db.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!group) throw notFound("Group not found");

  const nets = await getNetBalances(db, groupId);
  return {
    currency: group.currency,
    balances: group.members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      net: money(nets.get(member.userId) ?? new Decimal(0)),
    })),
    suggestedSettlements: suggestSettlements(nets),
  };
}
