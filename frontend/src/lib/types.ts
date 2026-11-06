// Response and input shapes for the backend API. Money values are strings such as "100.50",
// and dates are strings in YYYY-MM-DD format.

export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type AuthResult = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export type Group = {
  id: string;
  name: string;
  currency: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type Member = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  leftAt: string | null;
};

export type GroupWithMembers = Group & { members: Member[] };

export type ExpenseSplit = {
  userId: string;
  shareAmount: string;
};

export type Expense = {
  id: string;
  groupId: string;
  description: string;
  amount: string;
  expenseDate: string;
  paidById: string;
  createdById: string;
  splits: ExpenseSplit[];
  createdAt: string;
  updatedAt: string;
};

export type ExpenseInput = {
  description: string;
  amount: string;
  expenseDate: string;
  paidById: string;
  splits: ExpenseSplit[];
};

export type SettlementStatus = "PENDING" | "CONFIRMED" | "REJECTED";

export type Settlement = {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  createdById: string;
  amount: string;
  settledOn: string;
  status: SettlementStatus;
  respondedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SettlementInput = {
  fromUserId: string;
  toUserId: string;
  amount: string;
  settledOn: string;
  note?: string;
};

export type MemberBalance = {
  userId: string;
  name: string;
  net: string; // Positive means the member is owed money.
};

export type SuggestedSettlement = {
  fromUserId: string;
  toUserId: string;
  amount: string;
};

export type GroupBalances = {
  currency: string;
  balances: MemberBalance[];
  suggestedSettlements: SuggestedSettlement[];
};

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};

export type PageParams = {
  page?: number;
  limit?: number;
};

export type ExpenseFilters = PageParams & {
  from?: string;
  to?: string;
};

export type SettlementFilters = PageParams & {
  status?: SettlementStatus;
};
