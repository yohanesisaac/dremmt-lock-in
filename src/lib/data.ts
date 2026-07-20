import { getSupabaseAdmin } from "./supabase";
import type { MemberRow, RunRow } from "./types";

export async function getRunByToken(token: string): Promise<RunRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return data as RunRow;
}

export async function getMemberById(id: string): Promise<MemberRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as MemberRow;
}

export async function listRuns(): Promise<RunRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as RunRow[];
}

export async function listMembersByIds(
  ids: string[],
): Promise<Map<string, MemberRow>> {
  const map = new Map<string, MemberRow>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return map;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("members").select("*").in("id", unique);
  for (const member of (data ?? []) as MemberRow[]) {
    map.set(member.id, member);
  }
  return map;
}
