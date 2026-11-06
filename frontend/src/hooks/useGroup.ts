import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { groupsApi } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import type { GroupWithMembers, Member } from "../lib/types";

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: queryKeys.group(groupId),
    queryFn: () => groupsApi.get(groupId),
  });
}

/** Call after any change to a group, so its expenses, balances and the dashboard all update. */
export function useInvalidateGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) }),
      queryClient.invalidateQueries({ queryKey: ["groups", "list"] }),
    ]);
  }, [queryClient, groupId]);
}

export const activeMembers = (group: GroupWithMembers): Member[] =>
  group.members.filter((member) => member.leftAt === null);

/**
 * Looks up a member's name from their ID. Includes former members, because old expenses and
 * settlements still refer to them. Pass the current user's ID to show them as "You".
 */
export function useMemberName(group: GroupWithMembers, currentUserId?: string) {
  const names = useMemo(
    () => new Map(group.members.map((member) => [member.userId, member.name])),
    [group.members],
  );
  return useCallback(
    (userId: string) =>
      userId === currentUserId ? "You" : (names.get(userId) ?? "Unknown member"),
    [names, currentUserId],
  );
}
