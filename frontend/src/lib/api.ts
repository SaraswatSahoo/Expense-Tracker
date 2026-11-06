import type {
  AuthResult,
  Expense,
  ExpenseFilters,
  ExpenseInput,
  Group,
  GroupBalances,
  GroupWithMembers,
  Member,
  PageParams,
  Paginated,
  Settlement,
  SettlementFilters,
  SettlementInput,
  User,
} from "./types";

export type FieldError = { path: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly details: FieldError[];

  constructor(status: number, message: string, details: FieldError[] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** A message that's safe to show to the user for any thrown value. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";
  // Rules about a whole request have no field to sit next to, so their message replaces the
  // generic "Invalid input".
  return error.details.find((detail) => detail.path === "")?.message ?? error.message;
}

/** The API's validation error for one input, such as `fieldError(error, "email")`. */
export function fieldError(error: unknown, path: string): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return error.details.find((detail) => detail.path === path)?.message;
}

// ---------- Session tokens ----------

const REFRESH_TOKEN_KEY = "expenseTracker.refreshToken";
let accessToken: string | null = null;
let refreshInProgress: Promise<boolean> | null = null;
const sessionExpiredListeners = new Set<() => void>();

export const hasStoredSession = () => localStorage.getItem(REFRESH_TOKEN_KEY) !== null;
export const REFRESH_TOKEN_STORAGE_KEY = REFRESH_TOKEN_KEY;

function storeTokens(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken;
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Runs when the session can't be renewed, so the app can return to the login page. */
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

// Each refresh token only works once. The browser lock makes other tabs wait, so they then read
// the newest token from localStorage instead of reusing one that has already been spent.
function withCrossTabLock<T>(work: () => Promise<T>): Promise<T> {
  return navigator.locks
    ? (navigator.locks.request("expenseTracker.refresh", work) as Promise<T>)
    : work();
}

async function requestNewTokens(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;

  const response = await sendRaw("POST", "/auth/refresh", { refreshToken });
  if (response.ok) {
    storeTokens(await response.json());
    return true;
  }
  if (response.status === 400 || response.status === 401) {
    // Another tab may have renewed the session in the moment before we took the lock.
    if (localStorage.getItem(REFRESH_TOKEN_KEY) !== refreshToken) return requestNewTokens();
    return false;
  }
  throw await toApiError(response);
}

/** Shares one refresh between simultaneous requests. Network errors don't end the session. */
function refreshSession(): Promise<boolean> {
  refreshInProgress ??= withCrossTabLock(requestNewTokens).finally(() => {
    refreshInProgress = null;
  });
  return refreshInProgress;
}

// ---------- Requests ----------

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function sendRaw(
  method: Method,
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<Response> {
  try {
    return await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const data = (await response.json()) as { error?: string; details?: FieldError[] };
    return new ApiError(response.status, data.error ?? "Request failed", data.details ?? []);
  } catch {
    return new ApiError(response.status, "Something went wrong. Please try again.");
  }
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response = await sendRaw(method, path, body, accessToken);

  if (response.status === 401) {
    if (await refreshSession()) {
      response = await sendRaw(method, path, body, accessToken);
    } else {
      clearTokens();
      sessionExpiredListeners.forEach((listener) => listener());
    }
  }

  if (!response.ok) throw await toApiError(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Requests that aren't logged in yet: a 401 here means wrong details, not an expired session. */
async function publicRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await sendRaw("POST", path, body);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

function queryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

// ---------- Endpoints ----------

export const authApi = {
  async login(input: { email: string; password: string }): Promise<User> {
    const result = await publicRequest<AuthResult>("/auth/login", input);
    storeTokens(result);
    return result.user;
  },
  async register(input: { name: string; email: string; password: string }): Promise<User> {
    const result = await publicRequest<AuthResult>("/auth/register", input);
    storeTokens(result);
    return result.user;
  },
  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    clearTokens();
    // Leaving locally still works if the server can't be reached.
    if (refreshToken) await sendRaw("POST", "/auth/logout", { refreshToken }).catch(() => {});
  },
  me: () => request<User>("GET", "/users/me"),
};

export const groupsApi = {
  list: (params: PageParams = {}) =>
    request<Paginated<Group>>("GET", `/groups${queryString(params)}`),
  create: (input: { name: string; currency: string }) =>
    request<GroupWithMembers>("POST", "/groups", input),
  get: (groupId: string) => request<GroupWithMembers>("GET", `/groups/${groupId}`),
  delete: (groupId: string) => request<void>("DELETE", `/groups/${groupId}`),
  balances: (groupId: string) => request<GroupBalances>("GET", `/groups/${groupId}/balances`),
  addMember: (groupId: string, email: string) =>
    request<Member>("POST", `/groups/${groupId}/members`, { email }),
  removeMember: (groupId: string, userId: string) =>
    request<void>("DELETE", `/groups/${groupId}/members/${userId}`),
};

export const expensesApi = {
  list: (groupId: string, filters: ExpenseFilters = {}) =>
    request<Paginated<Expense>>("GET", `/groups/${groupId}/expenses${queryString(filters)}`),
  get: (groupId: string, expenseId: string) =>
    request<Expense>("GET", `/groups/${groupId}/expenses/${expenseId}`),
  create: (groupId: string, input: ExpenseInput) =>
    request<Expense>("POST", `/groups/${groupId}/expenses`, input),
  update: (groupId: string, expenseId: string, input: Partial<ExpenseInput>) =>
    request<Expense>("PATCH", `/groups/${groupId}/expenses/${expenseId}`, input),
  delete: (groupId: string, expenseId: string) =>
    request<void>("DELETE", `/groups/${groupId}/expenses/${expenseId}`),
};

export const settlementsApi = {
  list: (groupId: string, filters: SettlementFilters = {}) =>
    request<Paginated<Settlement>>("GET", `/groups/${groupId}/settlements${queryString(filters)}`),
  create: (groupId: string, input: SettlementInput) =>
    request<Settlement>("POST", `/groups/${groupId}/settlements`, input),
  delete: (groupId: string, settlementId: string) =>
    request<void>("DELETE", `/groups/${groupId}/settlements/${settlementId}`),
  confirm: (groupId: string, settlementId: string) =>
    request<Settlement>("POST", `/groups/${groupId}/settlements/${settlementId}/confirm`),
  reject: (groupId: string, settlementId: string) =>
    request<Settlement>("POST", `/groups/${groupId}/settlements/${settlementId}/reject`),
};
