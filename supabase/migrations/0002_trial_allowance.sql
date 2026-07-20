-- Migration 0002: 14-day trial allowance + scheduled-cancellation flag
--
-- Run this once against your EXISTING Dremmt Lock-In Supabase project, after
-- migration 0001. Editing supabase/schema.sql alone does not change an
-- already-created database. Open the Supabase SQL Editor, paste this whole
-- file, and run it.
--
-- Safe to re-run: every statement is idempotent, and nothing here drops a
-- table, column, or row of existing data.

-- ---------------------------------------------------------------------------
-- 1. Track a scheduled (end-of-period) cancellation coming from Stripe.
--    The member keeps access until the period actually ends (Stripe then
--    sends customer.subscription.deleted, which flips status to 'canceled').
-- ---------------------------------------------------------------------------
alter table public.members
  add column if not exists cancel_at_period_end boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Allowance-aware reservation.
--
--    Supersedes reserve_monthly_reward. Adds a p_trial flag:
--      * p_trial = true  -> count EVERY reserved/sent reward the member has
--        (one rewarded plan for the whole trial).
--      * p_trial = false -> count only this calendar month (two per month).
--
--    The `for update` row lock on the member serializes concurrent attempts,
--    so the limit can never be exceeded even if two invitations are accepted
--    at the same instant.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_reward(
  p_run_id uuid,
  p_member_id uuid,
  p_limit integer,
  p_trial boolean
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

  if p_trial then
    select count(*) into used_count
    from public.runs
    where member_id = p_member_id
      and reward_status in ('reserved', 'sent');
  else
    select count(*) into used_count
    from public.runs
    where member_id = p_member_id
      and reward_status in ('reserved', 'sent')
      and accepted_at >= month_start
      and accepted_at < month_end;
  end if;

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

revoke all on function public.reserve_reward(uuid, uuid, integer, boolean) from public;
grant execute on function public.reserve_reward(uuid, uuid, integer, boolean) to service_role;
