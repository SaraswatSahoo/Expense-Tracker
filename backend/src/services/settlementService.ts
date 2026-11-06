import type { SettlementStatus } from "../generated/prisma/client.js";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { listResponse, serializeSettlement } from "../lib/serializers.js";
import type { Pagination } from "../lib/validation.js";
import { assertActiveMembers, withGroupWrite, type Db } from "./groupAccess.js";

export type CreateSettlementInput = {
  fromUserId: string;
  toUserId: string;
  amount: string;
  settledOn: Date;
  note?: string | undefined;
};

export type UpdateSettlementInput = {
  amount?: string | undefined;
  settledOn?: Date | undefined;
  note?: string | null | undefined;
};

export type SettlementFilters = Pagination & { status?: SettlementStatus | undefined };

async function loadSettlement(db: Db, groupId: string, settlementId: string) {
  const settlement = await db.settlement.findFirst({
    where: { id: settlementId, groupId, deletedAt: null },
  });
  if (!settlement) throw notFound("Settlement not found");
  return settlement;
}

type LoadedSettlement = Awaited<ReturnType<typeof loadSettlement>>;

function assertCanChange(settlement: LoadedSettlement, callerId: string): void {
  if (settlement.createdById !== callerId && settlement.fromUserId !== callerId) {
    throw forbidden("Only the person who logged or paid this settlement can change it");
  }
  if (settlement.status !== "PENDING") {
    throw conflict("Only pending settlements can be changed");
  }
}

export async function listSettlements(groupId: string, filters: SettlementFilters) {
  const where = {
    groupId,
    deletedAt: null,
    ...(filters.status && { status: filters.status }),
  };
  const [settlements, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      orderBy: [{ settledOn: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.settlement.count({ where }),
  ]);
  return listResponse(settlements.map(serializeSettlement), total, filters);
}

export function createSettlement(groupId: string, callerId: string, input: CreateSettlementInput) {
  return withGroupWrite(groupId, callerId, async (tx) => {
    await assertActiveMembers(tx, groupId, [input.fromUserId, input.toUserId]);
    const settlement = await tx.settlement.create({
      data: {
        groupId,
        createdById: callerId,
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        amount: input.amount,
        settledOn: input.settledOn,
        note: input.note ?? null,
      },
    });
    return serializeSettlement(settlement);
  });
}

export async function getSettlement(groupId: string, settlementId: string) {
  return serializeSettlement(await loadSettlement(prisma, groupId, settlementId));
}

export function updateSettlement(
  groupId: string,
  settlementId: string,
  callerId: string,
  input: UpdateSettlementInput,
) {
  return withGroupWrite(groupId, callerId, async (tx) => {
    const settlement = await loadSettlement(tx, groupId, settlementId);
    assertCanChange(settlement, callerId);
    const updated = await tx.settlement.update({
      where: { id: settlementId },
      data: {
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.settledOn !== undefined && { settledOn: input.settledOn }),
        ...(input.note !== undefined && { note: input.note }),
      },
    });
    return serializeSettlement(updated);
  });
}

export function deleteSettlement(
  groupId: string,
  settlementId: string,
  callerId: string,
): Promise<void> {
  return withGroupWrite(groupId, callerId, async (tx) => {
    const settlement = await loadSettlement(tx, groupId, settlementId);
    assertCanChange(settlement, callerId);
    await tx.settlement.update({ where: { id: settlementId }, data: { deletedAt: new Date() } });
  });
}

export function respondToSettlement(
  groupId: string,
  settlementId: string,
  callerId: string,
  status: "CONFIRMED" | "REJECTED",
) {
  return withGroupWrite(groupId, callerId, async (tx) => {
    const settlement = await loadSettlement(tx, groupId, settlementId);
    if (settlement.toUserId !== callerId) {
      throw forbidden("Only the person receiving the payment can respond to it");
    }
    // The status check is part of the update, so a double click can't apply twice.
    const { count } = await tx.settlement.updateMany({
      where: { id: settlementId, status: "PENDING", deletedAt: null },
      data: { status, respondedAt: new Date() },
    });
    if (count === 0) {
      throw conflict("This settlement has already been confirmed or rejected");
    }
    return serializeSettlement(await loadSettlement(tx, groupId, settlementId));
  });
}
