-- Migration 0003: phone lookup support (non-unique)
--
-- The pilot identifies members by normalized phone (+1XXXXXXXXXX). Existing
-- databases already contain duplicate member rows for the same phone (many with
-- null Stripe IDs), so a UNIQUE constraint on phone would fail and is NOT added
-- here.
--
-- This migration only adds a non-unique index to speed lookups. Application
-- code reuses the best matching row and does not create a new member when any
-- row already matches the normalized phone.
--
-- Safe to re-run. Does not delete or merge duplicate rows.
--
-- MANUAL CLEANUP (separate, not automatic):
--   1. List duplicate phones:
--        select right(regexp_replace(phone, '\D', '', 'g'), 10) as digits,
--               count(*) as n, array_agg(id) as ids
--        from public.members
--        where phone is not null
--        group by 1
--        having count(*) > 1;
--   2. Keep the row with an active/trialing subscription (or latest Stripe IDs),
--      re-point runs.member_id, then delete or null-out the extras.
--   3. Only after cleanup, consider:
--        create unique index members_phone_unique
--          on public.members (phone)
--          where phone is not null;

create index if not exists members_phone_idx
  on public.members (phone);
