import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button, LinkButton } from "../../components/Button";
import { Badge, Alert, EmptyState, QueryError } from "../../components/Feedback";
import { Card, PageHeader } from "../../components/Card";
import { InputField, SelectField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { Pagination } from "../../components/Pagination";
import { LoadingBlock } from "../../components/Spinner";
import { errorMessage, fieldError, groupsApi } from "../../lib/api";
import { CURRENCIES } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";

const LIMIT = 12;

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function NewGroupForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [blankName, setBlankName] = useState(false);

  const create = useMutation({
    mutationFn: groupsApi.create,
    onSuccess: (group) => {
      queryClient.setQueryData(queryKeys.group(group.id), group);
      void queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
      onClose();
      void navigate(`/groups/${group.id}`);
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    setBlankName(trimmed === "");
    if (trimmed) create.mutate({ name: trimmed, currency });
  };

  const nameError = blankName ? "Enter a group name" : fieldError(create.error, "name");
  const currencyError = fieldError(create.error, "currency");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <InputField
        label="Group name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={nameError}
        maxLength={100}
        required
        autoFocus
      />
      <SelectField
        label="Currency"
        value={currency}
        onChange={(event) => setCurrency(event.target.value)}
        error={currencyError}
      >
        {CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </SelectField>
      {create.isError && !nameError && !currencyError && (
        <Alert>{errorMessage(create.error)}</Alert>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending}>
          Create group
        </Button>
      </div>
    </form>
  );
}

export function GroupListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const page = parsePage(searchParams.get("page"));
  const params = { page, limit: LIMIT };

  const groups = useQuery({
    queryKey: queryKeys.groupList(params),
    queryFn: () => groupsApi.list(params),
    placeholderData: keepPreviousData,
  });

  const showPage = (next: number) => setSearchParams(next > 1 ? { page: String(next) } : {});

  return (
    <>
      <PageHeader
        title="Groups"
        actions={<Button onClick={() => setCreating(true)}>New group</Button>}
      />

      {groups.isError && (
        <div className="mb-4">
          <QueryError error={groups.error} onRetry={() => void groups.refetch()} />
        </div>
      )}
      {groups.isPending && <LoadingBlock />}

      {groups.data && groups.data.total === 0 && (
        <EmptyState
          title="No groups yet"
          description="Create a group to start sharing expenses."
        />
      )}
      {/* A link to an old page number can point past the end of a list that has since shrunk. */}
      {groups.data && groups.data.total > 0 && groups.data.items.length === 0 && (
        <EmptyState
          title="No groups on this page"
          action={
            <LinkButton to="/groups" variant="secondary">
              Back to the first page
            </LinkButton>
          }
        />
      )}
      {groups.data && groups.data.items.length > 0 && (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.data.items.map((group) => (
              <li key={group.id} className="min-w-0">
                <Link
                  to={`/groups/${group.id}`}
                  className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  <Card className="flex h-full items-start justify-between gap-3 transition-colors hover:bg-slate-50">
                    <span className="min-w-0 font-medium break-words text-slate-900">
                      {group.name}
                    </span>
                    <Badge>{group.currency}</Badge>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} limit={LIMIT} total={groups.data.total} onChange={showPage} />
        </>
      )}

      <Modal open={creating} title="New group" onClose={() => setCreating(false)}>
        <NewGroupForm onClose={() => setCreating(false)} />
      </Modal>
    </>
  );
}
