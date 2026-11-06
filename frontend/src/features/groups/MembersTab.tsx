import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Alert, Badge } from "../../components/Feedback";
import { InputField } from "../../components/FormField";
import { ConfirmDialog } from "../../components/Modal";
import { useCurrentUser } from "../../hooks/useAuth";
import { activeMembers, useInvalidateGroup } from "../../hooks/useGroup";
import { errorMessage, fieldError, groupsApi } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import type { GroupWithMembers, Member } from "../../lib/types";

/** Goes to the group list once the current user can no longer open this group. */
function useExitGroup(groupId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return () => {
    void navigate("/groups", { replace: true });
    void queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
    // Marked stale without refetching. React Router navigates in a transition, so this page is
    // still mounted here, and a refetch could return a 404 and flash "Group not found".
    void queryClient.invalidateQueries({
      queryKey: queryKeys.group(groupId),
      refetchType: "none",
    });
  };
}

function AddMemberForm({ groupId }: { groupId: string }) {
  const invalidateGroup = useInvalidateGroup(groupId);
  const [email, setEmail] = useState("");

  const add = useMutation({
    mutationFn: (address: string) => groupsApi.addMember(groupId, address),
    onSuccess: async () => {
      setEmail("");
      await invalidateGroup();
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    add.mutate(email.trim());
  };

  const emailError = fieldError(add.error, "email");

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <InputField
            label="Add member by email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (add.isError) add.reset();
            }}
            error={emailError}
            hint="They need an account already. Former members can be added back the same way."
            maxLength={254}
            autoComplete="off"
            required
          />
        </div>
        <Button type="submit" loading={add.isPending} className="sm:mt-6">
          Add member
        </Button>
      </div>
      {add.isError && !emailError && <Alert>{errorMessage(add.error)}</Alert>}
    </form>
  );
}

function MemberRow({
  member,
  isCreator,
  isYou,
  isFormer = false,
  action,
}: {
  member: Member;
  isCreator: boolean;
  isYou: boolean;
  isFormer?: boolean;
  action?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
        <Avatar name={member.name} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-900">
            <span className="min-w-0 break-words">{member.name}</span>
            {isYou && <Badge tone="info">You</Badge>}
            {isCreator && <Badge>Creator</Badge>}
            {isFormer && <Badge>Left</Badge>}
          </p>
          <p className="text-xs break-words text-slate-500">{member.email}</p>
        </div>
      </div>
      {action}
    </li>
  );
}

function DangerZone({ group }: { group: GroupWithMembers }) {
  const exitGroup = useExitGroup(group.id);
  const [confirming, setConfirming] = useState(false);

  const remove = useMutation({
    mutationFn: () => groupsApi.delete(group.id),
    onSuccess: exitGroup,
  });

  // Also clears a failure from a request that finished after the dialog was dismissed.
  const setDialogOpen = (open: boolean) => {
    remove.reset();
    setConfirming(open);
  };

  return (
    <section aria-labelledby="danger-zone-heading">
      <Card>
        <h2 id="danger-zone-heading" className="text-lg font-semibold text-red-700">
          Danger zone
        </h2>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          Deleting a group permanently removes all of its expenses and settlements. Every balance
          must be zero first.
        </p>
        <Button variant="danger" onClick={() => setDialogOpen(true)}>
          Delete group
        </Button>
      </Card>
      <ConfirmDialog
        open={confirming}
        title="Delete group"
        message={`Delete "${group.name}"? This permanently deletes all of its expenses and settlements, and it can't be undone.`}
        confirmLabel="Delete group"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
        onClose={() => setDialogOpen(false)}
      />
    </section>
  );
}

export function MembersTab({ group }: { group: GroupWithMembers }) {
  const user = useCurrentUser();
  const invalidateGroup = useInvalidateGroup(group.id);
  const exitGroup = useExitGroup(group.id);
  const [target, setTarget] = useState<Member | null>(null);

  const removal = useMutation({
    mutationFn: (member: Member) => groupsApi.removeMember(group.id, member.userId),
    onSuccess: async (_result, member) => {
      if (member.userId === user.id) {
        exitGroup();
        return;
      }
      await invalidateGroup();
      // The dialog may have been dismissed, or reopened for someone else, while this was running.
      setTarget((current) => (current?.userId === member.userId ? null : current));
    },
    // The failure usually means this page is out of date, such as a balance that has since changed.
    onError: () => void invalidateGroup(),
  });

  const openDialog = (member: Member | null) => {
    removal.reset();
    setTarget(member);
  };

  const current = activeMembers(group);
  const former = group.members.filter((member) => member.leftAt !== null);
  const isLeaving = target?.userId === user.id;
  const isLastMember = current.length === 1;

  return (
    <div className="space-y-6">
      <Card>
        <AddMemberForm groupId={group.id} />
      </Card>

      <section aria-labelledby="current-members-heading">
        <h2 id="current-members-heading" className="mb-3 text-lg font-semibold text-slate-900">
          Current members
        </h2>
        <Card>
          <ul className="divide-y divide-slate-100">
            {current.map((member) => {
              const isYou = member.userId === user.id;
              return (
                <MemberRow
                  key={member.userId}
                  member={member}
                  isYou={isYou}
                  isCreator={member.userId === group.createdById}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => openDialog(member)}>
                      {isYou ? "Leave group" : "Remove"}
                      {!isYou && <span className="sr-only"> {member.name}</span>}
                    </Button>
                  }
                />
              );
            })}
          </ul>
        </Card>
      </section>

      {former.length > 0 && (
        <section aria-labelledby="former-members-heading">
          <h2 id="former-members-heading" className="mb-3 text-lg font-semibold text-slate-900">
            Former members
          </h2>
          <Card>
            <ul className="divide-y divide-slate-100">
              {former.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  isYou={false}
                  isCreator={member.userId === group.createdById}
                  isFormer
                />
              ))}
            </ul>
          </Card>
        </section>
      )}

      {group.createdById === user.id && <DangerZone group={group} />}

      <ConfirmDialog
        open={target !== null}
        title={isLeaving ? "Leave group" : "Remove member"}
        message={
          isLeaving
            ? `Leave "${group.name}"? You'll lose access until another member adds you back.${
                isLastMember ? " You're the only member, so nobody could add you back." : ""
              }`
            : `Remove ${target?.name} from "${group.name}"? Their past expenses stay in the group, and they can be added back later.`
        }
        confirmLabel={isLeaving ? "Leave group" : "Remove"}
        loading={removal.isPending}
        error={removal.error}
        onConfirm={() => {
          if (target) removal.mutate(target);
        }}
        onClose={() => openDialog(null)}
      />
    </div>
  );
}
