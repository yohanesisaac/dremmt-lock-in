"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { acceptRunSchema, declineRunSchema } from "@/lib/schemas";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRunByToken, getMemberById } from "@/lib/data";
import { reserveReward, isTrialing } from "@/lib/reward-period";
import type { TimeWindow } from "@/lib/types";

export interface AcceptState {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export async function acceptRun(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const parsed = acceptRunSchema.safeParse({
    token: formData.get("token"),
    selectedOption: Number(formData.get("selectedOption")),
    friendPhone: formData.get("friendPhone"),
    friendSmsConsent: formData.get("friendSmsConsent") === "on",
  });

  if (!parsed.success) {
    return {
      error: "Please pick a time and add your phone number.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { token, selectedOption, friendPhone, friendSmsConsent } = parsed.data;
  const supabase = getSupabaseAdmin();

  const run = await getRunByToken(token);
  if (!run) {
    return { error: "This invitation could not be found." };
  }

  if (run.status === "accepted" || run.status === "completed") {
    redirect(`/locked/${token}`);
  }

  const selectedTime: TimeWindow | null =
    selectedOption === 1 ? run.time_option_one : run.time_option_two;

  if (!selectedTime) {
    return { error: "That time option is no longer available." };
  }

  const nowIso = new Date().toISOString();

  // Guarded acceptance: only a shareable/pending run can be accepted, and only
  // once. This prevents a second acceptance of the same invitation.
  const { data: updated, error: updateError } = await supabase
    .from("runs")
    .update({
      status: "accepted",
      selected_time: selectedTime,
      friend_phone: friendPhone,
      friend_sms_consent: friendSmsConsent,
      accepted_at: nowIso,
    })
    .eq("invite_token", token)
    .in("status", ["ready", "pending_friend"])
    .select("id, member_id")
    .maybeSingle();

  if (updateError) {
    return { error: "Something went wrong locking this in. Please try again." };
  }

  if (!updated) {
    // Someone already acted on this invite.
    const fresh = await getRunByToken(token);
    if (fresh && (fresh.status === "accepted" || fresh.status === "completed")) {
      redirect(`/locked/${token}`);
    }
    return { error: "This invitation is no longer open." };
  }

  // Reserve the member's reward atomically. Trialing members get one rewarded
  // plan for the whole trial; active members get two per calendar month. If
  // they've already used their allowance, the run is still locked in without
  // the reward attached — declined invitations and time conflicts never reach
  // this point, so they never consume the allowance.
  if (updated.member_id) {
    const member = await getMemberById(updated.member_id);
    const trialing = member ? isTrialing(member) : false;
    await reserveReward(updated.id, updated.member_id, trialing);
  }

  redirect(`/locked/${token}`);
}

export async function declineRun(formData: FormData): Promise<void> {
  const parsed = declineRunSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) return;

  const supabase = getSupabaseAdmin();
  await supabase
    .from("runs")
    .update({ status: "time_conflict" })
    .eq("invite_token", parsed.data.token)
    .in("status", ["ready", "pending_friend"]);

  revalidatePath(`/invite/${parsed.data.token}`);
  redirect(`/invite/${parsed.data.token}`);
}
