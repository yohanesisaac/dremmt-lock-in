-- Migration 0001: Monthly reward allowance
-- (2 completed, accepted plans per calendar month, replacing the old rolling
-- 7-day / one-reward-at-a-time model.)
--
-- Run this once against your EXISTING Dremmt Lock-In Supabase project —
-- editing supabase/schema.sql alone does not change an already-created
-- database. Open the Supabase SQL Editor for your project, paste this whole
-- file, and run it.
--
-- Safe to re-run: every statement is idempotent, and nothing here drops a
-- table, column, or row of existing data.

-- ---------------------------------------------------------------------------
-- 1. Retire the old "one reserved reward at a time per member" constraint.
--    That model assumed exactly one active weekly reservation. The new model
--    allows up to two SIMULTANEOUS reserved rewards per member within a
--    calendar month, so the old partial unique index must go.
-- ---------------------------------------------------------------------------
drop index if exists public.runs_one_reserved_reward_per_member;

-- ---------------------------------------------------------------------------
-- 2. Covering index for the monthly-allowance count query
--    (member_id + reward_status + accepted_at).
-- ---------------------------------------------------------------------------
create index if not exists runs_member_reward_accepted_idx
  on public.runs (member_id, reward_status, accepted_at);

-- ---------------------------------------------------------------------------
-- 3. Atomic reservation function.
--
--    Counts this member's ACCEPTED plans with a reserved/sent reward in the
--    current calendar month, and only reserves the reward for this run if
--    the member is still under the monthly limit. The `for update` row lock
--    on the member serializes concurrent attempts, so the same member can
--    never end up with more than p_limit reservations in the same month even
--    if two invitations are accepted at the same instant.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_monthly_reward(
  p_run_id uuid,
  p_member_id uuid,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start timestamptz := date_trunc('month', now());
  month_end   timestamptz := month_start + interval '1 month';
  used_count  integer;
  did_reserve boolean := false;
begin
  perform 1 from public.members where id = p_member_id for update;

  select count(*) into used_count
  from public.runs
  where member_id = p_member_id
    and reward_status in ('reserved', 'sent')
    and accepted_at >= month_start
    and accepted_at < month_end;

  if used_count < p_limit then
    update public.runs
       set reward_status = 'reserved'
     where id = p_run_id
       and member_id = p_member_id
       and reward_status = 'none';

    if found then
      did_reserve := true;
    end if;
  end if;

  return did_reserve;
end;
$$;

revoke all on function public.reserve_monthly_reward(uuid, uuid, integer) from public;
grant execute on function public.reserve_monthly_reward(uuid, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4. members.reward_used_at and members.reward_period_started_at are no
--    longer read or written by the application — the monthly allowance is
--    now computed directly from `runs`. They are intentionally left in place
--    (not dropped) to keep this migration non-destructive. You may drop them
--    later once you've confirmed the new flow end-to-end:
--
--    alter table public.members drop column if exists reward_used_at;
--    alter table public.members drop column if exists reward_period_started_at;
-- ---------------------------------------------------------------------------
