import { Link, Route, Routes } from "react-router";
import { EmptyState } from "./components/Feedback";
import { AuthLayout, Layout } from "./components/Layout";
import { ProtectedRoute, PublicOnlyRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./features/auth/LoginPage";
import { SignupPage } from "./features/auth/SignupPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ExpenseFormPage } from "./features/expenses/ExpenseFormPage";
import { GroupDetailPage } from "./features/groups/GroupDetailPage";
import { GroupListPage } from "./features/groups/GroupListPage";

function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      action={
        <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">
          Back to the dashboard
        </Link>
      }
    />
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/groups" element={<GroupListPage />} />
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
          <Route path="/groups/:groupId/expenses/new" element={<ExpenseFormPage />} />
          <Route path="/groups/:groupId/expenses/:expenseId/edit" element={<ExpenseFormPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
