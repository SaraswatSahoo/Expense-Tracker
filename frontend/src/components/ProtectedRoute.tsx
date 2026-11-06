import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./Button";
import { Alert } from "./Feedback";
import { LoadingBlock } from "./Spinner";

function SessionUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-sm space-y-3 px-4 py-16">
      <Alert>Can't reach the server to check your session.</Alert>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** Sends logged-out visitors to the login page, remembering where they were going. */
export function ProtectedRoute() {
  const { status, retry } = useAuth();
  const location = useLocation();

  if (status === "loading") return <LoadingBlock />;
  if (status === "unavailable") return <SessionUnavailable onRetry={retry} />;
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Sends logged-in users away from the login and signup pages. */
export function PublicOnlyRoute() {
  const { status, retry } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (status === "loading") return <LoadingBlock />;
  if (status === "unavailable") return <SessionUnavailable onRetry={retry} />;
  if (status === "authenticated") return <Navigate to={from} replace />;
  return <Outlet />;
}
