import type { Prisma } from "../generated/prisma/client.js";
import type { Pagination } from "./validation.js";

type UserRow = Prisma.UserGetPayload<object>;
type GroupRow = Prisma.GroupGetPayload<object>;
type SettlementRow = Prisma.SettlementGetPayload<object>;
type ExpenseRow = Prisma.ExpenseGetPayload<{ include: { splits: true } }>;
type MemberRow = Prisma.GroupMemberGetPayload<{ include: { user: true } }>;

export const money = (value: Prisma.Decimal) => value.toFixed(2);
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

export const serializeUser = (user: UserRow) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt,
});

export const serializeGroup = (group: GroupRow) => ({
  id: group.id,
  name: group.name,
  currency: group.currency,
  createdById: group.createdById,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});

export const serializeMember = (member: MemberRow) => ({
  userId: member.userId,
  name: member.user.name,
  email: member.user.email,
  joinedAt: member.createdAt,
  leftAt: member.leftAt,
});

export const serializeExpense = (expense: ExpenseRow) => ({
  id: expense.id,
  groupId: expense.groupId,
  description: expense.description,
  amount: money(expense.amount),
  expenseDate: dateOnly(expense.expenseDate),
  paidById: expense.paidById,
  createdById: expense.createdById,
  splits: expense.splits.map((split) => ({
    userId: split.userId,
    shareAmount: money(split.shareAmount),
  })),
  createdAt: expense.createdAt,
  updatedAt: expense.updatedAt,
});

export const serializeSettlement = (settlement: SettlementRow) => ({
  id: settlement.id,
  groupId: settlement.groupId,
  fromUserId: settlement.fromUserId,
  toUserId: settlement.toUserId,
  createdById: settlement.createdById,
  amount: money(settlement.amount),
  settledOn: dateOnly(settlement.settledOn),
  status: settlement.status,
  respondedAt: settlement.respondedAt,
  note: settlement.note,
  createdAt: settlement.createdAt,
  updatedAt: settlement.updatedAt,
});

export const listResponse = <T>(items: T[], total: number, { page, limit }: Pagination) => ({
  items,
  page,
  limit,
  total,
});
