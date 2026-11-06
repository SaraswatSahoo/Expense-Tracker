import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { groupsApi, settlementsApi } from "../../lib/api";
import { netToCents } from "../../lib/money";
import { queryKeys } from "../../lib/queryKeys";
import type { Group, GroupBalances, Paginated, Settlement } from "../../lib/types";

export const GROUP_LIMIT = 100;
const PENDING_FILTERS = { status: "PENDING", limit: 100 } as const;

export type DashboardGroup = {
  group: Group;
  balances: UseQueryResult<GroupBalances>;
  pending: UseQueryResult<Paginated<Settlement>>;
};

/** There's no cross-group endpoint, so this loads each group's balances and pending settlements. */
export function useDashboardData() {
  const groupList = useQuery({
    queryKey: queryKeys.groupList({ limit: GROUP_LIMIT }),
    queryFn: () => groupsApi.list({ limit: GROUP_LIMIT }),
  });
  const items = groupList.data?.items ?? [];

  const balances = useQueries({
    queries: items.map((group) => ({
      queryKey: queryKeys.balances(group.id),
      queryFn: () => groupsApi.balances(group.id),
    })),
  });
  const pending = useQueries({
    queries: items.map((group) => ({
      queryKey: queryKeys.settlements(group.id, PENDING_FILTERS),
      queryFn: () => settlementsApi.list(group.id, PENDING_FILTERS),
    })),
  });

  const groups: DashboardGroup[] = items.map((group, index) => ({
    group,
    balances: balances[index]!,
    pending: pending[index]!,
  }));

  return { groupList, groups };
}

/** The user's net in whole cents. Positive means they are owed money. */
export function userNetCents(balances: GroupBalances, userId: string): number {
  const own = balances.balances.find((balance) => balance.userId === userId);
  return own ? netToCents(own.net) : 0;
}
