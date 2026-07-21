"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  adminCookieValue,
  isAdminAuthenticated,
} from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { FEEDBACK_OPTIONS } from "@/lib/messages";
import type { RunStatus } from "@/lib/types";

export interface AdminLoginState {
  error?: string;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function loginAdmin(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const password = String(formData.get("password") ?? "");
  if (!password || !safeEqual(password, serverEnv.adminPassword())) {
    return { error: "Incorrect password." };
  }
  const store = await cookies();
  store.set(ADMIN_COOKIE, adminCookieValue(), adminCookieOptions());
  redirect("/admin");
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin");
}

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    throw new Error("Not authorized.");
  }
}

export async function setRunStatus(runId: string, status: RunStatus): Promise<void> {
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const patch: Record<string, unknown> = { status };
  if (status === "completed") patch.completed_at = new Date().toISOString();
  await supabase.from("runs").update(patch).eq("id", runId);
  revalidatePath("/admin");
}

export async function markPendingFriend(formData: FormData): Promise<void> {
  await setRunStatus(String(formData.get("runId")), "pending_friend");
}

export async function markCompleted(formData: FormData): Promise<void> {
  await setRunStatus(String(formData.get("runId")), "completed");
}

export async function cancelRun(formData: FormData): Promise<void> {
  await setRunStatus(String(formData.get("runId")), "cancelled");
}

export async function markRewardSent(formData: FormData): Promise<void> {
  await requireAdmin();
  const runId = String(formData.get("runId"));
  const supabase = getSupabaseAdmin();
  await supabase
    .from("runs")
    .update({ reward_status: "sent", reward_sent_at: new Date().toISOString() })
    .eq("id", runId);
  revalidatePath("/admin");
}

/**
 * Manually release this run's reward. Released plans no longer count toward
 * the member's three-per-month allowance, freeing up a slot for that month.
 */
export async function releaseReward(formData: FormData): Promise<void> {
  await requireAdmin();
  const runId = String(formData.get("runId"));
  const supabase = getSupabaseAdmin();

  await supabase
    .from("runs")
    .update({ reward_status: "released" })
    .eq("id", runId);

  revalidatePath("/admin");
}

export async function saveFeedback(formData: FormData): Promise<void> {
  await requireAdmin();
  const runId = String(formData.get("runId"));
  const feedback = String(formData.get("feedback") ?? "");
  const allowed = feedback === "" || FEEDBACK_OPTIONS.includes(feedback as never);
  if (!allowed) return;
  const supabase = getSupabaseAdmin();
  await supabase
    .from("runs")
    .update({ feedback: feedback || null })
    .eq("id", runId);
  revalidatePath("/admin");
}
