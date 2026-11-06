import type { Prisma } from "../generated/prisma/client.js";
import { badRequest, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export type Db = Prisma.TransactionClient;

export async function assertActiveCaller(db: Db, groupId: string, userId: string): Promise<void> {
  const member = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member || member.leftAt) {
    throw notFound("Group not found");
  }
}

// Every write that affects balances or membership runs through here. Locking the group row makes
// those writes take turns, so a member can't leave while an expense naming them is being saved.
export function withGroupWrite<T>(
  groupId: string,
  callerId: string,
  work: (tx: Db) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "id" = ${groupId}::uuid FOR UPDATE`;
      await assertActiveCaller(tx, groupId, callerId);
      return work(tx);
    },
    { maxWait: 10_000, timeout: 15_000 },
  );
}

export async function assertActiveMembers(
  db: Db,
  groupId: string,
  userIds: string[],
): Promise<void> {
  const unique = [...new Set(userIds)];
  const active = await db.groupMember.count({
    where: { groupId, userId: { in: unique }, leftAt: null },
  });
  if (active !== unique.length) {
    throw badRequest("Everyone involved must be an active member of the group");
  }
}
