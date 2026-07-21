import { getSupabaseAdmin } from "./supabase";
import { phoneLookupCandidates, phonesMatch } from "./phone";
import { pickMemberForPhone } from "./membership-identity";
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

export type MemberPhoneLookup =
  | { ok: true; member: MemberRow | null; matches: MemberRow[] }
  | { ok: false; error: string };

/**
 * Look up members by normalized phone. Fails closed on database errors.
 * When duplicates exist, returns the best candidate via {@link pickMemberForPhone}
 * without merging or deleting rows.
 */
export async function findMemberByNormalizedPhone(
  canonicalPhone: string,
): Promise<MemberPhoneLookup> {
  const supabase = getSupabaseAdmin();
  const candidates = phoneLookupCandidates(canonicalPhone);

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .in("phone", candidates);

  if (error) {
    console.error("findMemberByNormalizedPhone failed:", error.message);
    return {
      ok: false,
      error: "We couldn't verify membership right now. Please try again.",
    };
  }

  // Also keep any rows whose stored formatting still normalizes to this phone
  // even if they weren't covered by the candidate list (defensive).
  const matches = ((data ?? []) as MemberRow[]).filter((row) =>
    phonesMatch(row.phone, canonicalPhone),
  );

  return {
    ok: true,
    member: pickMemberForPhone(matches),
    matches,
  };
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
