import { Prisma } from "../generated/prisma/client.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { listResponse, serializeExpense } from "../lib/serializers.js";
import type { Pagination } from "../lib/validation.js";
import { assertActiveMembers, withGroupWrite, type Db } from "./groupAccess.js";

const { Decimal } = Prisma;

export type SplitInput = { userId: string; shareAmount: string };

export type CreateExpenseInput = {
  description: string;
  amount: string;
  expenseDate: Date;
  paidById: string;
  splits: SplitInput[];
};

export type UpdateExpenseInput = {
  [Key in keyof CreateExpenseInput]?: CreateExpenseInput[Key] | undefined;
};

export type ExpenseFilters = Pagination & { from?: Date | undefined; to?: Date | undefined };

function assertSplitsAddUp(amount: Prisma.Decimal | string, splits: SplitInput[]): void {
  if (new Set(splits.map((split) => split.userId)).size !== splits.length) {
    throw badRequest("Each user can only have one share of an expense");
  }
  const total = splits.reduce((sum, split) => sum.plus(split.shareAmount), new Decimal(0));
  if (!total.equals(amount)) {
    throw badRequest("Shares must add up exactly to the expense amount");
  }
}

async function loadExpense(db: Db, groupId: string, expenseId: string) {
  const expense = await db.expense.findFirst({
    where: { id: expenseId, groupId, deletedAt: null },
    include: { splits: { orderBy: { userId: "asc" } } },
  });
  if (!expense) throw notFound("Expense not found");
  return expense;
}

type LoadedExpense = Awaited<ReturnType<typeof loadExpense>>;

function assertCanChange(expense: LoadedExpense, callerId: string): void {
  if (expense.createdById !== callerId && expense.paidById !== callerId) {
    throw forbidden("Only the person who logged or paid this expense can change it");
  }
}

// Changing such an expense would alter the balance of someone who has already left.
async function assertNoFormerMembers(tx: Db, expense: LoadedExpense): Promise<void> {
  const former = await tx.groupMember.count({
    where: {
      groupId: expense.groupId,
      leftAt: { not: null },
      userId: { in: [expense.paidById, ...expense.splits.map((split) => split.userId)] },
    },
  });
  if (former > 0) {
    throw conflict("This expense involves a former member, so its amounts can't be changed");
  }
}

function splitsDiffer(expense: LoadedExpense, splits: SplitInput[]): boolean {
  if (splits.length !== expense.splits.length) return true;
  const current = new Map(expense.splits.map((split) => [split.userId, split.shareAmount]));
  return splits.some((split) => !current.get(split.userId)?.equals(split.shareAmount));
}

export async function listExpenses(groupId: string, filters: ExpenseFilters) {
  const where: Prisma.ExpenseWhereInput = {
    groupId,
    deletedAt: null,
    ...((filters.from || filters.to) && {
      expenseDate: {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: filters.to }),
      },
    }),
  };
  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { splits: { orderBy: { userId: "asc" } } },
      orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.expense.count({ where }),
  ]);
  return listResponse(expenses.map(serializeExpense), total, filters);
}

export function createExpense(groupId: string, callerId: string, input: CreateExpenseInput) {
  assertSplitsAddUp(input.amount, input.splits);
  return withGroupWrite(groupId, callerId, async (tx) => {
    await assertActiveMembers(tx, groupId, [
      input.paidById,
      ...input.splits.map((split) => split.userId),
    ]);
    const expense = await tx.expense.create({
      data: {
        groupId,
        createdById: callerId,
        paidById: input.paidById,
        description: input.description,
        amount: input.amount,
        expenseDate: input.expenseDate,
        splits: { create: input.splits },
      },
      include: { splits: { orderBy: { userId: "asc" } } },
    });
    return serializeExpense(expense);
  });
}

export async function getExpense(groupId: string, expenseId: string) {
  return serializeExpense(await loadExpense(prisma, groupId, expenseId));
}

export function updateExpense(
  groupId: string,
  expenseId: string,
  callerId: string,
  input: UpdateExpenseInput,
) {
  if (input.amount !== undefined && input.splits !== undefined) {
    assertSplitsAddUp(input.amount, input.splits);
  }
  return withGroupWrite(groupId, callerId, async (tx) => {
    const expense = await loadExpense(tx, groupId, expenseId);
    assertCanChange(expense, callerId);

    const paidById = input.paidById ?? expense.paidById;
    const amountChanged = input.amount !== undefined && !expense.amount.equals(input.amount);
    const splitsChanged = input.splits !== undefined && splitsDiffer(expense, input.splits);

    if (paidById !== expense.paidById || amountChanged || splitsChanged) {
      await assertNoFormerMembers(tx, expense);
      const shareHolders = (input.splits ?? expense.splits).map((split) => split.userId);
      await assertActiveMembers(tx, groupId, [paidById, ...shareHolders]);
    }

    const updated = await tx.expense.update({
      where: { id: expenseId },
      data: {
        paidById,
        ...(input.description !== undefined && { description: input.description }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.expenseDate !== undefined && { expenseDate: input.expenseDate }),
        ...(splitsChanged && { splits: { deleteMany: {}, create: input.splits! } }),
      },
      include: { splits: { orderBy: { userId: "asc" } } },
    });
    return serializeExpense(updated);
  });
}

export function deleteExpense(groupId: string, expenseId: string, callerId: string): Promise<void> {
  return withGroupWrite(groupId, callerId, async (tx) => {
    const expense = await loadExpense(tx, groupId, expenseId);
    assertCanChange(expense, callerId);
    await assertNoFormerMembers(tx, expense);
    await tx.expense.update({ where: { id: expenseId }, data: { deletedAt: new Date() } });
  });
}
