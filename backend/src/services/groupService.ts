import { conflict, forbidden, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { listResponse, serializeGroup, serializeMember } from "../lib/serializers.js";
import type { Pagination } from "../lib/validation.js";
import { getNetBalances } from "./balanceService.js";
import { withGroupWrite, type Db } from "./groupAccess.js";

const withMembers = {
  members: { include: { user: true }, orderBy: { createdAt: "asc" } },
} as const;

export async function listGroups(userId: string, pagination: Pagination) {
  const where = { members: { some: { userId, leftAt: null } } };
  const [groups, total] = await Promise.all([
    prisma.group.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
    prisma.group.count({ where }),
  ]);
  return listResponse(groups.map(serializeGroup), total, pagination);
}

export async function createGroup(userId: string, input: { name: string; currency: string }) {
  const group = await prisma.group.create({
    data: { ...input, createdById: userId, members: { create: { userId } } },
    include: withMembers,
  });
  return { ...serializeGroup(group), members: group.members.map(serializeMember) };
}

export async function getGroup(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, include: withMembers });
  if (!group) throw notFound("Group not found");
  return { ...serializeGroup(group), members: group.members.map(serializeMember) };
}

export function updateGroup(
  groupId: string,
  callerId: string,
  input: { name?: string | undefined; currency?: string | undefined },
) {
  return withGroupWrite(groupId, callerId, async (tx) => {
    const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
    if (input.currency && input.currency !== group.currency) {
      // Soft-deleted rows count too: they could be restored in the old currency.
      const [expenses, settlements] = await Promise.all([
        tx.expense.count({ where: { groupId } }),
        tx.settlement.count({ where: { groupId } }),
      ]);
      if (expenses + settlements > 0) {
        throw conflict("Currency can't change once the group has expenses or settlements");
      }
    }
    const updated = await tx.group.update({
      where: { id: groupId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.currency !== undefined && { currency: input.currency }),
      },
    });
    return serializeGroup(updated);
  });
}

async function allBalancesAreZero(db: Db, groupId: string): Promise<boolean> {
  const nets = await getNetBalances(db, groupId);
  return [...nets.values()].every((net) => net.isZero());
}

export function deleteGroup(groupId: string, callerId: string): Promise<void> {
  return withGroupWrite(groupId, callerId, async (tx) => {
    const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
    if (group.createdById !== callerId) {
      throw forbidden("Only the group's creator can delete it");
    }
    if (!(await allBalancesAreZero(tx, groupId))) {
      throw conflict("Every balance must be zero before the group can be deleted");
    }
    await tx.group.delete({ where: { id: groupId } });
  });
}

export function addMember(groupId: string, callerId: string, email: string) {
  return withGroupWrite(groupId, callerId, async (tx) => {
    const user = await tx.user.findUnique({ where: { email } });
    if (!user) throw notFound("No registered user has that email");

    const key = { groupId_userId: { groupId, userId: user.id } };
    const existing = await tx.groupMember.findUnique({ where: key });
    if (existing && !existing.leftAt) {
      throw conflict("That user is already a member of this group");
    }
    const member = existing
      ? await tx.groupMember.update({
          where: key,
          data: { leftAt: null },
          include: { user: true },
        })
      : await tx.groupMember.create({
          data: { groupId, userId: user.id },
          include: { user: true },
        });
    return serializeMember(member);
  });
}

export function removeMember(groupId: string, callerId: string, userId: string): Promise<void> {
  return withGroupWrite(groupId, callerId, async (tx) => {
    const key = { groupId_userId: { groupId, userId } };
    const target = await tx.groupMember.findUnique({ where: key });
    if (!target || target.leftAt) {
      throw notFound("Member not found");
    }

    const nets = await getNetBalances(tx, groupId);
    if (nets.get(userId)?.isZero() === false) {
      throw conflict("A member can't leave with a non-zero balance");
    }
    const pending = await tx.settlement.count({
      where: {
        groupId,
        status: "PENDING",
        deletedAt: null,
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
    });
    if (pending > 0) {
      throw conflict("A member can't leave with a pending settlement");
    }
    await tx.groupMember.update({ where: key, data: { leftAt: new Date() } });
  });
}
