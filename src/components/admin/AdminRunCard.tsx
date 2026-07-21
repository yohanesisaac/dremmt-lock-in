import { CopyButton } from "@/components/CopyButton";
import { eyebrowClass } from "@/components/ui";
import {
  markPendingFriend,
  markCompleted,
  markRewardSent,
  cancelRun,
  releaseReward,
  saveFeedback,
} from "@/app/admin/actions";
import {
  initiatorReminder,
  friendReminder,
  completionFollowUp,
  FEEDBACK_OPTIONS,
} from "@/lib/messages";
import { formatCancellationLabel } from "@/lib/stripe-cancellation";
import { formatTimeWindowShort } from "@/lib/time-windows";
import type { MemberRow, RunRow, RunStatus } from "@/lib/types";

const STATUS_LABEL: Record<RunStatus, string> = {
  awaiting_payment: "Awaiting payment",
  ready: "Ready to share",
  pending_friend: "Pending friend",
  accepted: "Accepted",
  time_conflict: "Time conflict",
  completed: "Completed",
  cancelled: "Cancelled",
};

const actionBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-cream";
const copyBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-navy px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-navy-soft";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="w-48 shrink-0 text-sm font-semibold text-muted">{label}</dt>
      <dd className="text-navy break-words">{value || "—"}</dd>
    </div>
  );
}

export function AdminRunCard({
  run,
  member,
  inviteUrl,
}: {
  run: RunRow;
  member: MemberRow | null;
  inviteUrl: string;
}) {
  const created = new Date(run.created_at).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const proposed = [
    formatTimeWindowShort(run.time_option_one),
    run.time_option_two ? formatTimeWindowShort(run.time_option_two) : null,
  ]
    .filter(Boolean)
    .join("  ·  or  ·  ");

  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl text-navy">
          {run.initiator_name} → {run.friend_name}
        </h3>
        <span className="rounded-full border border-border-strong px-3 py-1 text-sm font-medium text-navy">
          {STATUS_LABEL[run.status]}
        </span>
      </div>

      <dl className="mt-4">
        <Row label="Created" value={created} />
        <Row label="Initiator name" value={run.initiator_name} />
        <Row label="Initiator phone" value={run.initiator_phone} />
        <Row label="Initiator email" value={run.initiator_email} />
        <Row label="Friend name" value={run.friend_name} />
        <Row label="Restaurant" value={run.restaurant_name} />
        <Row label="Location" value={run.location} />
        <Row label="Proposed windows" value={proposed} />
        <Row
          label="Selected window"
          value={
            run.selected_time ? formatTimeWindowShort(run.selected_time) : null
          }
        />
        <Row label="Friend phone" value={run.friend_phone} />
        <Row
          label="Friend texting consent"
          value={run.friend_phone ? (run.friend_sms_consent ? "Yes" : "No") : null}
        />
        <Row label="Run status" value={STATUS_LABEL[run.status]} />
        <Row
          label="Membership status"
          value={
            member
              ? [
                  member.subscription_status,
                  formatCancellationLabel({
                    subscriptionStatus: member.subscription_status,
                    cancelAtPeriodEnd: member.cancel_at_period_end,
                    accessEndsAt: member.access_ends_at,
                  }),
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "no member"
          }
        />
        <Row label="Reward status" value={run.reward_status} />
        <Row
          label="Invitation URL"
          value={
            <span className="flex flex-col gap-1">
              <span className="text-sm break-all text-navy">{inviteUrl}</span>
              <CopyButton
                text={inviteUrl}
                label="Copy invite URL"
                className={`${copyBtn} w-fit`}
              />
            </span>
          }
        />
        {run.feedback ? <Row label="Feedback" value={run.feedback} /> : null}
      </dl>

      {/* Copy suggested texts (sent manually from the Dremmt number) */}
      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton
          text={initiatorReminder(run)}
          label="Copy initiator reminder"
          className={copyBtn}
        />
        <CopyButton
          text={friendReminder(run)}
          label="Copy friend reminder"
          className={copyBtn}
        />
        <CopyButton
          text={completionFollowUp()}
          label="Copy completion follow-up"
          className={copyBtn}
        />
      </div>

      {/* Status actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <form action={markPendingFriend}>
          <input type="hidden" name="runId" value={run.id} />
          <button type="submit" className={actionBtn}>
            Mark pending friend
          </button>
        </form>
        <form action={markCompleted}>
          <input type="hidden" name="runId" value={run.id} />
          <button type="submit" className={actionBtn}>
            Mark completed
          </button>
        </form>
        <form action={markRewardSent}>
          <input type="hidden" name="runId" value={run.id} />
          <button type="submit" className={actionBtn}>
            Mark reward sent
          </button>
        </form>
        <form action={releaseReward}>
          <input type="hidden" name="runId" value={run.id} />
          <button type="submit" className={actionBtn}>
            Release this reward
          </button>
        </form>
        <form action={cancelRun}>
          <input type="hidden" name="runId" value={run.id} />
          <button type="submit" className={actionBtn}>
            Cancel run
          </button>
        </form>
      </div>

      {/* Feedback capture */}
      <form action={saveFeedback} className="mt-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="runId" value={run.id} />
        <div className="space-y-1">
          <label
            htmlFor={`feedback-${run.id}`}
            className={`${eyebrowClass} block`}
          >
            Did Dremmt help this plan actually happen?
          </label>
          <select
            id={`feedback-${run.id}`}
            name="feedback"
            defaultValue={run.feedback ?? ""}
            className="min-h-11 rounded-md border border-border-strong bg-surface px-3 py-2 text-navy"
          >
            <option value="">No answer yet</option>
            {FEEDBACK_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={actionBtn}>
          Save feedback
        </button>
      </form>
    </article>
  );
}
