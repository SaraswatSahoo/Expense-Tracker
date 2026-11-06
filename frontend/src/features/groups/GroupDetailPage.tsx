import { useParams, useSearchParams } from "react-router";
import { LinkButton } from "../../components/Button";
import { PageHeader } from "../../components/Card";
import { EmptyState, QueryError } from "../../components/Feedback";
import { LoadingBlock } from "../../components/Spinner";
import { Tabs, type TabItem } from "../../components/Tabs";
import { activeMembers, useGroup } from "../../hooks/useGroup";
import { ApiError } from "../../lib/api";
import { ExpensesTab } from "../expenses/ExpensesTab";
import { SettlementsTab } from "../settlements/SettlementsTab";
import { BalancesTab } from "./BalancesTab";
import { MembersTab } from "./MembersTab";

type TabValue = "expenses" | "balances" | "settlements" | "members";

const TABS: TabItem<TabValue>[] = [
  { value: "expenses", label: "Expenses" },
  { value: "balances", label: "Balances" },
  { value: "settlements", label: "Settlements" },
  { value: "members", label: "Members" },
];

// The API answers a malformed group ID in the URL with a 400, which also means there's no such group.
const isMissingGroup = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 400);

export function GroupDetailPage() {
  const { groupId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useGroup(groupId);

  // Checked before the cached data: losing access leaves the old group in the cache.
  if (isMissingGroup(query.error)) {
    return (
      <EmptyState
        title="Group not found"
        description="It may have been deleted, or you may no longer be a member."
        action={
          <LinkButton to="/groups" variant="secondary">
            Back to groups
          </LinkButton>
        }
      />
    );
  }
  if (!query.data) {
    return query.isError ? (
      <QueryError error={query.error} onRetry={() => void query.refetch()} />
    ) : (
      <LoadingBlock />
    );
  }

  const group = query.data;
  const memberCount = activeMembers(group).length;
  const selected = TABS.find((tab) => tab.value === searchParams.get("tab")) ?? TABS[0]!;

  return (
    <>
      <PageHeader
        title={group.name}
        subtitle={`${group.currency} · ${memberCount} ${memberCount === 1 ? "member" : "members"}`}
        actions={<LinkButton to={`/groups/${group.id}/expenses/new`}>Add expense</LinkButton>}
      />
      {query.isError && (
        <div className="mb-4">
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        </div>
      )}
      <Tabs
        items={TABS}
        value={selected.value}
        onChange={(tab) => setSearchParams({ tab })}
      />
      <div key={group.id} role="tabpanel" aria-label={selected.label}>
        {selected.value === "expenses" && <ExpensesTab group={group} />}
        {selected.value === "balances" && <BalancesTab group={group} />}
        {selected.value === "settlements" && <SettlementsTab group={group} />}
        {selected.value === "members" && <MembersTab group={group} />}
      </div>
    </>
  );
}
