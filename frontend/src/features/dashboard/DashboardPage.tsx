import { LinkButton } from "../../components/Button";
import { PageHeader } from "../../components/Card";
import { Alert, EmptyState, QueryError } from "../../components/Feedback";
import { LoadingBlock } from "../../components/Spinner";
import { useCurrentUser } from "../../hooks/useAuth";
import { BalanceSummary } from "./BalanceSummary";
import { GroupCards } from "./GroupCards";
import { GROUP_LIMIT, useDashboardData } from "./useDashboardData";
import { WaitingForYou } from "./WaitingForYou";

export function DashboardPage() {
  const user = useCurrentUser();
  const { groupList, groups } = useDashboardData();

  return (
    <>
      <PageHeader title="Dashboard" />
      {groupList.isPending ? (
        <LoadingBlock />
      ) : !groupList.data ? (
        <QueryError error={groupList.error} onRetry={() => void groupList.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create a group to start sharing expenses."
          action={<LinkButton to="/groups">Create a group</LinkButton>}
        />
      ) : (
        <div className="space-y-8">
          {groupList.data.total > groups.length && (
            <Alert tone="warning">
              Showing your first {GROUP_LIMIT} of {groupList.data.total} groups. Totals only include
              these groups.
            </Alert>
          )}
          <BalanceSummary groups={groups} userId={user.id} />
          <WaitingForYou groups={groups} userId={user.id} />
          <GroupCards groups={groups} userId={user.id} />
        </div>
      )}
    </>
  );
}
