-- Migration 0005: paid allowance is 3/month; exclude trial rewards from paid counts
--
-- App config (rewardConfig.monthlyPlanLimit) is now 3. The SQL function already
-- takes p_limit from the app — this migration:
--   1. Adds runs.is_trial_reward so a trial reservation never reduces the later
--      paid monthly allowance of 3.
--   2. Updates reserve_reward to set/exclude that flag.
--   3. Documents the paid limit as three (not two).

alter table public.runs
  add column if not exists is_trial_reward boolean not null default false;

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
    -- One rewarded plan for the whole trial (all-time reserved/sent).
    select count(*) into used_count
    from public.runs
    where member_id = p_member_id
      and reward_status in ('reserved', 'sent');
  else
    -- Three per calendar month once active; trial rewards do not count.
    select count(*) into used_count
    from public.runs
    where member_id = p_member_id
      and reward_status in ('reserved', 'sent')
      and coalesce(is_trial_reward, false) = false
      and accepted_at >= month_start
      and accepted_at < month_end;
  end if;

  if used_count < p_limit then
    update public.runs
       set reward_status = 'reserved',
           is_trial_reward = p_trial
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
