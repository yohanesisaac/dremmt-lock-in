-- Dremmt Lock-In — pilot database schema
-- Run this in the Supabase SQL editor (or `psql`) for your project.
-- Safe to re-run: it drops nothing; it only creates if missing.

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  id                       uuid primary key default gen_random_uuid(),
  first_name               text,
  phone                    text,
  email                    text,
  sms_consent              boolean not null default false,
  stripe_customer_id       text,
  stripe_subscription_id   text,
  subscription_status      text not null default 'inactive'
    check (subscription_status in (
      'incomplete', 'active', 'trialing', 'past_due',
      'canceled', 'unpaid', 'inactive'
    )),
  -- Raw Stripe boolean (subscription.cancel_at_period_end). Not a general
  -- "cancellation scheduled" flag — see access_ends_at / cancellation_requested_at.
  cancel_at_period_end     boolean not null default false,
  -- Stripe subscription.canceled_at (when cancellation was requested).
  cancellation_requested_at timestamptz null,
  -- Stripe subscription.cancel_at (when access is scheduled to end).
  access_ends_at           timestamptz null,
  member_access_token      text not null unique,
  -- Deprecated / unused by the app: the trial/monthly reward allowance (see
  -- reserve_reward below) is computed directly from `runs`, not from
  -- a per-member counter. Kept only for backward compatibility.
  reward_period_started_at timestamptz,
  reward_used_at           timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists members_stripe_customer_idx
  on public.members (stripe_customer_id);
create index if not exists members_stripe_subscription_idx
  on public.members (stripe_subscription_id);
-- Non-unique: duplicate phones already exist in some pilot databases.
create index if not exists members_phone_idx
  on public.members (phone);

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- runs
-- ---------------------------------------------------------------------------
create table if not exists public.runs (
  id                     uuid primary key default gen_random_uuid(),
  invite_token           text not null unique,
  member_id              uuid references public.members (id) on delete set null,
  initiator_name         text not null,
  initiator_phone        text not null,
  initiator_email        text not null,
  initiator_sms_consent  boolean not null default false,
  friend_name            text not null,
  restaurant_name        text not null,
  restaurant_link        text,
  location               text,
  time_option_one        jsonb not null,
  time_option_two        jsonb,
  personal_message       text,
  selected_time          jsonb,
  friend_phone           text,
  friend_sms_consent     boolean not null default false,
  status                 text not null default 'awaiting_payment'
    check (status in (
      'awaiting_payment', 'ready', 'pending_friend', 'accepted',
      'time_conflict', 'completed', 'cancelled'
    )),
  reward_status          text not null default 'none'
    check (reward_status in ('none', 'reserved', 'sent', 'released')),
  -- True when the reward was reserved during a Stripe trial. Excluded from
  -- paid monthly allowance counts so trial usage never reduces the later 3.
  is_trial_reward        boolean not null default false,
  feedback               text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  accepted_at            timestamptz,
  completed_at           timestamptz,
  reward_sent_at         timestamptz
);

create index if not exists runs_member_idx on public.runs (member_id);
create index if not exists runs_status_idx on public.runs (status);
create index if not exists runs_created_idx on public.runs (created_at desc);

-- Covering index for the monthly-allowance count query used by
-- reserve_monthly_reward below (member_id + reward_status + accepted_at).
create index if not exists runs_member_reward_accepted_idx
  on public.runs (member_id, reward_status, accepted_at);

drop trigger if exists runs_set_updated_at on public.runs;
create trigger runs_set_updated_at
  before update on public.runs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Plan allowance (trial + monthly)
-- ---------------------------------------------------------------------------
-- A member may activate at most `p_limit` rewarded accepted plans:
--   * p_trial = true  -> one rewarded plan for the whole 14-day trial (counts
--     every reserved/sent reward, ignoring the month).
--   * p_trial = false -> three per calendar month once active (trial rewards
--     marked is_trial_reward are excluded from the monthly count).
-- Only accepted plans with a reserved/sent reward count; declined invitations
-- and time conflicts never reach this function. The `for update` row lock on
-- the member serializes concurrent attempts, so the limit can never be
-- exceeded even if two invitations are accepted at the same instant.
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Enable RLS and add NO policies. All application access uses the Supabase
-- SECRET key on the server, which bypasses RLS. The anon/publishable key can
-- therefore never read or write these tables from the browser.
alter table public.members enable row level security;
alter table public.runs enable row level security;
