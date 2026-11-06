import type { ExpenseFilters, PageParams, SettlementFilters } from "./types";

// Everything about one group sits under ["groups", groupId], so useInvalidateGroup can refresh it
// all at once after any change.
export const queryKeys = {
  groupList: (params: PageParams = {}) => ["groups", "list", params] as const,
  group: (groupId: string) => ["groups", groupId] as const,
  balances: (groupId: string) => ["groups", groupId, "balances"] as const,
  expenses: (groupId: string, filters: ExpenseFilters = {}) =>
    ["groups", groupId, "expenses", filters] as const,
  expense: (groupId: string, expenseId: string) =>
    ["groups", groupId, "expense", expenseId] as const,
  settlements: (groupId: string, filters: SettlementFilters = {}) =>
    ["groups", groupId, "settlements", filters] as const,
};
