import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  authApi,
  clearTokens,
  hasStoredSession,
  onSessionExpired,
  REFRESH_TOKEN_STORAGE_KEY,
} from "../lib/api";
import type { User } from "../lib/types";

// "unavailable" means a saved session couldn't be checked, usually because the server is down.
type AuthStatus = "loading" | "authenticated" | "anonymous" | "unavailable";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  login: (input: { email: string; password: string }) => Promise<void>;
  signup: (input: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(hasStoredSession() ? "loading" : "anonymous");

  const signedIn = useCallback((nextUser: User) => {
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const signedOut = useCallback(() => {
    setUser(null);
    setStatus("anonymous");
    queryClient.clear();
  }, [queryClient]);

  const restoreSession = useCallback(() => {
    if (!hasStoredSession()) return;
    setStatus("loading");
    authApi
      .me()
      .then(signedIn)
      .catch(() => setStatus(hasStoredSession() ? "unavailable" : "anonymous"));
  }, [signedIn]);

  useEffect(restoreSession, [restoreSession]);
  useEffect(() => onSessionExpired(signedOut), [signedOut]);

  // Logging out in one tab logs out the others too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REFRESH_TOKEN_STORAGE_KEY && event.newValue === null) {
        clearTokens();
        signedOut();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [signedOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: async (input) => signedIn(await authApi.login(input)),
      signup: async (input) => signedIn(await authApi.register(input)),
      logout: async () => {
        await authApi.logout();
        signedOut();
      },
      retry: restoreSession,
    }),
    [status, user, signedIn, signedOut, restoreSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

/** The logged-in user, for components that only render behind ProtectedRoute. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser must be used behind ProtectedRoute");
  return user;
}
