-- Migration 0006: behavior-test mode marker
--
-- Temporary behavior-test mode lets a visitor create ONE plan without a card,
-- skipping Stripe entirely. Those members/runs must be distinguishable from
-- real paid members and runs.
--
-- This migration is additive and safe:
--   * Adds members.is_behavior_test (default false) — real paid members keep
--     false and are completely unaffected.
--   * Adds runs.is_behavior_test (default false) — real runs keep false.
--   * Adds partial indexes so behavior-test records can be listed/purged fast.
--
-- Behavior-test mode itself is toggled by the NEXT_PUBLIC_BEHAVIOR_TEST_MODE
-- environment variable, NOT by this column. The column only labels records.

alter table public.members
  add column if not exists is_behavior_test boolean not null default false;

alter table public.runs
  add column if not exists is_behavior_test boolean not null default false;

create index if not exists members_behavior_test_idx
  on public.members (is_behavior_test)
  where is_behavior_test = true;

create index if not exists runs_behavior_test_idx
  on public.runs (is_behavior_test)
  where is_behavior_test = true;
