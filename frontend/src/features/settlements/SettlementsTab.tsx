import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "../../components/Button";
import { EmptyState, QueryError } from "../../components/Feedback";
import { SelectField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { Pagination } from "../../components/Pagination";
import { LoadingBlock } from "../../components/Spinner";
import { settlementsApi } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import type { GroupWithMembers, SettlementStatus } from "../../lib/types";
import { SettlementCard } from "./SettlementCard";
import { SettlementForm, type SettlementPrefill } from "./SettlementForm";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: SettlementStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "REJECTED", label: "Rejected" },
];

export function SettlementsTab({ group }: { group: GroupWithMembers }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<SettlementPrefill | null>(null);
  const [status, setStatus] = useState<SettlementStatus | "">("");
  const [page, setPage] = useState(1);

  // The values move into state because the params are removed straight away. StrictMode's second
  // run sees the same params in this closure, so it only repeats the same work. Once the params
  // are gone this returns early and leaves the open modal and its values alone.
  useEffect(() => {
    if (searchParams.get("record") !== "1") return;
    setPrefill({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      amount: searchParams.get("amount"),
    });
    setModalOpen(true);
    const remaining = new URLSearchParams(searchParams);
    for (const key of ["record", "from", "to", "amount"]) remaining.delete(key);
    setSearchParams(remaining, { replace: true });
  }, [searchParams, setSearchParams]);

  const filters = { page, limit: PAGE_SIZE, ...(status ? { status } : {}) };
  const query = useQuery({
    queryKey: queryKeys.settlements(group.id, filters),
    queryFn: () => settlementsApi.list(group.id, filters),
  });
  const data = query.data;

  // Deleting or filtering away the last item on the last page would otherwise strand the user there.
  const pastLastPage = data !== undefined && data.items.length === 0 && page > 1;
  useEffect(() => {
    if (pastLastPage) setPage(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
  }, [pastLastPage, data]);

  const statusLabel = STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "";

  return (
    <section aria-label="Repayments">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:w-48">
          <SelectField
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SettlementStatus | "");
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>
        <Button
          onClick={() => {
            setPrefill(null);
            setModalOpen(true);
          }}
        >
          Record repayment
        </Button>
      </div>

      {query.isPending || pastLastPage ? (
        <LoadingBlock />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : data === undefined || data.items.length === 0 ? (
        status ? (
          <EmptyState
            title={`No ${statusLabel.toLowerCase()} repayments`}
            description="Choose a different status to see other repayments."
          />
        ) : (
          <EmptyState
            title="No repayments yet"
            description="Record a repayment when someone pays back what they owe."
          />
        )
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((settlement) => (
              <li key={settlement.id}>
                <SettlementCard group={group} settlement={settlement} />
              </li>
            ))}
          </ul>
          {data.items.some((settlement) => settlement.status === "CONFIRMED") && (
            <p className="mt-3 text-xs text-slate-500">
              Confirmed repayments can't be changed. To correct a mistake, record a repayment in the
              other direction.
            </p>
          )}
          <Pagination page={page} limit={PAGE_SIZE} total={data.total} onChange={setPage} />
        </>
      )}

      <Modal open={modalOpen} title="Record repayment" onClose={() => setModalOpen(false)}>
        <SettlementForm group={group} prefill={prefill} onClose={() => setModalOpen(false)} />
      </Modal>
    </section>
  );
}
