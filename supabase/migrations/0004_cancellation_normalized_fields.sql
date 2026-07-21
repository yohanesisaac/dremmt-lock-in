-- Migration 0004: normalize Stripe cancellation into separate fields
--
-- Keep cancel_at_period_end as Stripe's raw boolean.
-- Add:
--   cancellation_requested_at  <- subscription.canceled_at
--   access_ends_at             <- subscription.cancel_at
--
-- Safe to re-run. Does not drop or rename existing columns.

alter table public.members
  add column if not exists cancellation_requested_at timestamptz null;

alter table public.members
  add column if not exists access_ends_at timestamptz null;
