import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./Button";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
  }`;

/** The page frame for logged-in users. */
export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-1 sm:gap-4">
            <Link to="/" className="mr-1 font-semibold whitespace-nowrap text-brand-700">
              <span className="hidden sm:inline">Expense Tracker</span>
              <span className="sm:hidden">ET</span>
            </Link>
            <nav className="flex gap-1">
              <NavLink to="/" end className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/groups" className={navLinkClass}>
                Groups
              </NavLink>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-40 truncate text-sm text-slate-500 md:inline">
              {user?.name}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

/** The centred frame for the login and signup pages. */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <p className="mb-6 text-xl font-semibold text-brand-700">Expense Tracker</p>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  );
}
